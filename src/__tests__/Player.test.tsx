import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../core/index.js';
import { EQ_PRESETS } from '../../core/eq-presets.js';
import { Player } from '../Player';
import { SKINS } from '../skins';

// Stand-in for @dreamdesk/ui's Window that records its props, so these tests
// cover the Player itself whatever dreamdesk-ui version is installed
const windowProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@dreamdesk/ui', () => ({
  Window: (props: Record<string, unknown> & { children?: ReactNode }) => {
    windowProps.current = props;
    return <div data-testid="window">{props.children}</div>;
  },
}));

const TRACKS = [{ title: 'Rival Dealer', artist: 'Burial', src: '/rival.mp3' }];

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const playlist = () => document.querySelector('.dd-player__playlist');
const eq = () => document.querySelector('.dd-player__eq');

describe('Player', () => {
  it('gives its window the right props', () => {
    const onMove = vi.fn();
    const onClose = vi.fn();
    render(<Player initialTracks={TRACKS} initialX={40} initialY={60} onMove={onMove} onClose={onClose} />);
    const p = windowProps.current;
    expect(p.compactLayout).toBe('fit');
    expect(p.fullscreenMode).toBe('expand');
    expect(p.resizable).toBe(false);
    expect(p.onMove).toBe(onMove);
    expect(p.onClose).toBe(onClose);
    expect(p.style).toMatchObject({ position: 'absolute', left: 40, top: 60 });
  });

  it('starts collapsed, and PL / EQ toggle the playlist and equalizer', async () => {
    render(<Player initialTracks={TRACKS} />);
    expect(playlist()).toBeNull();
    expect(eq()).toBeNull();
    await act(async () => { fireEvent.click(screen.getByText('PL')); });
    expect(playlist()).not.toBeNull();
    await act(async () => { fireEvent.click(screen.getByText('EQ')); });
    expect(eq()).not.toBeNull();
  });

  it('starts expanded with defaultFullscreen, and reports fullscreen changes', () => {
    const onFullscreenChange = vi.fn();
    render(<Player initialTracks={TRACKS} defaultFullscreen onFullscreenChange={onFullscreenChange} />);
    expect(playlist()).not.toBeNull();
    expect(eq()).not.toBeNull();
    expect(windowProps.current.defaultFullscreen).toBe(true);
    act(() => (windowProps.current.onFullscreen as (fs: boolean) => void)(false));
    expect(onFullscreenChange).toHaveBeenCalledWith(false);
  });

  it('switches skin from the settings menu and reports it', async () => {
    const onSkinChange = vi.fn();
    render(<Player initialTracks={TRACKS} skin="tokyo-3-sunset" defaultFullscreen onSkinChange={onSkinChange} />);
    expect(windowProps.current.style).toMatchObject(SKINS['tokyo-3-sunset'].vars);

    // Winamp's way: right-click the player, Skins
    await act(async () => { fireEvent.contextMenu(document.querySelector('.dd-player__body')!); });
    await act(async () => { fireEvent.click(screen.getByRole('menuitemcheckbox', { name: SKINS.pastelcore.label })); });
    expect(onSkinChange).toHaveBeenCalledWith('pastelcore');
    expect(windowProps.current.style).toMatchObject(SKINS.pastelcore.vars);
  });

  it('sends EQ slider and preset changes to the audio engine', async () => {
    const setEqGain = vi.spyOn(AudioEngine.prototype, 'setEqGain');
    render(<Player initialTracks={TRACKS} defaultFullscreen />);

    const sliders = document.querySelectorAll<HTMLInputElement>('.dd-player__eq-slider');
    expect(sliders).toHaveLength(7);
    await act(async () => { fireEvent.change(sliders[3], { target: { value: '6' } }); });
    expect(setEqGain).toHaveBeenCalledWith(3, 6);

    const preset = Object.keys(EQ_PRESETS).find((k) => k !== 'flat')!;
    await act(async () => { fireEvent.click(screen.getByText('presets ▾')); });
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(`^${preset}$`, 'i') })); });
    EQ_PRESETS[preset].forEach((gain: number, i: number) => expect(setEqGain).toHaveBeenCalledWith(i, gain));
  });

  it('disposes the audio engine when it unmounts', () => {
    const dispose = vi.spyOn(AudioEngine.prototype, 'dispose');
    const { unmount } = render(<Player initialTracks={TRACKS} />);
    unmount();
    expect(dispose).toHaveBeenCalled();
  });
});

