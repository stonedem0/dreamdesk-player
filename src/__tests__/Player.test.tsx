import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../core/index.js';
import { EQ_PRESETS } from '../../core/eq-presets.js';
import { Player } from '../Player';
import { SKINS } from '../skins';

// Stand-in for dreamdesk-ui's Window that records its props, so these tests
// cover the Player itself whatever dreamdesk-ui version is installed
const windowProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('dreamdesk-ui', () => ({
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
    expect(windowProps.current.onFullscreen).toBe(onFullscreenChange);
  });

  it('switches skin from the settings menu and reports it', async () => {
    const onSkinChange = vi.fn();
    render(<Player initialTracks={TRACKS} skin="tokyo-3-sunset" defaultFullscreen onSkinChange={onSkinChange} />);
    expect(windowProps.current.style).toMatchObject(SKINS['tokyo-3-sunset'].vars);

    await act(async () => { fireEvent.click(screen.getByTitle('Settings')); });
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: SKINS.pastelcore.label })); });
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
