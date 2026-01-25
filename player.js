function processAudioData(data) {
    const length = data.length;
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      const x = data[i];
      result[i] = x < -100.0 ? -100.0 : x * 1.5;
    }
    return result;
  }
  
  // process audio data for radial visualization (for radial polygon in case I'll get theer))
  function processAudioDataForRadial(data) {
    const length = data.length;
    if (length === 0) return [];
  
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < length; i++) {
      const v = data[i];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  
    const range = maxVal - minVal;
    if (range === 0 || !isFinite(range)) {
      return new Array(length).fill(0);
    }
  
    const result = new Array(length);
    for (let i = 0; i < length; i++) {
      const x = data[i];
      result[i] = ((x - minVal) / range) * 200.0 - 100.0;
    }
    return result;
  }
  
  function processAndReduceAudioData(data) {
    const total = data.length;
    if (total === 0) return [];
  
    const targetSize = 800;
    const third = Math.floor(targetSize / 3);
  
    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = 0; i < total; i++) {
      const v = data[i];
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    const range = maxVal - minVal;
  
    const normalize = (x) => {
      if (range === 0 || !isFinite(range)) return 0;
      return ((x - minVal) / range) * 200.0 - 100.0;
    };
  
    const reduced = [];
  
    // First third (Bass)
    const firstCount = Math.min(third, total);
    for (let i = 0; i < firstCount; i++) {
      reduced.push(normalize(data[i]));
    }
  
    // Middle third (Midrange)
    const middleStart = Math.max(0, Math.floor(total / 2) - Math.floor(third / 2));
    const middleEnd = Math.min(total, middleStart + third);
    for (let i = middleStart; i < middleEnd; i++) {
      reduced.push(normalize(data[i]));
    }
  
    // Last third (Treble)
    const lastStart = Math.max(0, total - third);
    for (let i = lastStart; i < total; i++) {
      reduced.push(normalize(data[i]));
    }
  
    return reduced;
  }
  

  // FFT size options
  const fftSizes = new Map([
    [32, 32],
    [64, 64],
    [128, 128],
    [256, 256],
    [512, 512],
    [1024, 1024],
    [2048, 2048],
    [4096, 4096],
    [8192, 8192],
    [16384, 16384],
    [32768, 32768],
  ]);
  
  // Winamp-style EQ presets (10-band originals, downsampled to our 7-band UI)
  const WINAMP_10_BAND_PRESETS = {
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

  function map10BandTo7(values10) {
    const v = Array.isArray(values10) ? values10 : [];
    const safe = (idx) => Number.isFinite(v[idx]) ? v[idx] : 0;
    const avg = (a, b) => (safe(a) + safe(b)) / 2;
    return [
      safe(0),                // 60 Hz
      safe(1),                // 170 Hz
      avg(2, 3),              // ~350 Hz from 310/600
      safe(4),                // 1 kHz
      safe(5),                // 3 kHz
      avg(6, 7),              // ~10 kHz from 6k/12k
      avg(8, 9),              // 16 kHz from 14k/16k
    ];
  }

  const EQ_PRESET_ORDER = [
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

  const EQ_PRESETS = Object.fromEntries(
    EQ_PRESET_ORDER.map((key) => [key, map10BandTo7(WINAMP_10_BAND_PRESETS[key])])
  );
  
  class AudioVisualizer {
    constructor(audioSrc = null, ctxOptions = {}) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)(ctxOptions);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = fftSizes.get(2048);
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Float32Array(this.bufferLength);
      this.prevData = new Array(this.bufferLength).fill(0);
      // equalizer filters (start with 60 Hz low-shelf)
      this.eqFilters = [];
      this.initEQ();
      this.panner = (this.audioContext.createStereoPanner ? this.audioContext.createStereoPanner() : null);
      if (!this.panner) {
        this.splitter = this.audioContext.createChannelSplitter(2);
        this.leftGain = this.audioContext.createGain();
        this.rightGain = this.audioContext.createGain();
        this.merger = this.audioContext.createChannelMerger(2);
      }
      

      if (audioSrc) {
        this.audio = new Audio(audioSrc);
        this.audio.crossOrigin = "anonymous";
        this.audio.loop = true;
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.buildPannerChain();
        this.audio.addEventListener('loadedmetadata', () => {
          const d = this.audio && isFinite(this.audio.duration) ? Math.floor(this.audio.duration) : 0;
          document.dispatchEvent(new CustomEvent('player:trackMeta', { detail: { duration: d } }));
          this.updateKhzLabel();
          this.computeAndUpdateKbps(d);
        });
      } else {
        this.audio = null;
      }

      this.currentEffect = null;
      this.processor = processAudioData;
      this._rafId = 0;
    }

    // initialize EQ nodes: 7 bands matching UI (60, 170, 350, 1k, 3k, 10k, 16k)
    initEQ() {
      if (Array.isArray(this.eqFilters) && this.eqFilters.length) {
        this.eqFilters.forEach(f => {
          if (f && typeof f.disconnect === 'function') f.disconnect();
        });
      }
      this.eqFilters = [];
      const freqs = [60, 170, 350, 1000, 3000, 10000, 16000];
      for (let i = 0; i < freqs.length; i++) {
        const f = this.audioContext.createBiquadFilter();
        if (i === 0) f.type = 'lowshelf';
        else if (i === freqs.length - 1) f.type = 'highshelf';
        else { f.type = 'peaking'; f.Q.value = 1.0; }
        f.frequency.value = freqs[i];
        f.gain.value = 0;
        this.eqFilters.push(f);
      }
    }

    // connect the chain from the given input node -> EQ filters -> analyser -> destination
    connectToAnalyser(inputNode) {
      if (!inputNode || !this.analyser) return;
      if (typeof inputNode.disconnect === 'function') inputNode.disconnect();
      if (this.analyser && typeof this.analyser.disconnect === 'function') this.analyser.disconnect();
      let node = inputNode;
      if (Array.isArray(this.eqFilters) && this.eqFilters.length) {
        for (const filter of this.eqFilters) {
          if (filter && typeof filter.disconnect === 'function') filter.disconnect();
          node.connect(filter);
          node = filter;
        }
      }
      node.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }

    // set stereo balance: -1 (left) .. 0 .. +1 (right)
    setPan(value) {
      const v = Math.max(-1, Math.min(1, Number(value) || 0));
      if (this.panner) {
        this.panner.pan.value = v;
      } else if (this.leftGain && this.rightGain) {

        const x = (v + 1) * 0.5; // 0..1
        const left = Math.cos(x * Math.PI * 0.5);
        const right = Math.sin(x * Math.PI * 0.5);
        this.leftGain.gain.value = left;
        this.rightGain.gain.value = right;
      }
    }
    buildPannerChain() {
      if (!this.source || !this.analyser) return;
      if (this.source && typeof this.source.disconnect === 'function') this.source.disconnect();
      if (this.panner && typeof this.panner.disconnect === 'function') this.panner.disconnect();
      if (!this.panner) {
        if (!this.splitter) this.splitter = this.audioContext.createChannelSplitter(2);
        if (!this.leftGain) this.leftGain = this.audioContext.createGain();
        if (!this.rightGain) this.rightGain = this.audioContext.createGain();
        if (!this.merger) this.merger = this.audioContext.createChannelMerger(2);
      }

      if (this.panner) {
        this.source.connect(this.panner);
        this.connectToAnalyser(this.panner);
      } else {
        this.source.connect(this.splitter);
        this.splitter.connect(this.leftGain, 0);
        this.splitter.connect(this.rightGain, 1);
        this.leftGain.connect(this.merger, 0, 0);
        this.rightGain.connect(this.merger, 0, 1);
        this.connectToAnalyser(this.merger);
      }
    }

    
  
    async start(effect, processor) {
      this.processor = processor;
      this.currentEffect = effect;
  
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
  
      if (this.audio) {
        this.audio.play();
      }
  
      this.cancelAnimation();
      this._rafId = requestAnimationFrame(this.animate);
    }
  
    animate = () => {
      this._rafId = requestAnimationFrame(this.animate);
  
      if (this.isBeatMode) {
        this.simulateBeat(); // fake frequency data when using generated beats
      } else {
        this.analyser.getFloatFrequencyData(this.dataArray);
      }
  
      const processedData = this.processor(this.dataArray);
      const canvas = document.getElementById("visualizer");
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      this.currentEffect(ctx, canvas, processedData, this.prevData, this);
    };

    cancelAnimation() {
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  
    getBassLevel() {
      const bassRange = Math.floor(this.dataArray.length * 0.1);
      let sum = 0;
  
      for (let i = 0; i < bassRange; i++) {
        sum += this.dataArray[i];
      }
  
      return sum / bassRange;
    }
  
    detectBeat() {
      const bassLevel = this.getBassLevel();
  
      if (this.beatThreshold === 0) {
        this.beatThreshold = bassLevel * 1.05; 
      }
  
      if (bassLevel > this.beatThreshold && !this.beatDetected) {
        this.beatDetected = true;
        this.beatThreshold = bassLevel * 1.2; 
        setTimeout(() => (this.beatDetected = false), 300);
        return true;
      }
  
      this.beatThreshold *= 0.995; 
      return false;
    }
  
    stop() {
      if (this.audio) {
        this.pause();
        this.audio.currentTime = 0;
        this.updateSeekUI();
        this.resetVisualization();
      }
    }

    pause() {
      if (this.audio) {
        this.audio.pause();
        this.updateSeekUI();
      }
      this.cancelAnimation();
    }

    // set EQ gain in dB for a given band index
    setEqGain(bandIndex, gainDb) {
      const idx = Math.max(0, Math.min((this.eqFilters?.length || 1) - 1, Number(bandIndex) || 0));
      const val = Number(gainDb) || 0;
      if (this.eqFilters && this.eqFilters[idx]) {
        this.eqFilters[idx].gain.value = val;

      }
    }

    resetVisualization() {
      const canvas = document.getElementById("visualizer");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const silent = new Float32Array(this.bufferLength);
      for (let i = 0; i < silent.length; i++) silent[i] = -100;
      if (Array.isArray(this.prevData)) this.prevData.fill(-100);
      const data = this.processor ? this.processor(silent) : silent;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (typeof this.currentEffect === 'function') {
        this.currentEffect(ctx, canvas, data, this.prevData, this);
      }
    }

    // --- UI helpers ---
    updateKhzLabel() {
      const el = document.querySelector('#khz .value');
      const khz = Math.round(((this.audioContext && this.audioContext.sampleRate) || 0) / 1000);
      if (el && khz) el.textContent = String(khz);
    }

    updateKbpsLabel(value) {
      const el = document.querySelector('#kbps .value');
      if (el && typeof value === 'number' && isFinite(value)) el.textContent = String(Math.max(1, Math.round(value)));
    }

    updateSeekUI() {
      const seekSlider = document.getElementById('seek-slider');
      if (seekSlider && !seekSlider.matches(':active') && seekSlider.dataset.seeking !== '1') {
        seekSlider.value = String(Math.floor((this.audio && this.audio.currentTime) || 0));
      }
      const d = Math.floor((this.audio && this.audio.duration) || 0);
      const t = Math.floor((this.audio && this.audio.currentTime) || 0);
      document.dispatchEvent(new CustomEvent('player:timeupdate', { detail: { currentTime: t, duration: d } }));
    }

    async computeAndUpdateKbps(durationSeconds) {
      const src = this.audio?.src || '';
      if (!src || !durationSeconds) return;
      let bytes = 0;
      try {
        const head = await fetch(src, { method: 'HEAD', cache: 'force-cache' });
        const len = head.headers.get('content-length');
        if (len) bytes = parseInt(len, 10) || 0;
      } catch (_) { /* ignore: some servers block HEAD */ }
      if (!bytes) {
        try {
          const resp = await fetch(src, { cache: 'force-cache' });
          const blob = await resp.blob();
          bytes = blob.size || 0;
        } catch (_) { return; }
      }
      if (!bytes) return;
      const kbps = Math.max(1, Math.round((bytes * 8) / 1000 / Math.max(1, durationSeconds)));
      this.updateKbpsLabel(kbps);
    }
  }
  

  const histogram = (ctx, canvas, data, prevData) => {
    ctx.fillStyle = "#001127bf";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  
    const bufferLength = data.length;
    if (prevData.length !== bufferLength) {
      prevData.length = bufferLength;
      prevData.fill(0);
    }
  
    const barWidth = (canvas.width / bufferLength) * 10;
    let x = 0;
    // Get histogram gradient from skin switcher or use default
    const gradientStops = (window.getCurrentHistogramGradient && window.getCurrentHistogramGradient()) || [
      [0.0, "#fa73ab"],
      [0.1, "#f26bc5"],
      [0.2, "#ea63dd"],
      [0.3, "#e25bf5"],
      [0.4, "#da53ff"],
      [0.5, "#d24bff"],
      [0.6, "#ca43ff"],
      [0.7, "#c23bff"],
      [0.8, "#ba33ff"],
      [1.0, "#b22bff"],
    ];
  
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
  };
  
  
  const radialPolygon = (ctx, canvas, data, prevData, visualizer) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    let radius = 10;
  
    if (visualizer.detectBeat()) {
      radius = 20;
    }
  
    const totalBars = Math.min(data.length, 100);
    const angleStep = (2 * Math.PI) / totalBars;
  
    ctx.beginPath();
    for (let i = 0; i < totalBars; i++) {
      const angle = i * angleStep;
      const barHeight = Math.max(data[i], 1);
  
      const x = centerX + (radius + barHeight) * Math.cos(angle);
      const y = centerY + (radius + barHeight) * Math.sin(angle);
  
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "#ffa500";
    ctx.lineWidth = 1;
    ctx.shadowColor = "#ffa500";
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 141, 0, 0.25)";
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  
  let visualizer = new AudioVisualizer('public/tracks/moonlight.mp3');
  window.visualizer = visualizer;
  let _dockFollowRaf = 0;
  const DOCK_GAP_PX = 0; // vertical gap between player window and docks

  // Cache player window rect to avoid repeated layout reads
  function updatePlayerRectCache() {
    const el = document.getElementById('player-window');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cached = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    window._playerRectCache = cached;
    return cached;
  }
  function getPlayerRectCached() {
    return window._playerRectCache || updatePlayerRectCache();
  }
  function setupPlayerRectCache() {
    const el = document.getElementById('player-window');
    if (!el) return;
    updatePlayerRectCache();
    const mo = new MutationObserver(() => updatePlayerRectCache());
    mo.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('resize', updatePlayerRectCache);
    el.addEventListener('pointerup', updatePlayerRectCache, { passive: true });
    el.addEventListener('pointercancel', updatePlayerRectCache, { passive: true });
    window._playerRectObserver = mo;
  }
  
  function positionDock(dockEl) {
    if (!dockEl || dockEl.style.display === 'none') return;
    const r = getPlayerRectCached();
    if (!r) return;
    dockEl.style.left = `${r.left}px`;
    dockEl.style.top  = `${Math.round(r.bottom + DOCK_GAP_PX)}px`;
  }

  function positionDockBelow(anchorEl, dockEl) {
    if (!anchorEl || !dockEl || dockEl.style.display === 'none') return;
    const r = anchorEl.getBoundingClientRect();
    dockEl.style.left = `${r.left}px`;
    dockEl.style.top  = `${Math.round(r.bottom + DOCK_GAP_PX)}px`;
  }

  function isVisible(el) {
    return !!(el && !(el.style.display === 'none' || !el.style.display));
  }

  function startFollowingDock() {
    if (_dockFollowRaf) return;
    const tick = () => {
      const pl = document.getElementById('playlist-dock');
      const eq = document.getElementById('eq-dock');
      const plVisible = isVisible(pl);
      const eqVisible = isVisible(eq);
      if (plVisible && eqVisible) {
        positionDock(pl);
        positionDockBelow(pl, eq);
      } else if (plVisible) {
        positionDock(pl);
      } else if (eqVisible) {
        positionDock(eq);
      }
      // avoid layout thrash by updating cache once per RAF
      updatePlayerRectCache();
      _dockFollowRaf = window.requestAnimationFrame(tick);
    };
    _dockFollowRaf = window.requestAnimationFrame(tick);
  }

  function stopFollowingDock() {
    if (_dockFollowRaf) cancelAnimationFrame(_dockFollowRaf);
    _dockFollowRaf = 0;
  }

  // Smooth show/hide helpers for docks
  function showDockAnimated(el) {
    if (!el) return;
    el.classList.add('dock-anim');
    el.style.display = 'block';
    // force reflow before toggling the class so transition runs
    void el.getBoundingClientRect();
    el.classList.add('show');
  }
  function hideDockAnimated(el) {
    if (!el) return;
    el.classList.add('dock-anim');
    el.classList.remove('show');
    const done = () => { el.style.display = 'none'; el.removeEventListener('transitionend', done); };
    el.addEventListener('transitionend', done, { once: true });
    // Fallback in case transitionend doesn't fire
    setTimeout(done, 260);
  }

  window.setCurrentTrackLabel = (name) => {
    const el = document.querySelector('.neon');
    if (!el) return;
    const text = name || '';
    el.textContent = text;
    el.setAttribute('data-text', text);
    void el.offsetWidth;
    window._baseTrackLabel = text;
  };
  visualizer.updateKhzLabel();
  {
    const audioEl = visualizer.audio;
    const update = () => {
      const dur = isFinite(audioEl?.duration) ? Math.floor(audioEl.duration) : 0;
      if (audioEl && dur > 0) visualizer.computeAndUpdateKbps(dur);
    };
    audioEl?.addEventListener('loadedmetadata', update);
    audioEl?.addEventListener('loadeddata', update);
  }
  document
    .getElementById("play-button")
    .addEventListener("click", async () => {
        const shuffleOn = document.getElementById('shuffle-toggle')?.getAttribute('aria-pressed') === 'true';
        if (shuffleOn && !window._playerStarted) {
          const items = Array.from(document.querySelectorAll('#track-items li'));
          if (items.length) {
            const cur = (visualizer.audio && visualizer.audio.src) || '';
            let curIdx = items.findIndex(li => cur.endsWith(li.dataset.src || ''));
            if (curIdx < 0) curIdx = 0;
            let rand = Math.floor(Math.random() * items.length);
            if (items.length > 1 && rand === curIdx) rand = (rand + 1) % items.length;
            if (window.playerPlayByIndex) window.playerPlayByIndex(rand);
            else {
              const src = items[rand].dataset.src;
              if (src) {
                visualizer.audio.src = src;
                // do not set label until playback starts
              }
            }
          }
        }
      window._playerStarted = true;
      await visualizer.start(histogram, processAudioData);
    });
  
  document.getElementById("stop-button").addEventListener("click", () => {
    visualizer.stop();
  });

AudioVisualizer.prototype.bindTransportControls = function bindTransportControls() {
  const visualizer = this;
  const seekSlider = document.getElementById('seek-slider');
  const volumeSlider = document.getElementById('volume-slider');
  const trackLabelEl = document.querySelector('#current-track p');
  let volumeRevertTimer = 0;
  const balanceSlider = document.getElementById('balance-slider');
  const prevBtn = document.getElementById('prev-button');
  const nextBtn = document.getElementById('next-button');
  const pauseBtn = document.getElementById('pause-button');
  const shuffleBtn = document.getElementById('shuffle-toggle');
  const repeatBtn = document.getElementById('repeat-toggle');
  const uploadBtn = document.getElementById('upload-button');
  const uploadInput = document.getElementById('upload-input');
  const plButton = document.getElementById('pl-button');
  const eqButton = document.getElementById('eq-button');

  if ((!seekSlider && !volumeSlider) || !visualizer || !visualizer.audio) return;

  visualizer.audio.addEventListener('loadedmetadata', () => {
    const d = isFinite(visualizer.audio.duration) ? Math.floor(visualizer.audio.duration) : 0;
    if (seekSlider) { seekSlider.max = String(d); seekSlider.value = '0'; }
    document.dispatchEvent(new CustomEvent('player:trackMeta', { detail: { duration: d } }));
  });

  visualizer.audio.addEventListener('timeupdate', () => visualizer.updateSeekUI());

  if (seekSlider) {
    const commitSeek = () => { delete seekSlider.dataset.seeking; };
    const startSeek = () => { seekSlider.dataset.seeking = '1'; };
    seekSlider.addEventListener('pointerdown', startSeek);
    seekSlider.addEventListener('pointerup', commitSeek);
    seekSlider.addEventListener('touchstart', startSeek, { passive: true });
    seekSlider.addEventListener('touchend', commitSeek, { passive: true });
    seekSlider.addEventListener('mousedown', startSeek);
    seekSlider.addEventListener('mouseup', commitSeek);
    seekSlider.addEventListener('input', () => {
      const v = Number(seekSlider.value) || 0;
      if (visualizer.audio && isFinite(visualizer.audio.duration)) {
        visualizer.audio.currentTime = Math.min(Math.max(0, v), visualizer.audio.duration);
      }
      
    });
    seekSlider.addEventListener('change', commitSeek);
  }

  if (volumeSlider) {
    if (!volumeSlider.value) volumeSlider.value = '50';
    const setVol = () => {
      const v = Number(volumeSlider.value);
      const vol = Math.max(0, Math.min(1, (isNaN(v) ? 50 : v) / 100));
      if (visualizer.audio) visualizer.audio.volume = vol;
      if (trackLabelEl && window._baseTrackLabel) {
        const pct = Math.round(isNaN(v) ? 50 : v);
        trackLabelEl.textContent = `Volume: ${pct}%`;
        if (volumeRevertTimer) clearTimeout(volumeRevertTimer);
        volumeRevertTimer = window.setTimeout(() => {
          if (window._baseTrackLabel) window.setCurrentTrackLabel(window._baseTrackLabel);
        }, 800);
      }
    };
    if (visualizer.audio.readyState >= 1) setVol();
    visualizer.audio.addEventListener('loadedmetadata', setVol);
    visualizer.audio.addEventListener('canplay', setVol);
    visualizer.audio.addEventListener('play', setVol);
    volumeSlider.addEventListener('input', setVol);
    volumeSlider.addEventListener('change', setVol);
    volumeSlider.addEventListener('pointerdown', () => volumeSlider.dataset.active = '1');
    volumeSlider.addEventListener('pointerup',   () => delete volumeSlider.dataset.active);
  }

  if (balanceSlider) {
    const applyPan = () => {
      const raw = Number(balanceSlider.value) || 0;
      const pan = Math.max(-1, Math.min(1, raw / 100));
      visualizer.setPan?.(pan);
    };
    if (visualizer.audio.readyState >= 1) applyPan();
    visualizer.audio.addEventListener('loadedmetadata', applyPan);
    visualizer.audio.addEventListener('play', applyPan);
    balanceSlider.addEventListener('input', applyPan);
    balanceSlider.addEventListener('change', applyPan);
  }

  function getPlaylist() {
    const items = Array.from(document.querySelectorAll('#track-items li'));
    return items.map(li => ({ el: li, src: li.dataset.src || li.getAttribute('data-src') || li.textContent }));
  }
  window.playerPlayByIndex = function playByIndex(index) {
    const list = getPlaylist();
    if (!list.length) return;
    const i = ((index % list.length) + list.length) % list.length;
    const src = list[i].el.dataset.src;
    if (!src || !visualizer.audio) return;
    visualizer.audio.pause();
    visualizer.audio.src = src;
    visualizer.audio.play();
    list.forEach((it, idx) => it.el.classList.toggle('active', idx === i));
    visualizer.currentIndex = i;
    
  }
  visualizer.currentIndex = visualizer.currentIndex || 0;
  let isShuffle = shuffleBtn?.getAttribute('aria-pressed') === 'true';
  let isRepeat  = repeatBtn?.getAttribute('aria-pressed') === 'true';
  const history = [];

  function resolveCurrentIndex() {
    const list = getPlaylist();
    const curSrc = (visualizer.audio && visualizer.audio.src) || '';
    const idx = list.findIndex(it => curSrc.endsWith(it.el.dataset.src || ''));
    if (idx >= 0) visualizer.currentIndex = idx;
    return visualizer.currentIndex;
  }

  function pickRandomIndex(exclude, length) {
    if (length <= 1) return exclude;
    let r = exclude;
    while (r === exclude) r = Math.floor(Math.random() * length);
    return r;
  }

  function goNext() {
    const list = getPlaylist();
    const len = list.length;
    if (!len) return;
    resolveCurrentIndex();
    let nextIdx;
    if (isShuffle) nextIdx = pickRandomIndex(visualizer.currentIndex, len);
    else {
      nextIdx = visualizer.currentIndex + 1;
      if (nextIdx >= len) { if (isRepeat) nextIdx = 0; else return; }
    }
    history.push(visualizer.currentIndex); if (history.length > 50) history.shift();
    window.playerPlayByIndex(nextIdx);
  }

  function goPrev() {
    const list = getPlaylist();
    const len = list.length;
    if (!len) return;
    resolveCurrentIndex();
    if (isShuffle && history.length) { const prevIdx = history.pop(); window.playerPlayByIndex(prevIdx); return; }
    let prevIdx = visualizer.currentIndex - 1;
    if (prevIdx < 0) { prevIdx = isRepeat ? len - 1 : 0; }
    
    window.playerPlayByIndex(prevIdx);
  }

  prevBtn?.addEventListener('click', goPrev);
  nextBtn?.addEventListener('click', goNext);
  pauseBtn?.addEventListener('click', () => visualizer.pause?.());

  uploadBtn?.addEventListener('click', () => uploadInput?.click());
  uploadInput?.addEventListener('change', () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = (file.name || 'track').replace(/\.(mp3|wav|ogg|m4a)$/i, '');
    const listEl = document.getElementById('track-items');
    if (listEl) {
      const li = document.createElement('li');
      li.textContent = name;
      li.dataset.src = url;
      li.tabIndex = 0;
      li.addEventListener('click', () => {
        const items = Array.from(document.querySelectorAll('#track-items li'));
        const idx = items.indexOf(li);
        if (idx >= 0) window.playerPlayByIndex?.(idx);
      });
      listEl.appendChild(li);
    }
    const items = Array.from(document.querySelectorAll('#track-items li'));
    const idxNew = Math.max(0, items.length - 1);
    window.playerPlayByIndex?.(idxNew);
  });
  plButton?.addEventListener('click', () => {
    const playlistDock = document.getElementById('playlist-dock');
    const isHidden = playlistDock.style.display === 'none' || !playlistDock.style.display;
    
    if (isHidden) {
      updatePlayerRectCache();
      positionDock(playlistDock);
      showDockAnimated(playlistDock);
      if (window.visualizer?.buildTrackList) window.visualizer.buildTrackList();
      startFollowingDock();
    } else {
      hideDockAnimated(playlistDock);
      const eqDock = document.getElementById('eq-dock');
      if (isVisible(eqDock)) {
        updatePlayerRectCache();
        positionDock(eqDock);
        startFollowingDock();
      } else {
        stopFollowingDock();
      }
    }
  });

  eqButton?.addEventListener('click', () => {
    const eqDock = document.getElementById('eq-dock');
    const isHidden = eqDock.style.display === 'none' || !eqDock.style.display;
    if (isHidden) {
      const playlistDock = document.getElementById('playlist-dock');
      const playlistVisible = playlistDock && !(playlistDock.style.display === 'none' || !playlistDock.style.display);
      updatePlayerRectCache();
      if (playlistVisible) { positionDock(playlistDock); positionDockBelow(playlistDock, eqDock); }
      else positionDock(eqDock);
      showDockAnimated(eqDock);
      startFollowingDock();
    } else {
      hideDockAnimated(eqDock);
      const playlistDock = document.getElementById('playlist-dock');
      if (isVisible(playlistDock)) {
        updatePlayerRectCache();
        positionDock(playlistDock);
        startFollowingDock();
      } else {
        stopFollowingDock();
      }
    }
  });

  // EQ presets context menu (dummy)
  (function setupEqPresetsMenu(){
    const btn = document.getElementById('eq-presets-btn');
    const menu = document.getElementById('eq-presets-menu');
    if (!btn || !menu) return;

    const labelize = (name) => name.replace(/\b\w/g, (m) => m.toUpperCase());
    menu.innerHTML = '';
    const fragment = document.createDocumentFragment();
    EQ_PRESET_ORDER.forEach((key) => {
      const values = EQ_PRESETS[key];
      if (!values) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.dataset.preset = key;
      item.textContent = labelize(key);
      item.addEventListener('click', (e) => {
        e.preventDefault();
        applyEqPreset(key);
        close();
      });
      fragment.appendChild(item);
    });
    menu.appendChild(fragment);

    let visible = false;
    const open = () => {
      if (visible) return;
      menu.classList.add('show');
      menu.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
      visible = true;
    };
    const close = () => {
      if (!visible) return;
      menu.classList.remove('show');
      menu.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
      visible = false;
    };
    const toggle = () => { (visible ? close : open)(); };
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); });
    menu.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.matches('button[role="menuitem"]')) {
        close();
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!visible) return;
      const t = e.target;
      if (t === btn || menu.contains(t)) return;
      close();
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  })();

  shuffleBtn?.addEventListener('click', () => {
    const pressed = shuffleBtn.getAttribute('aria-pressed') === 'true';
    const nextState = !pressed;
    shuffleBtn.setAttribute('aria-pressed', String(nextState));
    isShuffle = nextState;

    if (isShuffle) {
      const list = getPlaylist();
      const len = list.length;
      if (len) {
        resolveCurrentIndex();
        const rand = pickRandomIndex(visualizer.currentIndex, len);
        if (visualizer.audio && !visualizer.audio.paused) {
          window.playerPlayByIndex(rand);
        } else if (visualizer.audio) {
          const pick = list[rand];
          visualizer.audio.src = pick.src || pick.el.dataset.src;
          // do not set label until playback starts
          list.forEach((it, idx) => it.el.classList.toggle('active', idx === rand));
          visualizer.currentIndex = rand;
        }
      }
    }
  });
  repeatBtn?.addEventListener('click', () => {
    const pressed = repeatBtn.getAttribute('aria-pressed') === 'true';
    const nextState = !pressed;
    repeatBtn.setAttribute('aria-pressed', String(nextState));
    isRepeat = nextState;
    if (visualizer.audio) visualizer.audio.loop = false; 
  });

  visualizer.audio?.addEventListener('ended', () => {
    if (isShuffle || isRepeat) goNext();
    else {
      const list = getPlaylist();
      if (visualizer.currentIndex < list.length - 1) goNext();
    }
  });

  // Set the label only when audio actually starts playing
  visualizer.audio?.addEventListener('play', () => {
    const list = getPlaylist();
    const cur = (visualizer.audio && visualizer.audio.src) || '';
    const item = list.find(it => cur.endsWith(it.src || it.el?.dataset?.src || '')) || null;
    let label = item ? (item.el?.textContent || '') : '';
    if (!label && cur) {
      label = cur.split('/').pop().replace(/\.(mp3|wav|ogg|m4a)$/i, '');
    }
    if (label) window.setCurrentTrackLabel(label);
  });

  visualizer.audio?.addEventListener('loadedmetadata', resolveCurrentIndex);
};

