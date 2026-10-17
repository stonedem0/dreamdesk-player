import { act, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Visualizer, VisualizerWindow, type AudioSource } from '../Visualizer';
import { SKINS } from '../skins';

// happy-dom has no WebGL: check the wiring, not the drawing
const viz = vi.hoisted(() => ({
  options: null as null | { getAnalyser: () => unknown; getAudio: () => unknown; colors: number[][]; background: number[] },
  start: vi.fn(),
  destroy: vi.fn(),
  setColors: vi.fn(),
}));
vi.mock('../../visualizer.js', () => ({
  createVisualizer: (options: typeof viz.options) => {
    viz.options = options;
    return { start: viz.start, stop: vi.fn(), destroy: viz.destroy, setColors: viz.setColors };
  },
}));
const windowProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@dreamdesk/ui', () => ({
  Window: (props: Record<string, unknown> & { children?: ReactNode }) => {
    windowProps.current = props;
    return <div data-testid="window" className="dd-window">{props.children}</div>;
  },
}));

const source = (name: string) => ({ analyser: { name }, audio: { name } }) as unknown as AudioSource;

describe('Visualizer', () => {
  it('starts on its canvas, and lets go of WebGL when it unmounts', () => {
    const { container, unmount } = render(<Visualizer source={null} />);
    expect(container.querySelector('canvas.dd-visualizer')).toBeTruthy();
    expect(viz.start).toHaveBeenCalled();
    unmount();
    expect(viz.destroy).toHaveBeenCalled();
  });

  it('draws whichever audio it has now, without starting over', () => {
    const { rerender } = render(<Visualizer source={null} />);
    expect(viz.options!.getAnalyser()).toBeNull();
    viz.start.mockClear();
    const a = source('a');
    rerender(<Visualizer source={a} />);
    expect(viz.options!.getAnalyser()).toBe(a.analyser);
    expect(viz.options!.getAudio()).toBe(a.audio);
    expect(viz.start).not.toHaveBeenCalled();
  });

  it('takes its colours as hex, and recolours in place', () => {
    const { rerender } = render(<Visualizer source={null} colors={['#ff0000', '#00ff00', '#0000ff']} background="#000000" />);
    expect(viz.options!.colors).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    viz.start.mockClear();
    rerender(<Visualizer source={null} colors={['#ffffff', '#00ff00', '#0000ff']} background="#000000" />);
    expect(viz.setColors).toHaveBeenLastCalledWith([[1, 1, 1], [0, 1, 0], [0, 0, 1]], [0, 0, 0]);
    expect(viz.start).not.toHaveBeenCalled();
  });
});

describe('VisualizerWindow', () => {
  it("wears the Player's skin, and draws in its colours", () => {
    render(<VisualizerWindow source={null} skin="pastelcore" />);
    expect(windowProps.current.className).toContain('dd-player');
    expect(windowProps.current.resizable).toBe(true);
    // Only close, like MilkDrop
    expect(windowProps.current.disableMinimize).toBe(true);
    expect(windowProps.current.disableFullscreen).toBe(true);
    expect((windowProps.current.style as Record<string, string>)['--player-bg']).toBe(SKINS.pastelcore!.vars['--player-bg']);
    const hex = (c: number[]) => '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    expect(viz.options!.colors.map(hex)).toEqual(SKINS.pastelcore!.visualizer.colors);
  });
});

describe('VisualizerWindow docked to the Player', () => {
  // Heights by class, as player.css would lay them out
  let heights: Record<string, number> = {};
  beforeEach(() => {
    heights = { player: 300, 'dd-window': 0, 'dd-player__playlist': 150, 'dd-player__eq': 170 };
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return heights[this.className] ?? 0;
    });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const player = (...open: string[]) => {
    const el = document.createElement('div');
    el.className = 'player';
    for (const cls of open) el.appendChild(Object.assign(document.createElement('div'), { className: cls }));
    return el;
  };

  it('is as tall as the Player with both panels open, even when they are shut', () => {
    // 300 with the playlist open: 150 of that is the playlist, so 150 + 150 + 170
    render(<VisualizerWindow source={null} dockTo={() => player('dd-player__playlist')} />);
    expect(windowProps.current.height).toBe('470px');
    // And with neither open (the Player alone is 300)
    render(<VisualizerWindow source={null} dockTo={() => player()} />);
    expect(windowProps.current.height).toBe('620px');
  });

  it('follows the Player if its size changes, until resized by hand', () => {
    let resized = () => {};
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { resized = cb; } observe() {} disconnect() {} });
    render(<VisualizerWindow source={null} dockTo={() => player()} />);
    expect(windowProps.current.height).toBe('620px');

    // Still matched, so a bigger Player (another skin, say) makes it bigger too
    heights['dd-window'] = 620; heights.player = 320;
    act(() => resized());
    expect(windowProps.current.height).toBe('640px');

    // Resized by hand: no longer follows
    heights['dd-window'] = 500; heights.player = 300;
    act(() => resized());
    expect(windowProps.current.height).toBe('640px');
  });
});

describe('Visualizer fullscreen', () => {
  it('goes fullscreen on a double-click, and back on another', () => {
    const { container } = render(<Visualizer source={null} />);
    const canvas = container.querySelector('canvas')!;
    const request = vi.fn(() => Promise.resolve());
    const exit = vi.fn(() => Promise.resolve());
    Object.assign(canvas, { requestFullscreen: request });
    Object.assign(document, { exitFullscreen: exit });
    fireEvent.doubleClick(canvas);
    expect(request).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { value: canvas, configurable: true });
    fireEvent.doubleClick(canvas);
    expect(exit).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
  });
});
