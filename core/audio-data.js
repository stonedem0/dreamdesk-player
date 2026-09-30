/**
 * Turning raw analyser output into something the meters can draw.
 *
 * Plain ESM with JSDoc, loadable by index.html without a build. See PLAN.md.
 */

/**
 * Scale one frame of frequency data for display.
 *
 * The analyser reports dBFS, roughly -100 at silence up to 0 at full scale.
 * Anything at or below the floor is clamped there so a silent track draws a
 * flat line rather than spikes of noise; everything above is exaggerated by
 * half again, which is what makes the bars read at this canvas size.
 *
 * @param {ArrayLike<number>} data A frequency frame, e.g. from
 *   AnalyserNode.getFloatFrequencyData.
 * @returns {number[]} A new array; the input is not modified.
 */
export function processAudioData(data) {
  const length = data.length;
  const result = new Array(length);

  for (let i = 0; i < length; i++) {
    const x = data[i];
    result[i] = x < -100 ? -100 : x * 1.5;
  }

  return result;
}
