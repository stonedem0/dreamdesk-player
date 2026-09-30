/**
 * Stage 1 gate: prove core/ is behaviour-identical to BOTH copies it replaces
 * before either is deleted. The originals below are pasted verbatim from
 * player.js and src/Player.tsx at b74e05e (types stripped from the TSX one).
 */
import assert from 'node:assert/strict';
import {
  WINAMP_10_BAND_PRESETS as NEW_10,
  EQ_PRESET_ORDER as NEW_ORDER,
  EQ_PRESETS as NEW_PRESETS,
  map10BandTo7 as newMap,
  processAudioData as newProcess,
  drawHistogram as newDraw,
  DEFAULT_HISTOGRAM_STOPS,
} from '../index.js';

/* ───────── originals: player.js (vanilla) ───────── */

function oldProcessVanilla(data) {
  const length = data.length;
  const result = new Array(length);
  for (let i = 0; i < length; i++) {
    const x = data[i];
    result[i] = x < -100.0 ? -100.0 : x * 1.5;
  }
  return result;
}

const OLD_10_VANILLA = {
  flat:      [ 0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
  classical: [-1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0],
  club:      [ 0.0,  0.0,  3.0,  4.0,  4.0,  4.0,  3.0,  0.0,  0.0,  0.0],
  dance:     [ 5.0,  4.0,  1.0, -2.0, -1.0,  1.0,  3.0,  4.0,  5.0,  5.0],
  'laptop speakers/headphones': [ 3.0,  6.0,  4.0, -2.0, -1.0,  1.0,  3.0,  5.0,  7.0,  8.0],
  'large hall':[ 7.0,  7.0,  5.0,  5.0,  3.0,  1.0,  0.0,  0.0,  0.0,  0.0],
  party:     [ 4.0,  4.0,  1.0,  0.0,  0.0,  0.0,  1.0,  3.0,  4.0,  4.0],
  pop:       [-1.0,  2.0,  4.0,  5.0,  5.0,  4.0,  2.0,  0.0, -1.0, -1.0],
  reggae:    [ 0.0,  0.0,  0.0, -2.0,  0.0,  2.0,  2.0,  0.0,  0.0,  0.0],
  rock:      [ 5.0,  3.0, -2.0, -4.0, -2.0,  2.0,  6.0,  8.0,  8.0,  7.0],
  soft:      [ 2.0,  1.0,  0.0, -1.0, -1.0, -1.0,  0.0,  1.0,  2.0,  3.0],
  ska:       [-2.0,  0.0,  3.0,  3.0,  2.0,  1.0,  0.0,  0.0,  0.0,  0.0],
  'full bass':[10.0,  9.0,  7.0,  4.0,  0.0, -4.0, -6.0, -8.0, -8.0, -8.0],
  'soft rock':[ 4.0,  2.0, -1.0, -2.0, -1.0,  1.0,  3.0,  4.0,  6.0,  8.0],
  'full treble':[-8.0, -8.0, -8.0, -6.0, -4.0,  0.0,  4.0,  8.0,  9.0, 10.0],
  'full bass & treble':[10.0,  8.0,  6.0,  2.0, -2.0, -4.0, -2.0,  6.0,  8.0, 10.0],
  live:      [-4.0, -2.0,  0.0,  4.0,  4.0,  4.0,  2.0,  0.0, -2.0, -4.0],
  techno:    [ 4.0,  3.0,  2.0,  0.0, -2.0, -1.0,  1.0,  3.0,  4.0,  4.0],
};

function oldMapVanilla(values10) {
  const v = Array.isArray(values10) ? values10 : [];
  const safe = (idx) => Number.isFinite(v[idx]) ? v[idx] : 0;
  const avg = (a, b) => (safe(a) + safe(b)) / 2;
  return [safe(0), safe(1), avg(2, 3), safe(4), safe(5), avg(6, 7), avg(8, 9)];
}

const OLD_ORDER_VANILLA = [
  'flat','classical','club','dance','laptop speakers/headphones','large hall',
  'party','pop','reggae','rock','soft','ska','full bass','soft rock',
  'full treble','full bass & treble','live','techno',
];

// player.js drew the bars inline, reading its stops off window.
function oldDrawVanilla(ctx, canvas, data, prevData, gradientStops) {
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
    const yBottom = canvas.height;
    const grad = ctx.createLinearGradient(0, yBottom, 0, yTop);
    for (const [p, c] of gradientStops) grad.addColorStop(p, c);
    ctx.fillStyle = grad;
    ctx.fillRect(x, yTop, barWidth, barHeight / 2);
    x += barWidth + 1;
  }
  ctx.shadowBlur = 0;
}

/* ───────── originals: src/Player.tsx (React) ───────── */

function oldProcessReact(data) {
  const out = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    out[i] = x < -100 ? -100 : x * 1.5;
  }
  return out;
}

function oldMapReact(v) {
  const s = (i) => (Number.isFinite(v[i]) ? v[i] : 0);
  const avg = (a, b) => (s(a) + s(b)) / 2;
  return [s(0), s(1), avg(2, 3), s(4), s(5), avg(6, 7), avg(8, 9)];
}