// bind controls on load
visualizer.bindTransportControls();
setupPlayerRectCache();

// Minimal minimize sync: when the DreamDesk window toggles minimized state,
// translate/scale the shadow root container to the bottom-left.
(function setupMinimizeSync(){
  const host = document.getElementById('player-window');
  if (!host) return;
  const getRootEl = () => {
    const sr = host.shadowRoot || (host.getRootNode && host.getRootNode());
    return sr && sr.querySelector && sr.querySelector('.component-root');
  };
  const apply = (minimized) => {
    const root = getRootEl();
    if (!root) return;
    host.classList.toggle('minimized-host', !!minimized);
    root.style.transformOrigin = 'left bottom';
    root.style.willChange = 'transform, opacity';
    root.style.transition = 'transform 840ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 380ms ease-out';
    if (minimized) {
      const r = host.getBoundingClientRect();
      const margin = 8;
      const dx = Math.round(margin - r.left);
      const dy = Math.round(Math.max(margin, (window.innerHeight || 0) - r.height - margin) - r.top);
      // force reflow so transition applies
      void root.getBoundingClientRect();
      root.style.transform = `translate(${dx}px, ${dy}px) scale(0.72)`;
      root.style.opacity = '0';
    } else {
      // force reflow so reverse transition applies
      void root.getBoundingClientRect();
      root.style.transform = '';
      root.style.opacity = '1';
      const clear = () => { root.style.willChange = ''; root.removeEventListener('transitionend', clear); };
      root.addEventListener('transitionend', clear, { once: true });
    }
  };
  const inferMinimized = () => {
    // Heuristics: library may toggle one of these
    return (
      host.hasAttribute('minimized') ||
      host.getAttribute('data-dd-state') === 'minimized' ||
      host.classList.contains('minimized')
    );
  };
  const mo = new MutationObserver(() => apply(inferMinimized()));
  mo.observe(host, { attributes: true, attributeFilter: ['class','minimized','data-dd-state','style'] });
  // Apply once in case it's already minimized
  apply(inferMinimized());
})();

