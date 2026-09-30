/**
 * The audio graph: element source -> panner -> seven biquads -> analyser ->
 * destination, plus the frame loop that feeds the meters.
 *
 * Holds no DOM. Everything it used to paint directly now goes out through
 * three callbacks, so the vanilla page and the React package can each render
 * it their own way. Plain ESM with JSDoc, loadable by index.html without a
 * build. See PLAN.md stage 2.
 */

import { EQ_FREQS } from './eq-presets.js';
import { processAudioData } from './audio-data.js';

/**
 * What the host is told about the track. Fields appear as they are discovered:
 * duration on loadedmetadata, khz once the context exists, kbps after the
 * file's size is known.
 * @typedef {object} TrackMeta
 * @property {number} [duration] Whole seconds.
 * @property {number} [khz] Sample rate, rounded to kHz.
 * @property {number} [kbps] Average bitrate.
 */

/**
 * @typedef {object} AudioEngineCallbacks
 * @property {(data: number[], prevData: number[]) => void} [onFrame]
 *   One processed frame, ready to draw. prevData is the engine's smoothing
 *   buffer and is passed through for the host's draw call to mutate.
 * @property {(meta: TrackMeta) => void} [onMeta]
 *   Called with whichever fields have just become known, not the whole set.
 * @property {(currentTime: number, duration: number) => void} [onTime]
 *   Whole seconds, on every transport change.
 * @property {(data: Float32Array) => number[]} [processor]
 *   Overrides the default scaling; the vanilla player let callers pass their
 *   own, so the seam is kept.
 * @property {boolean} [loop]
 *   Defaults true, as the vanilla player has always done. A host with its own
 *   repeat and next-track logic wants false, or the track never ends.
 * @property {string|null} [crossOrigin]
 *   Set on the audio element; null leaves it alone.
 */

export class AudioEngine {
  /**
   * @param {string|null} [audioSrc] Loaded immediately when given.
   * @param {AudioEngineCallbacks & { contextOptions?: AudioContextOptions }} [options]
   */
  constructor(audioSrc = null, options = {}) {
    const {
      contextOptions = {},
      onFrame = null,
      onMeta = null,
      onTime = null,
      processor = processAudioData,
      loop = true,
      crossOrigin = 'anonymous',
    } = options;

    this.onFrame = onFrame;
    this.onMeta = onMeta;
    this.onTime = onTime;

    const Ctor =
      window.AudioContext ||
      /** @type {any} */ (window).webkitAudioContext;
    this.audioContext = new Ctor(contextOptions);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Float32Array(this.bufferLength);
    this.prevData = new Array(this.bufferLength).fill(0);

    /** @type {BiquadFilterNode[]} */
    this.eqFilters = [];
    this.initEQ();

    this.panner = this.audioContext.createStereoPanner
      ? this.audioContext.createStereoPanner()
      : null;
    if (!this.panner) {
      // Safari used to ship without StereoPannerNode; the split/merge pair is
      // the equal-power fallback.
      this.splitter = this.audioContext.createChannelSplitter(2);
      this.leftGain = this.audioContext.createGain();
      this.rightGain = this.audioContext.createGain();
      this.merger = this.audioContext.createChannelMerger(2);
    }

    /** @type {HTMLAudioElement|null} */
    this.audio = null;
    /** @type {MediaElementAudioSourceNode|null} */
    this.source = null;

    // The element and the graph are built even with no src, so a host can wire
    // the chain once at mount and assign src per track. createMediaElementSource
    // may only be called once per element, which is why this cannot wait.
    this.audio = new Audio();
    if (crossOrigin !== null) this.audio.crossOrigin = crossOrigin;
    this.audio.loop = loop;
    if (audioSrc) this.audio.src = audioSrc;

    this.source = this.audioContext.createMediaElementSource(this.audio);
    this.buildPannerChain();

    this.audio.addEventListener('loadedmetadata', () => {
      // Nobody listening means nobody wants the bitrate either, and finding it
      // can cost a full fetch. Hosts that track their own metadata pass no
      // onMeta and pay nothing here.
      if (!this.onMeta) return;
      const d =
        this.audio && isFinite(this.audio.duration)
          ? Math.floor(this.audio.duration)
          : 0;
      this.emitMeta({ duration: d, khz: this.sampleRateKhz() });
      this.computeAndEmitKbps(d);
    });

    /** @type {((data: number[], prevData: number[]) => void)|null} */
    this.currentEffect = null;
    this.processor = processor;
    this._rafId = 0;
  }

  /** @param {TrackMeta} meta */
  emitMeta(meta) {
    if (this.onMeta) this.onMeta(meta);
  }

  /** Sample rate in kHz, or 0 before the context exists. */
  sampleRateKhz() {
    return Math.round(((this.audioContext && this.audioContext.sampleRate) || 0) / 1000);
  }