function oldDrawReact(ctx, canvas, data, prevData, stops) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const len = data.length;
  if (prevData.length !== len) { prevData.length = len; prevData.fill(0); }
  const barW = (canvas.width / len) * 10;
  let x = 0;
  for (let i = 0; i < len; i++) {
    prevData[i] = prevData[i] * 0.8 + data[i] * 0.2;
    const barH = Math.max((prevData[i] + 100) * 2, 10);
    const yTop = canvas.height - barH / 2;
    const grad = ctx.createLinearGradient(0, canvas.height, 0, yTop);
    for (const [p, c] of stops) grad.addColorStop(p, c);
    ctx.fillStyle = grad;
    ctx.fillRect(x, yTop, barW, barH / 2);
    x += barW + 1;
  }
}

/* ───────── a context that records calls instead of painting ───────── */

function recordingCtx() {
  const log = [];
  const grad = () => ({ addColorStop: (p, c) => log.push(['addColorStop', p, c]) });
  return {
    log,
    clearRect: (...a) => log.push(['clearRect', ...a]),
    createLinearGradient: (...a) => { log.push(['createLinearGradient', ...a]); return grad(); },
    fillRect: (...a) => log.push(['fillRect', ...a]),
    set fillStyle(_v) { log.push(['fillStyle']); },
    set shadowBlur(v) { log.push(['shadowBlur', v]); },
  };
}

/* ───────── the checks ───────── */

let checks = 0;
const ok = (name) => { checks++; console.log(`  ok  ${name}`); };

// 1. constants
assert.deepEqual(NEW_10, OLD_10_VANILLA);
ok('WINAMP_10_BAND_PRESETS matches player.js');
assert.deepEqual(NEW_ORDER, OLD_ORDER_VANILLA);
ok('EQ_PRESET_ORDER matches player.js');

// 2. map10BandTo7 over every real preset and a pile of hostile inputs
const hostile = [
  undefined, null, 'nope', 42, {}, [],
  [1], [1, 2, 3],
  [NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [Infinity, -Infinity, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  new Array(10).fill(-0),
];
for (const key of OLD_ORDER_VANILLA) {
  assert.deepEqual(newMap(OLD_10_VANILLA[key]), oldMapVanilla(OLD_10_VANILLA[key]));
  assert.deepEqual(newMap(OLD_10_VANILLA[key]), oldMapReact(OLD_10_VANILLA[key]));
}
ok(`map10BandTo7 matches both copies on all ${OLD_ORDER_VANILLA.length} presets`);
for (const input of hostile) {
  assert.deepEqual(newMap(input), oldMapVanilla(input));
}
ok(`map10BandTo7 matches player.js on ${hostile.length} malformed inputs`);

// 3. the derived 7-band table, whole
const oldPresetsVanilla = Object.fromEntries(
  OLD_ORDER_VANILLA.map((k) => [k, oldMapVanilla(OLD_10_VANILLA[k])])
);
assert.deepEqual(NEW_PRESETS, oldPresetsVanilla);
ok('EQ_PRESETS table is identical');

// 4. processAudioData over edges + 2000 random frames
const edges = [-Infinity, -1e9, -100.0000001, -100, -99.9999999, -50, -0, 0, 12.5, 1e9, Infinity, NaN];
assert.deepEqual(newProcess(edges), oldProcessVanilla(edges));
assert.deepEqual(newProcess(edges), oldProcessReact(edges));
ok('processAudioData matches both copies on boundary values');

for (let t = 0; t < 2000; t++) {
  const n = 1 + Math.floor(Math.random() * 64);
  const frame = Float32Array.from({ length: n }, () => Math.random() * 260 - 160);
  const a = newProcess(frame), b = oldProcessVanilla(frame), c = oldProcessReact(frame);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
}
ok('processAudioData matches both copies over 2000 random frames');

// 5. drawHistogram: compare the exact sequence of canvas calls
function drawLog(fn, stops, frames) {
  const ctx = recordingCtx();
  const canvas = { width: 100, height: 35 };
  const prev = [];
  for (const f of frames) fn(ctx, canvas, f, prev, stops);
  return { log: ctx.log, prev: [...prev] };
}
const frames = [];
for (let t = 0; t < 40; t++) {
  const n = t === 20 ? 48 : 32;            // force a mid-run bin-count change
  frames.push(Array.from({ length: n }, () => Math.random() * 100 - 100));
}
const vanillaRun = drawLog(oldDrawVanilla, DEFAULT_HISTOGRAM_STOPS, frames);
const coreRun    = drawLog(newDraw,        DEFAULT_HISTOGRAM_STOPS, frames);
assert.deepEqual(coreRun.log, vanillaRun.log);
assert.deepEqual(coreRun.prev, vanillaRun.prev);
ok('drawHistogram emits the identical call sequence to player.js (incl. resize + shadowBlur)');

const reactRun = drawLog(oldDrawReact, DEFAULT_HISTOGRAM_STOPS, frames);
const coreNoShadow = coreRun.log.filter(([m]) => m !== 'shadowBlur');
assert.deepEqual(coreNoShadow, reactRun.log);
assert.deepEqual(coreRun.prev, reactRun.prev);
ok('drawHistogram matches Player.tsx too (which omitted the shadowBlur reset)');

// 6. the default stops are the ones player.js had inline
assert.equal(DEFAULT_HISTOGRAM_STOPS.length, 10);
assert.deepEqual(DEFAULT_HISTOGRAM_STOPS[0], [0.0, '#fa73ab']);
assert.deepEqual(DEFAULT_HISTOGRAM_STOPS[9], [1.0, '#b22bff']);
ok('DEFAULT_HISTOGRAM_STOPS matches the fallback that was inline in player.js');

console.log(`\n${checks} checks passed.`);