function wireEq() {
    const sliders = Array.from(document.querySelectorAll('#eq-dock .eq-presets input.eq-slider'));
    if (!sliders.length) return;
    const onInput = (e) => {
      const el = e?.currentTarget || e?.target;
      if (!el) return;
      const bandIndex = Number(el.getAttribute('data-band')) || 0;
      const v = Number(el.value) || 0;
      visualizer.setEqGain?.(bandIndex, v);
    };
    sliders.forEach((el) => {
      el.addEventListener('input', onInput);
      el.addEventListener('change', onInput);
      onInput({ currentTarget: el });
    });
    applyEqPreset('flat');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireEq, { once: true });
} else {
  wireEq();
}

function applyEqPreset(name) {
  const values = EQ_PRESETS[name];
  if (!values || !values.length) return;
  const sliders = Array.from(document.querySelectorAll('#eq-dock .eq-presets input.eq-slider'));
  if (!sliders.length) return;
  const count = Math.min(values.length, sliders.length);
  for (let i = 0; i < count; i++) {
    const el = sliders[i];
    el.value = String(values[i]);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

AudioVisualizer.prototype.buildTrackList = async function buildTrackList() {
  const container = document.getElementById('track-items');
  if (!container) return;
  try {
    let known = [];
    try {
      const resp = await fetch('public/tracks/manifest.json', { cache: 'no-store' });
      if (resp.ok) {
        const files = await resp.json();
        if (Array.isArray(files)) {
          // accept either strings or rich objects { file, title, artist }
          known = files
            .map((entry) => {
              if (typeof entry === 'string') {
                return { file: entry, title: entry.replace(/\.(mp3|wav|ogg|m4a)$/i, ''), artist: '' };
              }
              if (entry && typeof entry === 'object') {
                return {
                  file: String(entry.file || entry.name || ''),
                  title: String(entry.title || '').trim() || String(entry.name || '').replace(/\.(mp3|wav|ogg|m4a)$/i, ''),
                  artist: String(entry.artist || '').trim()
                };
              }
              return null;
            })
            .filter((e) => e && /\.(mp3|wav|ogg|m4a)$/i.test(e.file))
            .map((e) => ({ file: e.file, title: e.title, artist: e.artist, path: `public/tracks/${e.file}` }));
        }
      }
    } catch (_) { /* ignore manifest fetch/parse errors, fall back to defaults */ }
    if (!known.length) {
      known = [
        { file: 'untitled.mp3', title: 'untitled', artist: 'Circle Takes the Square', path: 'public/tracks/untitled.mp3' },
        { file: 'moonlight.mp3', title: 'Moonlight Sonata', artist: 'Ludwig van Beethoven', path: 'public/tracks/moonlight.mp3' },
        { file: '9.mp3', title: 'Symphony No. 9, Op. 125', artist: 'Ludwig van Beethoven', path: 'public/tracks/9.mp3' }
      ];
    }
    container.innerHTML = '';
    for (let idx = 0; idx < known.length; idx++) {
      const t = known[idx];
      const li = document.createElement('li');
      const label = t.artist ? `${t.title} — ${t.artist}` : t.title.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
      li.textContent = label;
      li.dataset.src = t.path || `public/tracks/${t.file}`;
      li.tabIndex = 0;
      li.addEventListener('click', () => window.playerPlayByIndex(idx));
      container.appendChild(li);
    }
    // do not set label from the initial list; wait until playback starts
  } catch (_) { /* ignore unexpected build list errors to avoid breaking UI */ }
};

// build initial track list after DOM is ready, so hidden dock exists
const _buildOnReady = () => { if (window.visualizer?.buildTrackList) window.visualizer.buildTrackList(); };
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _buildOnReady, { once: true });
} else {
  _buildOnReady();
}
   
