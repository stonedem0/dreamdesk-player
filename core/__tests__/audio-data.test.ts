import { describe, expect, it } from 'vitest';
import { processAudioData } from '../audio-data.js';

describe('processAudioData', () => {
  it('clamps values below -100 to -100 and exaggerates the rest by 1.5×', () => {
    expect(processAudioData([-140, -60, 0])).toEqual([-100, -90, 0]);
  });

  // The doc comment says values "at or below the floor" are clamped, but the
  // check is `< -100`, so exactly -100 becomes -150. Pinned as-is for now.
  it('does not clamp exactly -100 (see comment)', () => {
    expect(processAudioData([-100])).toEqual([-150]);
  });

  it('returns a new array and leaves the input alone', () => {
    const input = new Float32Array([-50, -10]);
    const out = processAudioData(input);
    expect(out).toEqual([-75, -15]);
    expect(Array.from(input)).toEqual([-50, -10]);
  });
});
