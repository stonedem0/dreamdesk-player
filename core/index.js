/**
 * The framework-agnostic half of the player.
 *
 * Everything here is plain ESM with JSDoc types, so index.html can load it
 * directly with no build step and Player.tsx still type-checks against it.
 * View code - DOM wiring, TSX render - deliberately stays outside. See PLAN.md.
 */

export {
  WINAMP_10_BAND_PRESETS,
  EQ_PRESET_ORDER,
  EQ_PRESETS,
  EQ_FREQS,
  EQ_LABELS,
  map10BandTo7,
} from './eq-presets.js';

export { processAudioData } from './audio-data.js';

export {
  drawHistogram,
  drawOscilloscope,
  nextVisualizerMode,
  VISUALIZER_MODES,
  DEFAULT_HISTOGRAM_STOPS,
} from './histogram.js';

export { AudioEngine } from './audio-engine.js';