window.addEventListener('resize', () => {
  positionDock(document.getElementById('playlist-dock'));
  positionDock(document.getElementById('eq-dock'));
});
  

window.DreamDeskAnimations = {
  customFullscreen(el, { isFullscreen, previousState }) {
      const playlistDock = document.getElementById('playlist-dock');
      const eqDock = document.getElementById('eq-dock');
      if (!playlistDock || !eqDock) return;
      const firstInvocation = typeof window._preFsPlaylistVisible === 'undefined' && typeof window._preFsEqVisible === 'undefined';
      if (!isFullscreen && firstInvocation && !window._fsBootstrapDone) {
        
        showDockAnimated(playlistDock);
        showDockAnimated(eqDock);
        if ((window.visualizer || visualizer)?.buildTrackList) (window.visualizer || visualizer).buildTrackList();
        if (typeof wireEq === 'function') wireEq();
        window.requestAnimationFrame(() => {
          updatePlayerRectCache();
          positionDock(playlistDock);
          positionDockBelow(playlistDock, eqDock);
          startFollowingDock();
        });
        window._fsBootstrapDone = true;
        window._isFullscreenActive = true;
        return;
      }

      if (window._isFullscreenActive && isFullscreen === true && window._fsBootstrapDone) {
        hideDockAnimated(playlistDock);
        hideDockAnimated(eqDock);
        stopFollowingDock();
        window._isFullscreenActive = false;
        // reset bootstrap and previous-state markers so next enter can bootstrap again
        window._fsBootstrapDone = false;
        window._preFsPlaylistVisible = undefined;
        window._preFsEqVisible = undefined;
        return;
      }

      if (isFullscreen) {
        try {
          const win = document.getElementById('player-window');
          if (win) {
            const r = getPlayerRectCached();
            window._playerPrevWindow = {
              left: win.style.left,
              top: win.style.top,
              width: win.style.width,
              height: win.style.height,
              transform: win.style.transform,
              rect: r
            };
          }
        } catch(_) {}
        window._preFsPlaylistVisible = isVisible(playlistDock);
        window._preFsEqVisible = isVisible(eqDock);
        showDockAnimated(playlistDock);
        showDockAnimated(eqDock);
        if ((window.visualizer || visualizer)?.buildTrackList) (window.visualizer || visualizer).buildTrackList();
        if (typeof wireEq === 'function') wireEq();

        window.requestAnimationFrame(() => {
          updatePlayerRectCache();
          positionDock(playlistDock);
          positionDockBelow(playlistDock, eqDock);
          startFollowingDock();
          window._isFullscreenActive = true;
        });
      } else {
        hideDockAnimated(playlistDock);
        hideDockAnimated(eqDock);
        stopFollowingDock();
        window._isFullscreenActive = false;
        // reset bootstrap and previous-state markers so next enter can bootstrap again
        window._fsBootstrapDone = false;
        window._preFsPlaylistVisible = undefined;
        window._preFsEqVisible = undefined;
      }
  },
};