  /** Seven bands matching the UI: 60, 170, 350, 1k, 3k, 10k, 16k. */
  initEQ() {
    if (Array.isArray(this.eqFilters) && this.eqFilters.length) {
      this.eqFilters.forEach((f) => {
        if (f && typeof f.disconnect === 'function') f.disconnect();
      });
    }
    this.eqFilters = [];

    const freqs = EQ_FREQS;
    for (let i = 0; i < freqs.length; i++) {
      const f = this.audioContext.createBiquadFilter();
      if (i === 0) f.type = 'lowshelf';
      else if (i === freqs.length - 1) f.type = 'highshelf';
      else {
        f.type = 'peaking';
        f.Q.value = 1.0;
      }
      f.frequency.value = freqs[i];
      f.gain.value = 0;
      this.eqFilters.push(f);
    }
  }

  /**
   * Wire inputNode -> EQ chain -> analyser -> destination.
   * @param {AudioNode|null} inputNode
   */
  connectToAnalyser(inputNode) {
    if (!inputNode || !this.analyser) return;
    if (typeof inputNode.disconnect === 'function') inputNode.disconnect();
    if (this.analyser && typeof this.analyser.disconnect === 'function') {
      this.analyser.disconnect();
    }

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

  /**
   * Stereo balance.
   * @param {number} value -1 hard left, 0 centre, +1 hard right.
   */
  setPan(value) {
    const v = Math.max(-1, Math.min(1, Number(value) || 0));
    if (this.panner) {
      this.panner.pan.value = v;
    } else if (this.leftGain && this.rightGain) {
      const x = (v + 1) * 0.5;
      this.leftGain.gain.value = Math.cos(x * Math.PI * 0.5);
      this.rightGain.gain.value = Math.sin(x * Math.PI * 0.5);
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
    } else if (this.splitter && this.leftGain && this.rightGain && this.merger) {
      this.source.connect(this.splitter);
      this.splitter.connect(this.leftGain, 0);
      this.splitter.connect(this.rightGain, 1);
      this.leftGain.connect(this.merger, 0, 0);
      this.rightGain.connect(this.merger, 0, 1);
      this.connectToAnalyser(this.merger);
    }
  }

  /**
   * Resume the context, start playback, start the frame loop.
   * @param {((data: number[], prevData: number[]) => void)|null} [effect]
   *   Defaults to the onFrame given at construction.
   * @param {((data: Float32Array) => number[])|null} [processor]
   */
  async start(effect = null, processor = null) {
    if (processor) this.processor = processor;
    this.currentEffect = effect || this.onFrame;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    if (this.audio) {
      // Autoplay policy rejects until there has been a gesture; that is not an
      // error worth surfacing, but an unhandled rejection is noise.
      await this.audio.play().catch(() => {});
    }

    this.cancelAnimation();
    this._rafId = requestAnimationFrame(this.animate);
  }

  animate = () => {
    this._rafId = requestAnimationFrame(this.animate);
    this.analyser.getFloatFrequencyData(this.dataArray);

    const processedData = this.processor(this.dataArray);
    if (this.currentEffect) this.currentEffect(processedData, this.prevData);
  };

  cancelAnimation() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  stop() {
    if (this.audio) {
      this.pause();
      this.audio.currentTime = 0;
      this.emitTime();
      this.resetVisualization();
    }
  }

  pause() {
    if (this.audio) {
      this.audio.pause();
      this.emitTime();
    }
    this.cancelAnimation();
  }

  /**
   * @param {number} bandIndex
   * @param {number} gainDb
   */
  setEqGain(bandIndex, gainDb) {
    const idx = Math.max(
      0,
      Math.min((this.eqFilters?.length || 1) - 1, Number(bandIndex) || 0)
    );
    const val = Number(gainDb) || 0;
    if (this.eqFilters && this.eqFilters[idx]) {
      this.eqFilters[idx].gain.value = val;
    }
  }

  /** Paint one silent frame, so a stopped player shows a flat line. */
  resetVisualization() {
    const silent = new Float32Array(this.bufferLength);
    for (let i = 0; i < silent.length; i++) silent[i] = -100;
    if (Array.isArray(this.prevData)) this.prevData.fill(-100);

    const data = this.processor ? this.processor(silent) : Array.from(silent);
    if (this.currentEffect) this.currentEffect(data, this.prevData);
  }

  /**
   * Release the audio context and stop everything. Needed by hosts that
   * unmount - a page that never tears down, like the vanilla player, never
   * called this. Safe to call twice, which React's StrictMode will do.
   */
  dispose() {
    this.cancelAnimation();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.currentEffect = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      // close() rejects on an already-closing context; nothing to do about it.
      void this.audioContext.close().catch(() => {});
    }
  }

  /** Hand the host the current transport position, in whole seconds. */
  emitTime() {
    const d = Math.floor((this.audio && this.audio.duration) || 0);
    const t = Math.floor((this.audio && this.audio.currentTime) || 0);
    if (this.onTime) this.onTime(t, d);
  }

  /**
   * Average bitrate, from the file's size over its duration. HEAD first, since
   * it costs nothing; some servers refuse it, so fall back to the body, which
   * the cache should already hold.
   * @param {number} durationSeconds
   */
  async computeAndEmitKbps(durationSeconds) {
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

    const kbps = Math.max(
      1,
      Math.round((bytes * 8) / 1000 / Math.max(1, durationSeconds))
    );
    this.emitMeta({ kbps });
  }
}
