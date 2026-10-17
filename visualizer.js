// A self-contained WebGL2 audio visualizer. Deliberately free of any reference
// to a particular player: the canvas and the audio source are passed in, so the
// same file backs both the static page and the React package.

// --- Shaders -----------------------------------------------------------------
const vsSource = `#version 300 es
in float a_vertexId;
uniform float u_vertexCount;
// 0 = crisp line pass, 1 = soft glow pass. A uniform, so the branch in the
// fragment shader is uniform control flow and gl_PointCoord stays legal.
uniform float u_mode;
uniform float u_pixelRatio;
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

  // Only meaningful when drawing POINTS. Scales with the backing store so the
  // halo keeps the same visual size on a HiDPI canvas.
  //
  // Sized as a compromise: this is 7200 points of mostly-transparent fill every
  // frame and the cost grows with the square of the radius, but the spread is
  // also what reads as glow - halving it washed the effect out. 40px (80 at
  // dpr 2) keeps the halo while shading about half the fragments of the 58px
  // this started at.
  gl_PointSize = (8.0 + fftVal * 18.0 + u_audio * 14.0) * u_pixelRatio;
}
`;

const fsSource = `#version 300 es
precision highp float;
uniform sampler2D u_fft;
uniform float u_audio;
in float v_vertexRatio;
in float v_ringId;
in float v_glow;
uniform float u_mode;
// The rings cycle through three colours (options.colors)
uniform vec3 u_colors[3];
out vec4 outColor;

void main() {
  float colorRing = mod(v_ringId, 3.0);
  vec3 color = colorRing < 1.0 ? u_colors[0] : colorRing < 2.0 ? u_colors[1] : u_colors[2];

  float alpha;
  if (u_mode > 0.5) {
    // Glow pass: a fat point with a soft radial falloff and a very low alpha.
    // Additive blending stacks thousands of these into a halo beneath the
    // lines - a bloom without the cost of a second framebuffer.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float falloff = 1.0 - r;
    alpha = falloff * falloff * (0.06 + u_audio * 0.10);
  } else {
    // A 1px line deposits far less light than a point sprite, and on a HiDPI
    // buffer it covers half a CSS pixel, so this sits high. Additive blending
    // still builds the bright cores where strands cross.
    alpha = (0.80 + u_audio * 0.20) * (0.60 + 0.40 * v_glow);
  }
  outColor = vec4(color, alpha);
}
`;

/**
 * @param {object} options
 * @param {HTMLCanvasElement} [options.canvas]  Canvas to render into. Required;
 *        validated at runtime so a bare createVisualizer() still explains itself.
 * @param {() => (AnalyserNode|null|undefined)} [options.getAnalyser]
 *        Looked up per frame rather than captured, so the visualizer can be
 *        created before the audio graph exists.
 * @param {() => (HTMLAudioElement|null|undefined)} [options.getAudio]
 *        Used only to tell playing from paused from stopped.
 * @param {(err: Error) => void} [options.onError]
 *        Called instead of throwing when WebGL2 is unavailable.
 * @param {[number, number, number]} [options.background]
 *        Clear colour, as 0-1 per channel (so 0.07 lands near #12). The canvas
 *        is opaque, so this covers whatever the element sits on; the default is
 *        a near-black warm tone rather than pure black, which reads as a hole
 *        next to the sunset skin.
 * @param {[number, number, number][]} [options.colors]
 *        The three colours the rings cycle through, 0-1 per channel. The
 *        default is the sunset skin's oranges.
 * @returns {{ start: () => void, stop: () => void, destroy: () => void,
 *   setColors: (colors: [number, number, number][], background?: [number, number, number]) => void }}
 */
