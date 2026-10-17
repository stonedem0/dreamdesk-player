import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeLength } from '../trackLength';

// The <audio> the probe makes: the test fires its events
let made: HTMLAudioElement[] = [];
const OrigAudio = globalThis.Audio;
vi.stubGlobal('Audio', class extends OrigAudio { constructor() { super(); made.push(this as HTMLAudioElement); } });
afterEach(() => { made = []; });
const withDuration = (a: HTMLAudioElement, d: number) => Object.defineProperty(a, 'duration', { value: d, configurable: true });

describe('probeLength', () => {
  it("reads the length from the file's header, without playing it", async () => {
    const length = probeLength('/song.mp3');
    const audio = made[0]!;
    expect(audio.preload).toBe('metadata');
    expect(audio.getAttribute('src')).toBe('/song.mp3');
    withDuration(audio, 347.6);
    audio.dispatchEvent(new Event('loadedmetadata'));
    expect(await length).toBe(348);
    // Lets go of the file
    expect(audio.hasAttribute('src')).toBe(false);
  });

  it("is 0 when it can't tell: an unreadable file, or a stream", async () => {
    const broken = probeLength('/broken.mp3');
    made[0]!.dispatchEvent(new Event('error'));
    expect(await broken).toBe(0);
    const stream = probeLength('/live');
    withDuration(made[1]!, Infinity);
    made[1]!.dispatchEvent(new Event('loadedmetadata'));
    expect(await stream).toBe(0);
  });

  it('stops, as 0, when aborted', async () => {
    const ctrl = new AbortController();
    const length = probeLength('/song.mp3', ctrl.signal);
    ctrl.abort();
    expect(await length).toBe(0);
    ctrl.abort();
    expect(await probeLength('/other.mp3', ctrl.signal)).toBe(0);
  });
});
