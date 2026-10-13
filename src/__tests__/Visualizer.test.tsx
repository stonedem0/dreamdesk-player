import { act, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
  const sized = (el: HTMLElement, h: number) => Object.defineProperty(el, 'offsetHeight', { value: h, configurable: true });

  it("takes the Player's height and follows it, until it's resized by hand", () => {
    let resized = () => {};
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { resized = cb; } observe() {} disconnect() {} });
    const player = sized(document.createElement('div'), 300);
    const { container } = render(<VisualizerWindow source={null} dockTo={() => player} />);
    expect(windowProps.current.height).toBe('300px');
    const own = container.querySelector<HTMLElement>('.dd-window')!;

    // The Player expands; the visualizer still matched it, so it grows too
    sized(own, 300); sized(player, 520);
    act(() => resized());
    expect(windowProps.current.height).toBe('520px');

    // Resized by hand: no longer follows
    sized(own, 400); sized(player, 300);
    act(() => resized());
    expect(windowProps.current.height).toBe('520px');
    vi.unstubAllGlobals();
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