export function createVisualizer(options = {}) {
  const {
    canvas: canvasOption,
    getAnalyser = () => null,
    getAudio = () => null,
    onError = null,
    background: initialBackground = [0.07, 0.035, 0.023],
    colors: initialColors = [[1.0, 0.28, 0.0], [0.98, 0.34, 0.03], [1.0, 0.6, 0.0]],
  } = options;
  // Changeable while running (a skin change), so read per frame
  let background = initialBackground;
  let colors = initialColors;

  if (!canvasOption) throw new Error('createVisualizer: options.canvas is required');
  const canvas = canvasOption;

  let gl = /** @type {WebGL2RenderingContext|null} */ (null);
  let program = /** @type {WebGLProgram|null} */ (null);
  let vao = /** @type {WebGLVertexArrayObject|null} */ (null);
  let vertexBuffer = /** @type {WebGLBuffer|null} */ (null);
  const ringCount = 9;
  const verticesPerRing = 800;
  let vertexCount = ringCount * verticesPerRing;
  let timeLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let resolutionLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let fftLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let audioLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let vertexCountLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let modeLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let pixelRatioLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let colorsLoc = /** @type {WebGLUniformLocation|null} */ (null);
  let audioLevelSmoothed = 0;
  // Animation time runs only while the music plays, so a pause holds the last
  // frame and playing on carries on from it rather than jumping
  let playTime = 0;
  let lastFrameMs = /** @type {number|null} */ (null);
  let fftTexture = /** @type {WebGLTexture|null} */ (null);
  let fftSize = 0;
  let fftData8 = /** @type {Uint8Array<ArrayBuffer>|null} */ (null);
  let fftUpdateCounter = 0; // only update FFT every 2 frames

  // player.js implements stop() as pause() + currentTime = 0, so a stopped
  // transport is distinguishable from a paused one by the playhead sitting at the
  // start. Nothing loaded yet counts as stopped too.
  function isAudioStopped() {
    const a = getAudio();
    if (!a) return true;
    return !!(a.ended || (a.paused && !a.currentTime));
  }

  function isAudioActive() {
    const a = getAudio();
    return !!(a && !a.paused && !a.ended);
  }
  let rafId = 0; 
  let isRunning = false; 
  let isContextLost = false;


  /** @param {Event} e */
  function handleContextLost(e) {
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
    modeLoc = null;
    pixelRatioLoc = null;
    colorsLoc = null;
    // Also drop the context itself, so start() knows to rebuild rather than
    // reuse a dead one.
    gl = null;
    console.warn('WebGL context lost');
  }

  function handleContextRestored() {
    console.warn('WebGL context restored');
    isContextLost = false;
    start();
  }

  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);

  /**
   * @param {GLenum} type
   * @param {string} source
   */
  function compileShader(type, source) {
    if (!gl) throw new Error('compileShader: no WebGL2 context');
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

  /**
   * @param {string} vsSrc
   * @param {string} fsSrc
   */
  function createProgram(vsSrc, fsSrc) {
    if (!gl) throw new Error('createProgram: no WebGL2 context');
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
    if (!gl) throw new Error('createFullscreenTriangleVAO: no WebGL2 context');
    if (!program) throw new Error('createFullscreenTriangleVAO: no program');
    const positionLoc = gl.getAttribLocation(program, 'a_vertexId');
    if (positionLoc === -1) throw new Error('a_vertexId attribute not found');

    const localVao = gl.createVertexArray();
    if (!localVao) throw new Error('createVertexArray failed');
    gl.bindVertexArray(localVao);

    const buf = gl.createBuffer();
    vertexBuffer = buf;
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
      if (gl) gl.viewport(0, 0, w, h);
    }
    return dpr;
  }

  /** @param {number} size */
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
    const audioPaused = !isAudioActive();
    // Paused: the texture and the level keep the last frame's values
    if (audioPaused && fftData8) return;
  
    fftUpdateCounter++;
    if (fftUpdateCounter < 2) return;
    fftUpdateCounter = 0;
  
    const analyser = getAnalyser();
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
    // own minDecibels/maxDecibels, so it fills the upload buffer directly.
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
    if (!gl || !program) return;

    const dpr = resizeCanvasToDisplaySize();

    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Stopped means an empty screen, not a frozen figure. Zero the retained FFT
    // frame as well, so starting playback again doesn't flash the old shape.
    if (isAudioStopped()) {
      if (fftData8) fftData8.fill(0);
      audioLevelSmoothed = 0;
      playTime = 0;
      lastFrameMs = null;
      return;
    }
  
    // Enable alpha blending for smooth layered effect
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.useProgram(program);
    if (colorsLoc) gl.uniform3fv(colorsLoc, colors.flat());
    if (isAudioActive()) {
      // Capped, so a tab left in the background doesn't skip ahead
      if (lastFrameMs !== null) playTime += Math.min(timeMs - lastFrameMs, 100) * 0.001;
      lastFrameMs = timeMs;
    } else {
      lastFrameMs = null;
    }
    if (timeLoc) gl.uniform1f(timeLoc, playTime);
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
    if (pixelRatioLoc) {
      gl.uniform1f(pixelRatioLoc, dpr);
    }

    // Glow pass first: the same vertices as fat soft points, laid down under
    // the lines so additive blending builds a halo around them.
    if (modeLoc) gl.uniform1f(modeLoc, 1.0);
    gl.drawArrays(gl.POINTS, 0, vertexCount);

    // LINE_LOOP closes each ring back to its first vertex; a single strip across
    // the whole buffer would instead stitch ring N's end to ring N+1's start.
    // Nine draw calls is negligible next to one draw of 7200 points.
    if (modeLoc) gl.uniform1f(modeLoc, 0.0);
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


  // Build the GL resources. Split out of start() so start() can resume an
  // already-initialised visualizer without rebuilding the program and VAO.
  function init() {
    gl = canvas.getContext('webgl2');
    if (!gl) {
      const err = new Error('WebGL2 not supported');
      // Reporting beats replacing document.body: a missing visualizer should not
      // take the rest of the page down with it.
      if (onError) {
        onError(err);
        return false;
      }
      throw err;
    }

    program = createProgram(vsSource, fsSource);
    timeLoc = gl.getUniformLocation(program, 'u_time');
    resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    fftLoc = gl.getUniformLocation(program, 'u_fft');
    audioLoc = gl.getUniformLocation(program, 'u_audio');
    vertexCountLoc = gl.getUniformLocation(program, 'u_vertexCount');
    modeLoc = gl.getUniformLocation(program, 'u_mode');
    pixelRatioLoc = gl.getUniformLocation(program, 'u_pixelRatio');
    colorsLoc = gl.getUniformLocation(program, 'u_colors');
    vao = createFullscreenTriangleVAO();

    // The canvas must have a CSS size of its own, or its layout size follows the
    // width/height attributes and feeds back into the resize check. styles.css
    // sizes #glcanvas against the dock minus the header.
    resizeCanvasToDisplaySize();

    fftSize = 0;
    ensureFftTexture(1);
    return true;
  }

  function start() {
    if (isContextLost) return;
    if (!gl && !init()) return;
    isRunning = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(animate);
  }

  function stop() {
    isRunning = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // Release everything. Needed by any caller that unmounts - a React effect
  // cleanup, say - since without it each mount leaks a GL context and a render
  // loop.
  function destroy() {
    stop();
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    if (gl) {
      if (program) gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      if (fftTexture) gl.deleteTexture(fftTexture);
    }
    program = null;
    vao = null;
    vertexBuffer = null;
    fftTexture = null;
    fftData8 = null;
    fftSize = 0;
    gl = null;
  }

  /**
   * New ring colours (and clear colour), from the next frame.
   * @param {[number, number, number][]} next
   * @param {[number, number, number]} [nextBackground]
   */
  function setColors(next, nextBackground) {
    colors = next;
    if (nextBackground) background = nextBackground;
  }

  return { start, stop, destroy, setColors };
}
