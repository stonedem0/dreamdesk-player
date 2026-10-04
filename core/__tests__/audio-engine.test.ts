import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../audio-engine.js';
import { EQ_FREQS } from '../eq-presets.js';
import { FakeAudioContext, FakeAudioContextNoPanner, type FakeBiquad, type FakeNode } from '../../src/__tests__/fakeAudio';

// The real Web Audio types, swapped for the fakes the tests inspect
type FakeParts = 'audioContext' | 'source' | 'panner' | 'analyser' | 'eqFilters' | 'leftGain' | 'rightGain' | 'audio';
type Engine = Omit<AudioEngine, FakeParts> & {
  audioContext: FakeAudioContext;
  source: FakeNode;
  panner: FakeNode | null;
  analyser: FakeNode;
  eqFilters: FakeBiquad[];
  leftGain?: { gain: { value: number } };
  rightGain?: { gain: { value: number } };
  audio: HTMLAudioElement;
};

const make = (opts = {}) => new AudioEngine(null, opts) as unknown as Engine;

// Drive requestAnimationFrame by hand
let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('AudioEngine graph', () => {
  it('builds a 7-band EQ: low shelf, five peaking bands, high shelf', () => {
    const e = make();
    expect(e.eqFilters.map((f) => f.type)).toEqual(['lowshelf', 'peaking', 'peaking', 'peaking', 'peaking', 'peaking', 'highshelf']);
    expect(e.eqFilters.map((f) => f.frequency.value)).toEqual(EQ_FREQS);
    expect(e.eqFilters.every((f) => f.gain.value === 0)).toBe(true);
    expect(e.eqFilters[1].Q.value).toBe(1);
  });

  it('wires source → panner → EQ filters in order → analyser → speakers', () => {
    const e = make();
    const path: FakeNode[] = [e.source];
    let node = e.source;
    while (node.connected.length) { node = node.connected[0]; path.push(node); }
    expect(path).toEqual([e.source, e.panner, ...e.eqFilters, e.analyser, e.audioContext.destination]);
  });
});

describe('setEqGain', () => {
  it('sets a band, clamping the index and treating bad gains as 0', () => {
    const e = make();
    e.setEqGain(2, 6);
    expect(e.eqFilters[2].gain.value).toBe(6);
    e.setEqGain(99, -3);
    expect(e.eqFilters[6].gain.value).toBe(-3);
    e.setEqGain(-5, 4);
    expect(e.eqFilters[0].gain.value).toBe(4);
    e.setEqGain(1, Number.NaN);
    expect(e.eqFilters[1].gain.value).toBe(0);
  });
});

describe('setPan', () => {
  it('sets the stereo panner, clamped to -1…1', () => {
    const e = make();
    e.setPan(0.5);
    expect((e.panner as unknown as { pan: { value: number } }).pan.value).toBe(0.5);
    e.setPan(4);
    expect((e.panner as unknown as { pan: { value: number } }).pan.value).toBe(1);
  });

  it('falls back to an equal-power gain pair without a stereo panner', () => {
    vi.stubGlobal('AudioContext', FakeAudioContextNoPanner);
    const e = make();
    expect(e.panner).toBeNull();
    e.setPan(0);
    expect(e.leftGain!.gain.value).toBeCloseTo(Math.SQRT1_2);
    expect(e.rightGain!.gain.value).toBeCloseTo(Math.SQRT1_2);
    e.setPan(-1);
    expect(e.leftGain!.gain.value).toBeCloseTo(1);
    expect(e.rightGain!.gain.value).toBeCloseTo(0);
  });
});

describe('playback', () => {
  it('start resumes a suspended context, plays, and feeds processed frames to onFrame', async () => {
    const onFrame = vi.fn();
    const e = make({ onFrame });
    e.audioContext.state = 'suspended';
    await e.start();
    expect(e.audioContext.resume).toHaveBeenCalled();
    expect(e.audio.play).toHaveBeenCalled();

    frames[frames.length - 1](0);
    // The fake analyser reports -120 everywhere, clamped to -100
    expect(onFrame).toHaveBeenCalledOnce();
    const [data] = onFrame.mock.calls[0];
    expect(data).toHaveLength(1024);
    expect(data.every((v: number) => v === -100)).toBe(true);
  });

  it('start survives the browser refusing autoplay', async () => {
    const e = make();
    vi.mocked(e.audio.play).mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    await expect(e.start()).resolves.toBeUndefined();
  });

  it('stop rewinds, reports the time and draws a flat line', async () => {
    const onFrame = vi.fn();
    const onTime = vi.fn();
    const e = make({ onFrame, onTime });
    await e.start();
    e.audio.currentTime = 42;
    onFrame.mockClear();
    e.stop();
    expect(e.audio.pause).toHaveBeenCalled();
    expect(e.audio.currentTime).toBe(0);
    expect(onTime).toHaveBeenLastCalledWith(0, 0);
    const [flat] = onFrame.mock.calls[0];
    expect(new Set(flat).size).toBe(1);
  });

  it('dispose closes the context and is safe to call twice', () => {
    const e = make();
    e.dispose();
    e.audioContext.state = 'closed';
    expect(() => e.dispose()).not.toThrow();
    expect(e.audioContext.close).toHaveBeenCalledOnce();
  });
});
