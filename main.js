

const canvas = document.getElementById('glcanvas');
if (!canvas) throw new Error('Missing <canvas id="glcanvas"> in index.html');

let gl = /** @type {WebGL2RenderingContext|null} */ (null);
let program = /** @type {WebGLProgram|null} */ (null);
let vao = /** @type {WebGLVertexArrayObject|null} */ (null);
let vertexCount = 2400; // 3 rings × 800 vertices each for ultra-smooth lines
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

void main() {
  // Divide 2400 vertices into 3 rings of 800 each
  float ringId = floor(a_vertexId / 800.0);  // 0, 1, or 2
  v_ringId = ringId; // Pass to fragment shader for color
  float vertexInRing = mod(a_vertexId, 800.0); // 0-799 within each ring
  float vertexRatio = vertexInRing / 800.0; // 0 to 1 position in ring
  v_vertexRatio = vertexRatio;
  float vertexRadians = vertexRatio * 3.14159 * 2.0;
  
  float aspect = u_resolution.x / u_resolution.y;
  
  // Sample FFT at different ranges for each ring
  float fftVal;
  float baseRadius;
  if (ringId < 1.0) {
    // Inner ring: Bass (first 1/3 of frequencies)
    fftVal = texture(u_fft, vec2(vertexRatio * 0.33, 0.5)).r / 255.0;
    baseRadius = 0.1;
  } else if (ringId < 2.0) {
    // Middle ring: Midrange (middle 1/3)
    fftVal = texture(u_fft, vec2(0.33 + vertexRatio * 0.33, 0.5)).r / 255.0;
    baseRadius = 0.35;
  } else {
    // Outer ring: Treble (last 1/3 of frequencies)
    fftVal = texture(u_fft, vec2(0.66 + vertexRatio * 0.34, 0.5)).r / 255.0;
    baseRadius = 0.6;
  }
  
  // Expand radius based on FFT energy - large spikes for crown effect
  float expandAmount = fftVal * 1.8 + u_audio * 1.5;
  
  // Add jagged crown effect with sine wave spikes
  float spikeFreq = 40.0; // Number of spikes around the circle
  float spike = sin(vertexRatio * spikeFreq * 3.14159 * 1.0) * 0.3 + 0.3;
  expandAmount *= spike; // Modulate expansion by spike pattern
  
  float radius = baseRadius + expandAmount;
  
  float x = cos(vertexRadians) * radius / aspect;
  float y = sin(vertexRadians) * radius;
  
  gl_Position = vec4(x, y, 0.0, 1.0);
  
  // Point size - very thin rings
  float pointSize = 6.0 + fftVal * fftVal * 18.0 + u_audio * 14.0;
  gl_PointSize = max(6.0, pointSize);
}
`;

const fsSource = `#version 300 es
precision highp float;
uniform sampler2D u_fft;
uniform float u_audio;
in float v_vertexRatio;
in float v_ringId;
out vec4 outColor;

void main() {
  // Draw circle point with soft edges
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  if (dist > 0.5) discard;
  
  // Soft circle
  float alpha = 1.0 - dist * 2.0;
  
  // Color based on which ring
  vec3 color;
  if (v_ringId < 1.0) {
    // Inner ring: #ff0054
    color = vec3(1.0, 0.0, 0.33);
  } else if (v_ringId < 2.0) {
    // Middle ring: #fb5607
    color = vec3(0.98, 0.34, 0.03);
  } else {
    // Outer ring: Orange
    color = vec3(1.0, 0.6, 0.0);
  }
  
  // Brighten on bass hit - add glow
  float glow = u_audio * 2.0;
  color += vec3(0.5, 0.5, 1.0) * glow;
  
  outColor = vec4(color, alpha * 0.8 + u_audio * 0.5);
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
  
  if (!audioPaused && v && v.analyser && v.dataArray) {
    v.analyser.getFloatFrequencyData(v.dataArray);
  }

  const src = v && v.dataArray;
  if (!src || !src.length) {
    ensureFftTexture(1);
    if (fftData8) fftData8[0] = 0;
    audioLevelSmoothed = audioLevelSmoothed * 0.9;
    gl.bindTexture(gl.TEXTURE_2D, fftTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RED, gl.UNSIGNED_BYTE, fftData8);
    return;
  }

  ensureFftTexture(src.length);
  if (!fftData8) return;

  for (let i = 0; i < src.length; i++) {
    const db = src[i];
    const norm = Math.min(1, Math.max(0, (db + 100) / 100));
    fftData8[i] = Math.floor(norm * 255);
  }

  let bassAvg = 0;
  if (!audioPaused) {
    const bassCount = Math.max(1, Math.floor(src.length * 0.1));
    let bassSum = 0;
    for (let i = 0; i < bassCount; i++) {
      const db = src[i];
      const norm = Math.min(1, Math.max(0, (db + 100) / 100));
      bassSum += norm;
    }
    bassAvg = bassSum / bassCount;
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

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

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
  updateFftTexture(); // SLOW - calls getFloatFrequencyData
  if (fftTexture && fftLoc) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fftTexture);
    gl.uniform1i(fftLoc, 0);
  }
  if (audioLoc) {
    gl.uniform1f(audioLoc, audioLevelSmoothed);
  }
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.POINTS, 0, vertexCount);
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