describe('Player — the playlist, Winamp style', () => {
  const MANY = [
    { title: 'Rival Dealer', artist: 'Burial', src: '/rival.mp3' },
    { title: 'Archangel', artist: 'Burial', src: '/archangel.mp3' },
    { title: 'Blue Monday', artist: 'New Order', src: '/blue.mp3' },
  ];
  const rows = () => [...document.querySelectorAll('.dd-player__track-items li')];
  const titles = () => rows().map((r) => r.textContent);
  const selectedRows = () => rows().filter((r) => r.classList.contains('selected')).map((r) => r.textContent);
  // The track shown as playing
  const nowPlaying = () => document.querySelector('.dd-player__neon')!.textContent;
  const choose = async (menu: string, item: string) => {
    await act(async () => { fireEvent.click(screen.getByTitle(menu)); });
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: item })); });
  };

  it('a click selects, a double-click plays', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    const before = nowPlaying();
    await act(async () => { fireEvent.click(rows()[1]); });
    expect(selectedRows()).toEqual(['Archangel — Burial']);
    expect(nowPlaying()).toBe(before);
    await act(async () => { fireEvent.doubleClick(rows()[1]); });
    expect(nowPlaying()).toContain('Archangel');
  });

  it('Ctrl/⌘-click and Shift-click select several', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    await act(async () => { fireEvent.click(rows()[0]); });
    await act(async () => { fireEvent.click(rows()[2], { shiftKey: true }); });
    expect(selectedRows()).toHaveLength(3);
    await act(async () => { fireEvent.click(rows()[1], { metaKey: true }); });
    expect(selectedRows()).toEqual(['Rival Dealer — Burial', 'Blue Monday — New Order']);
  });

  it('REM removes the selected tracks, crops to them, or clears the list', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    await act(async () => { fireEvent.click(rows()[1]); });
    await choose('Remove', 'Remove selected');
    expect(titles()).toEqual(['Rival Dealer — Burial', 'Blue Monday — New Order']);
    await act(async () => { fireEvent.click(rows()[1]); });
    await choose('Remove', 'Crop (keep selected)');
    expect(titles()).toEqual(['Blue Monday — New Order']);
    await choose('Remove', 'Clear playlist');
    expect(titles()).toEqual([]);
  });

  it('SEL selects all, none, or the rest', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    await choose('Select', 'Select all');
    expect(selectedRows()).toHaveLength(3);
    await choose('Select', 'Select none');
    expect(selectedRows()).toHaveLength(0);
    await act(async () => { fireEvent.click(rows()[0]); });
    await choose('Select', 'Invert selection');
    expect(selectedRows()).toEqual(['Archangel — Burial', 'Blue Monday — New Order']);
  });

  it('MISC sorts and reverses, keeping the playing track playing', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    await choose('Misc', 'Sort by title');
    expect(titles()).toEqual(['Archangel — Burial', 'Blue Monday — New Order', 'Rival Dealer — Burial']);
    // Rival Dealer was the current track, and still is, now last
    expect(rows()[2].classList.contains('active')).toBe(true);
    await choose('Misc', 'Reverse list');
    expect(titles()[0]).toBe('Rival Dealer — Burial');
  });

  it("greys out what doesn't apply, and closes the menu on a click elsewhere", async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    await act(async () => { fireEvent.click(screen.getByTitle('Remove')); });
    expect(screen.getByRole('menuitem', { name: 'Remove selected' })).toHaveProperty('disabled', true);
    await act(async () => { fireEvent.pointerDown(document.body); });
    expect(screen.getByTitle('Remove').getAttribute('aria-expanded')).toBe('false');
  });
});

