

const canvas = document.getElementById('glcanvas');
if (!canvas) throw new Error('Missing <canvas id="glcanvas"> in index.html');

let gl = /** @type {WebGL2RenderingContext|null} */ (null);
let program = /** @type {WebGLProgram|null} */ (null);
let vao = /** @type {WebGLVertexArrayObject|null} */ (null);
const ringCount = 9;
const verticesPerRing = 800;
let vertexCount = ringCount * verticesPerRing;
let timeLoc = /** @type {WebGLUniformLocation|null} */ (null);
let resolutionLoc = /** @type {WebGLUniformLocation|null} */ (null);
let fftLoc = /** @type {WebGLUniformLocation|null} */ (null);
let audioLoc = /** @type {WebGLUniformLocation|null} */ (null);
let vertexCountLoc = /** @type {WebGLUniformLocation|null} */ (null);
let audioLevelSmoothed = 0;
let fftTexture = /** @type {WebGLTexture|null} */ (null);
let fftSize = 0;
let fftData8 = /** @type {Uint8Array|null} */ (null);
let fftUpdateCounter = 0; // only update FFT every 2 frames

function isAudioActive() {
  const v = window.visualizer;
  const a = v && v.audio;
  return !!(a && !a.paused && !a.ended);
}
let rafId = 0; 
let isRunning = false; 
let isContextLost = false;


canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  isContextLost = true;
  isRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  // Every GL object died with the context. Drop the handles so start() rebuilds
  // them; otherwise ensureFftTexture() sees a truthy fftTexture and binds a
  // dead texture.
  program = null;
  vao = null;
  fftTexture = null;
  fftData8 = null;
  fftSize = 0;
  timeLoc = null;
  resolutionLoc = null;
  fftLoc = null;
  audioLoc = null;
  vertexCountLoc = null;
  console.warn('WebGL context lost');
});

canvas.addEventListener('webglcontextrestored', () => {
  console.warn('WebGL context restored');
  isContextLost = false;
  start();
});


// --- Shaders -----------------------------------------------------------------
const vsSource = `#version 300 es
in float a_vertexId;
uniform float u_vertexCount;
uniform float u_time;
uniform vec2 u_resolution;
uniform sampler2D u_fft;
uniform float u_audio;

out float v_vertexRatio;
out float v_ringId;
out float v_glow;

#define TAU 6.28318530718

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  // Divide 7200 vertices into 9 rings of 800 each
  float ringId = floor(a_vertexId / 800.0);  // 0-8
  v_ringId = ringId;
  float vertexInRing = mod(a_vertexId, 800.0);
  float vertexRatio = vertexInRing / 800.0;
  v_vertexRatio = vertexRatio;
  float vertexRadians = vertexRatio * 3.14159 * 2.0 + u_time * 0.1;
  
  float aspect = u_resolution.x / u_resolution.y;
  
  float fftVal;
  float baseRadius;
  if (ringId < 1.0) {
    fftVal = texture(u_fft, vec2(vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.01;
  } else if (ringId < 2.0) {
    fftVal = texture(u_fft, vec2(0.11 + vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.1;
  } else if (ringId < 3.0) {
    fftVal = texture(u_fft, vec2(0.22 + vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.19;
  } else if (ringId < 4.0) {
    fftVal = texture(u_fft, vec2(0.33 + vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.27;
  } else if (ringId < 5.0) {
    fftVal = texture(u_fft, vec2(0.44 + vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.36;
  } else if (ringId < 6.0) {
    fftVal = texture(u_fft, vec2(0.55 + vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.45;
  } else if (ringId < 7.0) {
    fftVal = texture(u_fft, vec2(0.66 + vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.53;
  } else if (ringId < 8.0) {
    fftVal = texture(u_fft, vec2(0.77 + vertexRatio * 0.11, 0.5)).r / 255.0;
    baseRadius = 0.61;
  } else {
    fftVal = texture(u_fft, vec2(0.88 + vertexRatio * 0.12, 0.5)).r / 255.0;
    baseRadius = 0.70;
  }
  
  // Expand radius based on FFT energy - large spikes for crown effect
  float expandAmount = fftVal * 1.8 + u_audio * 3.5;
  
  // Organic contour. Sampling the noise on the unit circle rather than on
  // vertexRatio keeps it seamless across the 0/1 wrap - a 1D sample would show
  // a visible seam where the loop closes. Time translates the sample point so
  // the filament drifts; ringId decorrelates the rings from each other.
  float ang = vertexRatio * TAU;
  vec2 dir = vec2(cos(ang), sin(ang));
  float n = fbm(dir * 2.5 + vec2(u_time * 0.15, ringId * 3.7));
  v_glow = n;

  // Same 0-0.6 envelope the old sine spike had, so loud passages stay in frame.
  expandAmount *= n * 0.6 + 0.05;

  // Wobble the resting radius too, so the rings are never perfect circles even
  // with no audio playing.
  float radius = baseRadius * (1.0 + (n - 0.5) * 0.25) + expandAmount;
  
  float x = cos(vertexRadians) * radius / aspect;
  float y = sin(vertexRadians) * radius;
  
  gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

const fsSource = `#version 300 es
precision highp float;
uniform sampler2D u_fft;
uniform float u_audio;
in float v_vertexRatio;
in float v_ringId;
in float v_glow;
out vec4 outColor;