window.DreamDeskAnimations.customUnfullscreen = window.DreamDeskAnimations.customFullscreen;
// Minimize by animating the shadow root's component container to the bottom-left corner.
window.DreamDeskAnimations.customMinimize = function customMinimize(el, { isMinimized }) {
  if (!el) return;
  const sr = el.getRootNode && el.getRootNode();
  const root = sr && sr.querySelector && sr.querySelector('.component-root');
  if (!root) return;
  root.style.transformOrigin = 'left bottom';
  root.style.willChange = 'transform, opacity';
  root.style.transition = 'transform 3240ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 5080ms ease-out';
  if (isMinimized) {
    const r = el.getBoundingClientRect();
    const margin = 8;
    const dx = Math.round(margin - r.left);
    const dy = Math.round(Math.max(margin, (window.innerHeight || 0) - r.height - margin) - r.top);
    void root.getBoundingClientRect();
    root.style.transform = `translate(${dx}px, ${dy}px) scale(0.72)`;
    root.style.opacity = '0';
  } else {
    void root.getBoundingClientRect();
    root.style.transform = '';
    root.style.opacity = '1';
    const clear = () => { root.style.willChange = ''; root.removeEventListener('transitionend', clear); };
    root.addEventListener('transitionend', clear, { once: true });
  }
};
window.DreamDeskAnimations.customUnminimize = window.DreamDeskAnimations.customMinimize;
