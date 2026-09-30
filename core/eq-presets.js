/**
 * Winamp's EQ presets, and the mapping from their original ten bands down to
 * the seven this player exposes.
 *
 * Plain ESM with JSDoc rather than TypeScript, so index.html can load it with
 * no build step while Player.tsx still gets real types. See PLAN.md.
 */

/**
 * The presets as Winamp ships them, at ten bands.
 * @type {Record<string, number[]>}
 */
export const WINAMP_10_BAND_PRESETS = {
  flat:                         [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  classical:                    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  club:                         [ 0,  0,  3,  4,  4,  4,  3,  0,  0,  0],
  dance:                        [ 5,  4,  1, -2, -1,  1,  3,  4,  5,  5],
  'laptop speakers/headphones': [ 3,  6,  4, -2, -1,  1,  3,  5,  7,  8],
  'large hall':                 [ 7,  7,  5,  5,  3,  1,  0,  0,  0,  0],
  party:                        [ 4,  4,  1,  0,  0,  0,  1,  3,  4,  4],
  pop:                          [-1,  2,  4,  5,  5,  4,  2,  0, -1, -1],
  reggae:                       [ 0,  0,  0, -2,  0,  2,  2,  0,  0,  0],
  rock:                         [ 5,  3, -2, -4, -2,  2,  6,  8,  8,  7],
  soft:                         [ 2,  1,  0, -1, -1, -1,  0,  1,  2,  3],
  ska:                          [-2,  0,  3,  3,  2,  1,  0,  0,  0,  0],
  'full bass':                  [10,  9,  7,  4,  0, -4, -6, -8, -8, -8],
  'soft rock':                  [ 4,  2, -1, -2, -1,  1,  3,  4,  6,  8],
  'full treble':                [-8, -8, -8, -6, -4,  0,  4,  8,  9, 10],
  'full bass & treble':         [10,  8,  6,  2, -2, -4, -2,  6,  8, 10],
  live:                         [-4, -2,  0,  4,  4,  4,  2,  0, -2, -4],
  techno:                       [ 4,  3,  2,  0, -2, -1,  1,  3,  4,  4],
};

/**
 * Display order for the preset menu. Winamp's own order, which is not
 * alphabetical and is worth preserving.
 * @type {string[]}
 */
export const EQ_PRESET_ORDER = [
  'flat',
  'classical',
  'club',
  'dance',
  'laptop speakers/headphones',
  'large hall',
  'party',
  'pop',
  'reggae',
  'rock',
  'soft',
  'ska',
  'full bass',
  'soft rock',
  'full treble',
  'full bass & treble',
  'live',
  'techno',
];

/**
 * Downsample a ten-band preset to the seven bands in EQ_FREQS. The two pairs
 * that have no direct counterpart - 310/600 Hz and 6k/12k, plus 14k/16k at the
 * top - are averaged.
 *
 * @param {number[]} values10 A ten-band preset. A non-array, a short array or
 *   a non-finite entry all read as 0 rather than throwing, which is what the
 *   vanilla player did and what a hand-edited preset can produce.
 * @returns {number[]} Seven gains in dB, one per band in EQ_FREQS.
 */
export function map10BandTo7(values10) {
  const v = Array.isArray(values10) ? values10 : [];
  /** @param {number} idx */
  const safe = (idx) => (Number.isFinite(v[idx]) ? v[idx] : 0);
  /**
   * @param {number} a
   * @param {number} b
   */
  const avg = (a, b) => (safe(a) + safe(b)) / 2;

  return [
    safe(0),    // 60 Hz
    safe(1),    // 170 Hz
    avg(2, 3),  // ~350 Hz from 310 and 600
    safe(4),    // 1 kHz
    safe(5),    // 3 kHz
    avg(6, 7),  // ~10 kHz from 6k and 12k
    avg(8, 9),  // 16 kHz from 14k and 16k
  ];
}

/**
 * The presets at the seven bands the UI actually drives.
 * @type {Record<string, number[]>}
 */
export const EQ_PRESETS = Object.fromEntries(
  EQ_PRESET_ORDER.map((key) => [key, map10BandTo7(WINAMP_10_BAND_PRESETS[key])])
);

/**
 * Centre frequency of each biquad, in Hz.
 * @type {number[]}
 */
export const EQ_FREQS = [60, 170, 350, 1000, 3000, 10000, 16000];

/**
 * Short labels for those frequencies, as printed under the sliders.
 * @type {string[]}
 */
export const EQ_LABELS = ['60', '170', '350', '1k', '3k', '10k', '16k'];