void main() {
  // Color based on which ring (cycle through 3 colors)
  vec3 color;
  float colorRing = mod(v_ringId, 3.0);
  if (colorRing < 1.0) {
    // Inner ring: #ff4800
    color = vec3(1.0, 0.28, 0.0);
  } else if (colorRing < 2.0) {
    // Middle ring: #fb5607
    color = vec3(0.98, 0.34, 0.03);
  } else {
    // Outer ring: Orange
    color = vec3(1.0, 0.6, 0.0);
  }
  

  
  // Low base alpha: additive blending means overlapping strands accumulate into
  // the bright cores on their own, so a faint per-line alpha reads as fine
  // filaments instead of the solid mass a high one produced with points.
  // A 1px line deposits far less light than the old point sprites did (which
  // were 3-20px of soft falloff), and on a HiDPI buffer it covers half a CSS
  // pixel, so this sits high. Additive blending still builds the bright cores
  // where strands cross.
  float alpha = (0.80 + u_audio * 0.20) * (0.60 + 0.40 * v_glow);
  outColor = vec4(color, alpha);
}
`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!ok) {
    const info = gl.getShaderInfoLog(shader) || '(no log)';
    gl.deleteShader(shader);
    throw new Error('Shader compile failed:\n' + info);
  }

  return shader;
}

function createProgram(vsSrc, fsSrc) {
  const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);

  const p = gl.createProgram();
  if (!p) throw new Error('createProgram failed');

  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const ok = gl.getProgramParameter(p, gl.LINK_STATUS);
  if (!ok) {
    const info = gl.getProgramInfoLog(p) || '(no log)';
    gl.deleteProgram(p);
    throw new Error('Program link failed:\n' + info);
  }

  return p;
}

function createFullscreenTriangleVAO() {
  const positionLoc = gl.getAttribLocation(program, 'a_vertexId');
  if (positionLoc === -1) throw new Error('a_vertexId attribute not found');

  const localVao = gl.createVertexArray();
  if (!localVao) throw new Error('createVertexArray failed');
  gl.bindVertexArray(localVao);

  const buf = gl.createBuffer();
  if (!buf) throw new Error('createBuffer failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);

  // Create vertex IDs (0, 1, 2, ..., vertexCount-1)
  const vertexIds = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    vertexIds[i] = i;
  }
  
  gl.bufferData(gl.ARRAY_BUFFER, vertexIds, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 1, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  return localVao;
}

// Match the drawing buffer to the CSS box times the device pixel ratio, so a
// HiDPI screen gets a 1:1 buffer instead of an upscaled one. Cheap enough to
// call per frame, which also covers resizes and DPR changes between monitors.
function resizeCanvasToDisplaySize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  return dpr;
}

function ensureFftTexture(size) {
  if (!gl) return;
  if (!fftTexture) {
    fftTexture = gl.createTexture();
    if (!fftTexture) throw new Error('createTexture failed');
    gl.bindTexture(gl.TEXTURE_2D, fftTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } else {
    gl.bindTexture(gl.TEXTURE_2D, fftTexture);
  }

  if (size !== fftSize) {
    fftSize = size;
    fftData8 = new Uint8Array(size);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      size,
      1,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      fftData8
    );
  }
}

function updateFftTexture() {
  if (!gl) return;
  const v = window.visualizer;
  const audioPaused = !isAudioActive();
  
  fftUpdateCounter++;
  if (fftUpdateCounter < 2) return;
  fftUpdateCounter = 0;
  
  const analyser = v && v.analyser;
  if (!analyser || !analyser.frequencyBinCount) {
    ensureFftTexture(1);
    if (fftData8) fftData8[0] = 0;
    audioLevelSmoothed = audioLevelSmoothed * 0.9;
    gl.bindTexture(gl.TEXTURE_2D, fftTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RED, gl.UNSIGNED_BYTE, fftData8);
    return;
  }

  ensureFftTexture(analyser.frequencyBinCount);
  if (!fftData8) return;

  // getByteFrequencyData already normalizes dB to 0-255 against the analyser's
  // own minDecibels/maxDecibels, so it fills the upload buffer directly. While
  // paused we leave the last frame in place - u_time is frozen too, so the
  // figure holds its shape rather than collapsing.
  if (!audioPaused) analyser.getByteFrequencyData(fftData8);

  let bassAvg = 0;
  if (!audioPaused) {
    const bassCount = Math.max(1, Math.floor(fftData8.length * 0.1));
    let bassSum = 0;
    for (let i = 0; i < bassCount; i++) bassSum += fftData8[i];
    bassAvg = bassSum / (bassCount * 255);
  }
  audioLevelSmoothed = audioLevelSmoothed * 0.88 + bassAvg * 0.12;
  if (audioPaused && audioLevelSmoothed < 0.01) audioLevelSmoothed = 0;

  gl.bindTexture(gl.TEXTURE_2D, fftTexture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    fftSize,
    1,
    gl.RED,
    gl.UNSIGNED_BYTE,
    fftData8
  );
}

// --- Render loop -------------------------------------------------------------
function drawOnce(timeMs = 0) {
  if (isContextLost) return;

  resizeCanvasToDisplaySize();

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Enable alpha blending for smooth layered effect
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

  gl.useProgram(program);
  if (timeLoc) {
    const t = isAudioActive() ? timeMs * 0.001 : 0;
    gl.uniform1f(timeLoc, t);
  }
  if (resolutionLoc) {
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
  }
  if (vertexCountLoc) {
    gl.uniform1f(vertexCountLoc, vertexCount);
  }
  updateFftTexture();
  if (fftTexture && fftLoc) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fftTexture);
    gl.uniform1i(fftLoc, 0);
  }
  if (audioLoc) {
    gl.uniform1f(audioLoc, audioLevelSmoothed);
  }
  gl.bindVertexArray(vao);
  // LINE_LOOP closes each ring back to its first vertex; a single strip across
  // the whole buffer would instead stitch ring N's end to ring N+1's start.
  // Nine draw calls is negligible next to one draw of 7200 points.
  for (let ring = 0; ring < ringCount; ring++) {
    gl.drawArrays(gl.LINE_LOOP, ring * verticesPerRing, verticesPerRing);
  }
  gl.bindVertexArray(null);
}

function animate() {
  if (!isRunning) return;
  if (document.hidden) {
    rafId = requestAnimationFrame(animate);
    return;
  }

  drawOnce(performance.now());
  rafId = requestAnimationFrame(animate);
}


function start() {
  gl = canvas.getContext('webgl2');
  if (!gl) {
    document.body.textContent = 'WebGL2 is not supported in this browser.';
    throw new Error('WebGL2 not supported');
  }

  program = createProgram(vsSource, fsSource);
  timeLoc = gl.getUniformLocation(program, 'u_time');
  resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
  fftLoc = gl.getUniformLocation(program, 'u_fft');
  audioLoc = gl.getUniformLocation(program, 'u_audio');
  vertexCountLoc = gl.getUniformLocation(program, 'u_vertexCount');
  vao = createFullscreenTriangleVAO();

  // The canvas has no CSS size of its own, so its layout size would otherwise
  // follow the width/height attributes and feed back into the resize check.
  // Pin it to the parent box first.
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  resizeCanvasToDisplaySize();

  fftSize = 0;
  ensureFftTexture(1);


  isRunning = true;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animate);
}

start();

window.startVisualizerAnimation = function startVisualizerAnimation() {
  if (isContextLost) return;
  if (isRunning) return;
  isRunning = true;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(animate);
};

window.stopVisualizerAnimation = function stopVisualizerAnimation() {
  isRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
};
