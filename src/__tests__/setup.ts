import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { FakeAudioContext } from './fakeAudio';

// happy-dom has no Web Audio API and doesn't play media. Installed directly
// (not vi.stubGlobal) so tests' vi.unstubAllGlobals() keeps it.
Object.defineProperty(globalThis, 'AudioContext', { value: FakeAudioContext, writable: true, configurable: true });
// No network in tests: the player fetches tracks to work out their bitrate
Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn(async () => new Response(null, { status: 200, headers: { 'content-length': '4000000' } })),
  writable: true,
  configurable: true,
});
HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
HTMLMediaElement.prototype.pause = vi.fn();
HTMLMediaElement.prototype.load = vi.fn();

afterEach(cleanup);
