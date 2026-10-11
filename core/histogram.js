/**
 * The little spectrum bars in the player's display.
 *
 * Takes a 2D context rather than finding its own canvas, so it stays
 * framework-agnostic: the vanilla page and the React package both hand it one.
 * Plain ESM with JSDoc, loadable by index.html without a build. See PLAN.md.
 */

/**
 * A gradient stop: an offset from 0 to 1, and a CSS colour.
 * @typedef {[number, string]} GradientStop
 */

/**
 * The default skin's pink-to-violet ramp, used when no skin supplies its own.
 * @type {GradientStop[]}
 */
export const DEFAULT_HISTOGRAM_STOPS = [
  [0.0, '#fa73ab'],
  [0.1, '#f26bc5'],
  [0.2, '#ea63dd'],
  [0.3, '#e25bf5'],
  [0.4, '#da53ff'],
  [0.5, '#d24bff'],
  [0.6, '#ca43ff'],
  [0.7, '#c23bff'],
  [0.8, '#ba33ff'],
  [1.0, '#b22bff'],
];

/**
 * Draw one frame of bars, mirrored about the bottom edge.
 *
 * @param {CanvasRenderingContext2D} ctx Cleared and drawn into.
 * @param {HTMLCanvasElement} canvas Read for its pixel dimensions.
 * @param {ArrayLike<number>} data This frame, already scaled by
 *   processAudioData.
 * @param {number[]} prevData The previous frame's smoothed values. Mutated in
 *   place - it is what carries the 80/20 smoothing across frames, so the same
 *   array has to come back every frame. Resized and zeroed when the bin count
 *   changes.
 * @param {GradientStop[]} [stops] The skin's ramp; defaults to
 *   DEFAULT_HISTOGRAM_STOPS.
 */
export function drawHistogram(ctx, canvas, data, prevData, stops = DEFAULT_HISTOGRAM_STOPS) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bufferLength = data.length;
  if (prevData.length !== bufferLength) {
    prevData.length = bufferLength;
    prevData.fill(0);
  }

  const barWidth = (canvas.width / bufferLength) * 10;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    prevData[i] = prevData[i] * 0.8 + data[i] * 0.2;

    const barHeight = Math.max((prevData[i] + 100) * 2, 10);
    const yTop = canvas.height - barHeight / 2;

    const grad = ctx.createLinearGradient(0, canvas.height, 0, yTop);
    for (const [p, c] of stops) grad.addColorStop(p, c);

    ctx.fillStyle = grad;
    ctx.fillRect(x, yTop, barWidth, barHeight / 2);
    x += barWidth + 1;
  }

  ctx.shadowBlur = 0;
}

/**
 * Draw one frame of the oscilloscope: the waveform as a line across the
 * display, Winamp's second visualizer mode. Coloured with the same ramp as the
 * bars, left to right.
 *
 * @param {CanvasRenderingContext2D} ctx Cleared and drawn into.
 * @param {HTMLCanvasElement} canvas Read for its pixel dimensions.
 * @param {ArrayLike<number>} wave Time-domain samples, 0-255 with 128 as
 *   silence (AnalyserNode.getByteTimeDomainData).
 * @param {GradientStop[]} [stops] The skin's ramp; defaults to
 *   DEFAULT_HISTOGRAM_STOPS.
 */
export function drawOscilloscope(ctx, canvas, wave, stops = DEFAULT_HISTOGRAM_STOPS) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!wave.length) return;

  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  for (const [p, c] of stops) grad.addColorStop(p, c);

  // Fewer points than samples: one per pixel column is all the display shows
  const points = Math.min(wave.length, Math.max(2, Math.round(canvas.width)));
  const step = wave.length / points;
  const mid = canvas.height / 2;

  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const v = (wave[Math.floor(i * step)] - 128) / 128;
    const x = (i / (points - 1)) * canvas.width;
    const y = mid - v * (mid - 1);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Winamp's visualizer modes, in the order a click cycles through them.
 * @typedef {'bars' | 'scope' | 'off'} VisualizerMode
 */

/** @type {VisualizerMode[]} */
export const VISUALIZER_MODES = ['bars', 'scope', 'off'];

/**
 * The mode after `mode`, as a click on the display moves on.
 * @param {VisualizerMode} mode
 * @returns {VisualizerMode}
 */
export function nextVisualizerMode(mode) {
  const i = VISUALIZER_MODES.indexOf(mode);
  return VISUALIZER_MODES[(i + 1) % VISUALIZER_MODES.length];
}
