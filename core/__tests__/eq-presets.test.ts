import { describe, expect, it } from 'vitest';
import { EQ_FREQS, EQ_LABELS, EQ_PRESET_ORDER, EQ_PRESETS, WINAMP_10_BAND_PRESETS, map10BandTo7 } from '../eq-presets.js';

describe('map10BandTo7', () => {
  it('keeps matching bands and averages the pairs that share a slider', () => {
    expect(map10BandTo7([1, 2, 3, 5, 6, 7, 8, 10, 11, 13])).toEqual([1, 2, 4, 6, 7, 9, 12]);
  });

  it('treats missing or non-numeric bands as 0', () => {
    expect(map10BandTo7([4, NaN, 2])).toEqual([4, 0, 1, 0, 0, 0, 0]);
    expect(map10BandTo7(undefined as unknown as number[])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('EQ presets', () => {
  it('has a 7-band preset for every name in the menu order', () => {
    for (const name of EQ_PRESET_ORDER) {
      expect(EQ_PRESETS[name], name).toHaveLength(7);
      expect(EQ_PRESETS[name]).toEqual(map10BandTo7(WINAMP_10_BAND_PRESETS[name]));
    }
  });

  it('has one label per slider frequency', () => {
    expect(EQ_FREQS).toHaveLength(7);
    expect(EQ_LABELS).toHaveLength(7);
    expect(EQ_PRESETS.flat).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