describe('Player — right-click menu', () => {
  const MANY = [
    { title: 'Rival Dealer', artist: 'Burial', src: '/rival.mp3' },
    { title: 'Archangel', artist: 'Burial', src: '/archangel.mp3' },
  ];
  const openMenu = async () => {
    await act(async () => { fireEvent.contextMenu(document.querySelector('.dd-player__body')!, { clientX: 40, clientY: 40 }); });
  };

  it('has no settings button, and opens Winamp\'s main menu on right-click', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen skin="tokyo-3-sunset" />);
    expect(screen.queryByTitle('Settings')).toBeNull();
    await openMenu();
    const labels = [...document.querySelectorAll('.dd-player__main-menu button')].map((b) => b.textContent!.replace('✓', ''));
    expect(labels).toEqual(['Play', 'Pause', 'Stop', 'Previous', 'Next', 'Playlist', 'Equalizer', ...Object.values(SKINS).map((s) => s.label)]);
    expect(screen.getByRole('menuitemcheckbox', { name: /Playlist/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('menuitemcheckbox', { name: new RegExp(SKINS['tokyo-3-sunset'].label) }).getAttribute('aria-checked')).toBe('true');
  });

  it('toggles the panels, and closes on a click elsewhere or Escape', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    await openMenu();
    await act(async () => { fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Equalizer/ })); });
    expect(document.querySelector('.dd-player__main-menu')).toBeNull();
    await openMenu();
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    expect(document.querySelector('.dd-player__main-menu')).toBeNull();
    await openMenu();
    await act(async () => { fireEvent.pointerDown(document.body); });
    expect(document.querySelector('.dd-player__main-menu')).toBeNull();
  });

  it('plays the next track from the menu', async () => {
    render(<Player initialTracks={MANY} defaultFullscreen />);
    await openMenu();
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Next' })); });
    expect(document.querySelector('.dd-player__neon')!.textContent).toContain('Archangel');
  });
});

describe('Player — visualizer modes', () => {
  it('cycles bars, oscilloscope and off when the display is clicked, and reports it', async () => {
    const onChange = vi.fn();
    render(<Player initialTracks={TRACKS} onVisualizerModeChange={onChange} />);
    const viz = screen.getByRole('button', { name: /Visualizer: spectrum/ });
    await act(async () => { fireEvent.click(viz); });
    expect(onChange).toHaveBeenLastCalledWith('scope');
    expect(viz.getAttribute('aria-label')).toMatch(/oscilloscope/);
    await act(async () => { fireEvent.keyDown(viz, { key: 'Enter' }); });
    expect(onChange).toHaveBeenLastCalledWith('off');
    await act(async () => { fireEvent.click(viz); });
    expect(onChange).toHaveBeenLastCalledWith('bars');
  });

  it('starts in the mode it is given', () => {
    render(<Player initialTracks={TRACKS} defaultVisualizerMode="off" />);
    expect(screen.getByRole('button', { name: /Visualizer: off/ })).toBeTruthy();
  });
});

describe('Player — the WebGL visualizer window', () => {
  it('hands out its audio for a visualizer elsewhere, and takes it back when it goes', () => {
    const onAudioSource = vi.fn();
    const { unmount } = render(<Player initialTracks={TRACKS} onAudioSource={onAudioSource} />);
    const source = onAudioSource.mock.lastCall![0];
    expect(source.analyser).toBeTruthy();
    expect(source.audio).toBeInstanceOf(HTMLAudioElement);
    unmount();
    expect(onAudioSource).toHaveBeenLastCalledWith(null);
  });

  it("opens it from the right-click menu, Winamp's way, only when there is one", async () => {
    const { container, rerender } = render(<Player initialTracks={TRACKS} />);
    const menu = async () => { await act(async () => { fireEvent.contextMenu(container.querySelector('.dd-player__body')!); }); };
    await menu();
    expect(screen.queryByRole('menuitemcheckbox', { name: /Visualization/ })).toBeNull();
    await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
    const onToggle = vi.fn();
    rerender(<Player initialTracks={TRACKS} onVisualizerToggle={onToggle} visualizerOpen />);
    await menu();
    const item = screen.getByRole('menuitemcheckbox', { name: /Visualization/ });
    expect(item.getAttribute('aria-checked')).toBe('true');
    await act(async () => { fireEvent.click(item); });
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'VIZ' })).toBeNull();
  });

  it('expanding opens it with the playlist and EQ, and collapsing puts it back', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<Player initialTracks={TRACKS} onVisualizerToggle={onToggle} visualizerOpen={false} />);
    const onFullscreen = () => windowProps.current.onFullscreen as (fs: boolean) => void;
    act(() => onFullscreen()(true));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<Player initialTracks={TRACKS} onVisualizerToggle={onToggle} visualizerOpen />);
    act(() => onFullscreen()(false));
    expect(onToggle).toHaveBeenCalledTimes(2);
    // Already open before expanding: stays open after collapsing
    act(() => onFullscreen()(true));
    act(() => onFullscreen()(false));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
