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

describe('Player — panels fold open and shut', () => {
  // Animations the test finishes by hand, kept per element like the real ones
  type Anim = { el: HTMLElement; finished: Promise<void>; finish: () => void; cancel: () => void };
  let anims: Anim[] = [];
  beforeEach(() => {
    anims = [];
    vi.spyOn(HTMLElement.prototype, 'animate').mockImplementation(function (this: HTMLElement) {
      let done!: () => void, abort!: (e: unknown) => void;
      const finished = new Promise<void>((res, rej) => { done = res; abort = rej; });
      const a: Anim = {
        el: this, finished,
        finish: () => { anims = anims.filter((x) => x !== a); done(); },
        cancel: () => { anims = anims.filter((x) => x !== a); abort(new DOMException('cancelled', 'AbortError')); },
      };
      anims.push(a);
      return a as unknown as Animation;
    });
    vi.spyOn(HTMLElement.prototype, 'getAnimations').mockImplementation(function (this: HTMLElement) {
      return anims.filter((a) => a.el === this) as unknown as Animation[];
    });
  });
  const finishAll = () => act(async () => { [...anims].forEach((a) => a.finish()); });
  const click = (label: string) => act(async () => { fireEvent.click(screen.getByText(label)); });

  it('PL folds the playlist open, and shut before it goes', async () => {
    render(<Player initialTracks={TRACKS} />);
    await click('PL');
    expect(anims.map((a) => a.el)).toEqual([playlist()]);
    await finishAll();
    await click('PL');
    expect(playlist()).not.toBeNull(); // still folding shut
    await finishAll();
    expect(playlist()).toBeNull();
  });

  it('a click while it folds shut opens it again, from there', async () => {
    render(<Player initialTracks={TRACKS} />);
    await click('EQ');
    await finishAll();
    await click('EQ');
    await click('EQ');
    await finishAll();
    expect(eq()).not.toBeNull();
  });

  it("expanding folds open only what wasn't open, and collapsing shuts only that", async () => {
    render(<Player initialTracks={TRACKS} />);
    await click('PL');
    await finishAll();
    const fullscreen = windowProps.current.fullscreenAnimation as (el: HTMLElement, o: { isFullscreen: boolean }) => void;
    await act(async () => fullscreen(document.body, { isFullscreen: true }));
    expect(anims.map((a) => a.el)).toEqual([eq()]);
    await finishAll();
    await act(async () => fullscreen(document.body, { isFullscreen: false }));
    expect(anims.map((a) => a.el)).toEqual([eq()]);
    await finishAll();
    expect(eq()).toBeNull();
    expect(playlist()).not.toBeNull();
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

describe('Player — the timer', () => {
  it('shows time played, and a click switches to time left (with a minus) and back, reported', async () => {
    const onChange = vi.fn();
    render(<Player initialTracks={TRACKS} onTimeModeChange={onChange} />);
    const timer = screen.getByRole('button', { name: /Time played 0:00/ });
    await act(async () => { fireEvent.click(timer); });
    expect(timer.textContent).toBe('-0:00');
    expect(onChange).toHaveBeenLastCalledWith('remaining');
    await act(async () => { fireEvent.click(timer); });
    expect(timer.textContent).toBe('0:00');
    expect(onChange).toHaveBeenLastCalledWith('elapsed');
  });

  it('starts on time left when asked', () => {
    render(<Player initialTracks={TRACKS} defaultTimeMode="remaining" />);
    expect(screen.getByRole('button', { name: /Time left -0:00/ })).toBeTruthy();
  });
});

describe("Player — Winamp's keys", () => {
  const TWO = [
    { title: 'Rival Dealer', artist: 'Burial', src: '/rival.mp3' },
    { title: 'Archangel', artist: 'Burial', src: '/archangel.mp3' },
  ];
  // The Player's window (the Window stand-in in these tests)
  const inside = () => document.querySelector('.dd-player__body')!;
  const label = () => document.querySelector('.dd-player__neon')!.textContent;
  const press = (key: string, target: Element = document.body) => act(async () => { fireEvent.keyDown(target, { key }); });

  beforeEach(() => {
    // Inside the Player means inside its window
    vi.spyOn(Element.prototype, 'closest').mockImplementation(function (this: Element, sel: string) {
      if (sel === '.dd-window') return document.querySelector('[data-testid="window"]');
      return Element.prototype.matches.call(this, sel) ? this : null;
    });
  });

  it('B and Z go to the next and previous track, X plays, V stops', async () => {
    const start = vi.spyOn(AudioEngine.prototype, 'start');
    render(<Player initialTracks={TWO} />);
    await act(async () => { fireEvent.pointerDown(inside()); });
    await press('x');
    expect(start).toHaveBeenCalled();
    await press('b');
    expect(label()).toBe('Archangel — Burial');
    await press('Z');
    expect(label()).toBe('Rival Dealer — Burial');
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause');
    await press('v');
    expect(pause).toHaveBeenCalled();
  });

  it('does nothing once something else on the page was clicked', async () => {
    render(<Player initialTracks={TWO} />);
    await act(async () => { fireEvent.pointerDown(inside()); });
    await act(async () => { fireEvent.pointerDown(document.body); });
    await press('b');
    expect(label()).toBe('Rival Dealer — Burial');
  });

  it('leaves typing alone, and keys with Ctrl or ⌘', async () => {
    render(<Player initialTracks={TWO} />);
    await act(async () => { fireEvent.pointerDown(inside()); });
    const field = document.body.appendChild(document.createElement('input'));
    await press('b', field);
    await act(async () => { fireEvent.keyDown(document.body, { key: 'b', metaKey: true }); });
    expect(label()).toBe('Rival Dealer — Burial');
    field.remove();
  });
});

describe('Player — media keys and the lock screen (Media Session)', () => {
  const TWO = [
    { title: 'Rival Dealer', artist: 'Burial', src: '/rival.mp3', album: 'Rival Dealer', artwork: '/cover.jpg' },
    { title: 'Archangel', artist: 'Burial', src: '/archangel.mp3' },
  ];
  let session: { metadata: unknown; playbackState: string; setActionHandler: ReturnType<typeof vi.fn>; setPositionState: ReturnType<typeof vi.fn> };
  const handler = (action: string) => { const set = session.setActionHandler.mock.calls.filter(([a, h]) => a === action && h); return set[set.length - 1]![1] as () => void; };
  beforeEach(() => {
    session = { metadata: null, playbackState: 'none', setActionHandler: vi.fn(), setPositionState: vi.fn() };
    Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
    vi.stubGlobal('MediaMetadata', class { constructor(init: object) { Object.assign(this, init); } });
  });
  afterEach(() => { Reflect.deleteProperty(navigator, 'mediaSession'); });

  it('shows the track, with its album and artwork', () => {
    render(<Player initialTracks={TWO} />);
    expect(session.metadata).toMatchObject({ title: 'Rival Dealer', artist: 'Burial', album: 'Rival Dealer', artwork: [{ src: '/cover.jpg' }] });
  });

  it('the media keys work the Player, and next shows the new track', async () => {
    const start = vi.spyOn(AudioEngine.prototype, 'start');
    render(<Player initialTracks={TWO} />);
    await act(async () => { handler('play')(); });
    expect(start).toHaveBeenCalled();
    await act(async () => { handler('nexttrack')(); });
    expect(session.metadata).toMatchObject({ title: 'Archangel' });
    for (const a of ['pause', 'stop', 'previoustrack', 'seekto']) expect(handler(a)).toBeTypeOf('function');
  });

  it('lets go of the keys and the lock screen when it goes', () => {
    const { unmount } = render(<Player initialTracks={TWO} />);
    unmount();
    expect(session.setActionHandler).toHaveBeenCalledWith('play', null);
    expect(session.metadata).toBeNull();
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
