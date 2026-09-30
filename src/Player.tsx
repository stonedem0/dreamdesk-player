import { useState, useEffect, useRef, useCallback } from 'react';
import { Window as DdWindow } from 'dreamdesk-ui';
import 'dreamdesk-ui/style.css';
import './player.css';
import { SKINS, DEFAULT_SKIN, type Skin } from './skins';

// ── EQ Presets ─────────────────────────────────────────────────────────────

const WINAMP_10_BAND_PRESETS: Record<string, number[]> = {
  flat:                    [ 0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
  classical:               [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  club:                    [ 0,  0,  3,  4,  4,  4,  3,  0,  0,  0],
  dance:                   [ 5,  4,  1, -2, -1,  1,  3,  4,  5,  5],
  'laptop speakers/headphones': [ 3,  6,  4, -2, -1,  1,  3,  5,  7,  8],
  'large hall':            [ 7,  7,  5,  5,  3,  1,  0,  0,  0,  0],
  party:                   [ 4,  4,  1,  0,  0,  0,  1,  3,  4,  4],
  pop:                     [-1,  2,  4,  5,  5,  4,  2,  0, -1, -1],
  reggae:                  [ 0,  0,  0, -2,  0,  2,  2,  0,  0,  0],
  rock:                    [ 5,  3, -2, -4, -2,  2,  6,  8,  8,  7],
  soft:                    [ 2,  1,  0, -1, -1, -1,  0,  1,  2,  3],
  ska:                     [-2,  0,  3,  3,  2,  1,  0,  0,  0,  0],
  'full bass':             [10,  9,  7,  4,  0, -4, -6, -8, -8, -8],
  'soft rock':             [ 4,  2, -1, -2, -1,  1,  3,  4,  6,  8],
  'full treble':           [-8, -8, -8, -6, -4,  0,  4,  8,  9, 10],
  'full bass & treble':    [10,  8,  6,  2, -2, -4, -2,  6,  8, 10],
  live:                    [-4, -2,  0,  4,  4,  4,  2,  0, -2, -4],
  techno:                  [ 4,  3,  2,  0, -2, -1,  1,  3,  4,  4],
};

const EQ_PRESET_ORDER = [
  'flat','classical','club','dance','laptop speakers/headphones','large hall',
  'party','pop','reggae','rock','soft','ska','full bass','soft rock',
  'full treble','full bass & treble','live','techno',
];

function map10to7(v: number[]): number[] {
  const s = (i: number) => (Number.isFinite(v[i]) ? v[i] : 0);
  const avg = (a: number, b: number) => (s(a) + s(b)) / 2;
  return [s(0), s(1), avg(2,3), s(4), s(5), avg(6,7), avg(8,9)];
}

const EQ_PRESETS: Record<string, number[]> = Object.fromEntries(
  EQ_PRESET_ORDER.map(k => [k, map10to7(WINAMP_10_BAND_PRESETS[k])])
);

const EQ_FREQS  = [60, 170, 350, 1000, 3000, 10000, 16000];
const EQ_LABELS = ['60', '170', '350', '1k', '3k', '10k', '16k'];

// ── Audio helpers ──────────────────────────────────────────────────────────

function processAudioData(data: Float32Array): number[] {
  const out = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    out[i] = x < -100 ? -100 : x * 1.5;
  }
  return out;
}

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: number[],
  prevData: number[],
  stops: [number, string][],
) {
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

// ── Types ──────────────────────────────────────────────────────────────────

export interface Track { title: string; artist: string; src: string; }

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Props ──────────────────────────────────────────────────────────────────

export interface PlayerProps {
  skin?: string;
  initialTracks?: Track[];
  onClose?: () => void;
  initialX?: number;
  initialY?: number;
  disableSnap?: boolean;
  icon?: string;
  onMove?: (x: number, y: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function Player({
  skin: initialSkinId = DEFAULT_SKIN,
  initialTracks = [],
  onClose,
  initialX = 200,
  initialY = 100,
  disableSnap = false,
  icon,
  onMove,
}: PlayerProps) {
  const [skinId, setSkinId] = useState(initialSkinId);
  const skin: Skin = SKINS[skinId] ?? SKINS[DEFAULT_SKIN]!;


  // ── State ─────────────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [volume, setVolume]             = useState(50);
  const [balance, setBalance]           = useState(0);
  const [shuffle, setShuffle]           = useState(false);
  const [repeat, setRepeat]             = useState(false);
  const trackLabel0 = initialTracks.length ? (initialTracks[0].artist ? `${initialTracks[0].title} — ${initialTracks[0].artist}` : initialTracks[0].title) : '';
  const [trackLabel, setTrackLabel]     = useState(trackLabel0);
  const [kbps, setKbps]                 = useState('');
  const [khz, setKhz]                   = useState('');
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showEq, setShowEq]             = useState(false);
  const [showPresets, setShowPresets]   = useState(false);
  const [showSkinMenu, setShowSkinMenu] = useState(false);
  const [playlist, setPlaylist]         = useState<Track[]>(initialTracks);
  const [currentIdx, setCurrentIdx]     = useState(0);
  const [eqBands, setEqBands]           = useState<number[]>(Array(7).fill(0));

  // ── Refs ──────────────────────────────────────────────────────────────────
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const uploadRef     = useRef<HTMLInputElement>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const filtersRef    = useRef<BiquadFilterNode[]>([]);
  const pannerRef     = useRef<StereoPannerNode | null>(null);
  const rafRef        = useRef(0);
  const prevDataRef   = useRef<number[]>([]);
  const historyRef    = useRef<number[]>([]);
  const shuffleRef    = useRef(shuffle);
  const repeatRef     = useRef(repeat);
  const playlistRef   = useRef(playlist);
  const currentIdxRef = useRef(currentIdx);
  const isSeekingRef  = useRef(false);
  const showPlaylistRef  = useRef(showPlaylist);
  const showEqRef        = useRef(showEq);
  const preFsPlaylistRef = useRef(false);
  const preFsEqRef       = useRef(false);
  const playlistDomRef   = useRef<HTMLDivElement>(null);
  const eqDomRef         = useRef<HTMLDivElement>(null);
  const bytesCacheRef    = useRef<Map<string, Promise<number>>>(new Map());

  useEffect(() => { shuffleRef.current = shuffle; },  [shuffle]);
  useEffect(() => { repeatRef.current = repeat; },    [repeat]);
  useEffect(() => { playlistRef.current = playlist; },[playlist]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  useEffect(() => { showPlaylistRef.current = showPlaylist; }, [showPlaylist]);
  useEffect(() => { showEqRef.current = showEq; }, [showEq]);

  // ── Audio graph (imperative to survive StrictMode double-invoke) ──────────
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.5;
    audioRef.current = audio;

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const filters = EQ_FREQS.map((freq, i) => {
      const f = ctx.createBiquadFilter();
      f.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking';
      if (f.type === 'peaking') f.Q.value = 1.0;
      f.frequency.value = freq;
      f.gain.value = 0;
      return f;
    });
    filtersRef.current = filters;

    const panner = ctx.createStereoPanner();
    pannerRef.current = panner;

    const source = ctx.createMediaElementSource(audio);
    let node: AudioNode = source;
    node.connect(panner); node = panner;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(analyser);
    analyser.connect(ctx.destination);

    return () => {
      cancelAnimationFrame(rafRef.current);
      audio.pause();
      ctx.close();
      audioRef.current = null;
    };
  }, []);

  // ── Load manifest ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialTracks.length) return;
    fetch('/public/tracks/manifest.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((files: unknown) => {
        if (!Array.isArray(files)) return;
        const tracks = (files as unknown[]).flatMap(e => {
          if (typeof e === 'string') return [{ title: e.replace(/\.(mp3|wav|ogg|m4a)$/i, ''), artist: '', src: `/public/tracks/${e}` }];
          if (e && typeof e === 'object') {
            const o = e as Record<string, string>;
            const file = o.file || o.name || '';
            return [{ title: o.title || file.replace(/\.(mp3|wav|ogg|m4a)$/i, ''), artist: o.artist || '', src: `/public/tracks/${file}` }];
          }
          return [];
        }).filter(t => /\.(mp3|wav|ogg|m4a)$/i.test(t.src));
        if (tracks.length) {
          setPlaylist(tracks);
          playlistRef.current = tracks;
          setTrackLabel(tracks[0].artist ? `${tracks[0].title} — ${tracks[0].artist}` : tracks[0].title);
          // Prefetch sizes now, before playback starts — once a track is
          // actually streaming, its own range requests saturate the
          // connection pool and starve a same-URL HEAD fetch for a long time.
          tracks.forEach(t => fetchBytes(t.src));
        }
      })
      .catch(() => {});
  }, [initialTracks.length]);

  useEffect(() => {
    initialTracks.forEach(t => fetchBytes(t.src));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animation ─────────────────────────────────────────────────────────────
  const startAnimation = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const dataArray = new Float32Array(analyser.frequencyBinCount);
    if (!prevDataRef.current.length) prevDataRef.current = new Array(analyser.frequencyBinCount).fill(0);
    const stops = skin.histogramGradient;
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      analyser.getFloatFrequencyData(dataArray);
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) drawHistogram(ctx2d, canvas, processAudioData(dataArray), prevDataRef.current, stops);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [skin.histogramGradient]);

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  // ── Play track ────────────────────────────────────────────────────────────
  const playTrack = useCallback(async (index: number, list?: Track[]) => {
    const tracks = list ?? playlistRef.current;
    const audio = audioRef.current;
    const ctx = audioCtxRef.current;
    if (!audio || !tracks.length) return;
    const i = ((index % tracks.length) + tracks.length) % tracks.length;
    audio.pause();
    audio.src = tracks[i].src;
    fetchBytes(tracks[i].src);
    setCurrentIdx(i);
    currentIdxRef.current = i;
    setTrackLabel(tracks[i].artist ? `${tracks[i].title} — ${tracks[i].artist}` : tracks[i].title);
    if (ctx?.state === 'suspended') await ctx.resume();
    await audio.play().catch(() => {});
    startAnimation();
  }, [startAnimation]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const goNext = useCallback(() => {
    const list = playlistRef.current;
    if (!list.length) return;
    const cur = currentIdxRef.current;
    let next: number;
    if (shuffleRef.current) {
      next = list.length > 1 ? Math.floor(Math.random() * list.length) : 0;
      if (next === cur && list.length > 1) next = (next + 1) % list.length;
    } else {
      next = cur + 1;
      if (next >= list.length) { if (repeatRef.current) next = 0; else return; }
    }
    historyRef.current.push(cur);
    if (historyRef.current.length > 50) historyRef.current.shift();
    playTrack(next);
  }, [playTrack]);

  const goPrev = useCallback(() => {
    if (shuffleRef.current && historyRef.current.length) { playTrack(historyRef.current.pop()!); return; }
    playTrack(Math.max(0, currentIdxRef.current - 1));
  }, [playTrack]);

  // ── Audio events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay      = () => setIsPlaying(true);
    const onPause     = () => setIsPlaying(false);
    const onTimeUpdate = () => { if (!isSeekingRef.current) setCurrentTime(Math.floor(audio.currentTime)); };
    const onMeta = () => {
      const d = isFinite(audio.duration) ? Math.floor(audio.duration) : 0;
      setDuration(d);
      const k = Math.round((audioCtxRef.current?.sampleRate ?? 0) / 1000);
      if (k) setKhz(String(k));
      if (audio.src && d > 0) computeKbps(audio.src, d);
    };
    const onEnded = () => {
      if (shuffleRef.current || repeatRef.current) { goNext(); return; }
      if (currentIdxRef.current < playlistRef.current.length - 1) goNext();
      else { setIsPlaying(false); stopAnimation(); }
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
    };
  }, [goNext, stopAnimation]);

  // ── Volume / balance / EQ ─────────────────────────────────────────────────
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);
  useEffect(() => { if (pannerRef.current) pannerRef.current.pan.value = balance / 100; }, [balance]);
  useEffect(() => {
    eqBands.forEach((gain, i) => { if (filtersRef.current[i]) filtersRef.current[i].gain.value = gain; });
  }, [eqBands]);

  function fetchBytes(rawSrc: string): Promise<number> {
    // Normalize: audio.src always reads back as an absolute URL, while
    // playlist entries store relative paths — without this, prefetch and
    // the loadedmetadata-triggered lookup use different cache keys and
    // the prefetch never gets hit.
    const src = new URL(rawSrc, window.location.href).href;
    let p = bytesCacheRef.current.get(src);
    if (!p) {
      p = (async () => {
        try {
          const h = await fetch(src, { method: 'HEAD', cache: 'force-cache' });
          const n = parseInt(h.headers.get('content-length') ?? '0', 10) || 0;
          if (n) return n;
        } catch (_) {}
        try { return (await (await fetch(src, { cache: 'force-cache' })).blob()).size; } catch (_) { return 0; }
      })();
      bytesCacheRef.current.set(src, p);
    }
    return p;
  }

  async function computeKbps(src: string, dur: number) {
    const bytes = await fetchBytes(src);
    if (!bytes) return;
    setKbps(String(Math.max(1, Math.round((bytes * 8) / 1000 / Math.max(1, dur)))));
  }

  // ── Transport ─────────────────────────────────────────────────────────────
  const handlePlay = useCallback(async () => {
    const audio = audioRef.current;
    const ctx = audioCtxRef.current;
    if (!audio) return;
    if (!audio.src && playlistRef.current.length) {
      audio.src = playlistRef.current[0].src;
      fetchBytes(playlistRef.current[0].src);
    }
    if (ctx?.state === 'suspended') await ctx.resume();
    await audio.play().catch(() => {});
    startAnimation();
  }, [startAnimation]);

  const handlePause = useCallback(() => { audioRef.current?.pause(); stopAnimation(); }, [stopAnimation]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause(); audio.currentTime = 0;
    stopAnimation(); setCurrentTime(0);
  }, [stopAnimation]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const title = file.name.replace(/\.(mp3|wav|ogg|m4a)$/i, '');
    setPlaylist(prev => {
      const next = [...prev, { title, artist: '', src: url }];
      playlistRef.current = next;
      playTrack(next.length - 1, next);
      return next;
    });
    e.target.value = '';
  }, [playTrack]);

  // ── EQ presets ────────────────────────────────────────────────────────────
  const applyPreset = useCallback((name: string) => {
    const v = EQ_PRESETS[name];
    if (v) setEqBands([...v]);
    setShowPresets(false);
  }, []);

  // ── Fullscreen animation: show/hide playlist + EQ docks ──────────────────
  const slideIn = (el: HTMLDivElement | null) => el?.animate(
    [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 220, easing: 'ease' }
  );
  const slideOut = (el: HTMLDivElement | null): Promise<void> =>
    el?.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }],
      { duration: 220, easing: 'ease', fill: 'forwards' }
    ).finished.then(() => {}) ?? Promise.resolve();

  const pendingFsSlideInRef = useRef(false);

  // Runs after React commits the newly-mounted panels to the DOM
  useEffect(() => {
    if (pendingFsSlideInRef.current && showPlaylist && showEq) {
      pendingFsSlideInRef.current = false;
      slideIn(playlistDomRef.current);
      slideIn(eqDomRef.current);
    }
  }, [showPlaylist, showEq]);

  const fullscreenAnimation = useCallback((_el: HTMLElement, { isFullscreen }: { isFullscreen: boolean; defaultFn: () => void }) => {
    if (isFullscreen) {
      preFsPlaylistRef.current = showPlaylistRef.current;
      preFsEqRef.current = showEqRef.current;
      pendingFsSlideInRef.current = true;
      setShowPlaylist(true);
      setShowEq(true);
    } else {
      Promise.all([
        slideOut(playlistDomRef.current),
        slideOut(eqDomRef.current),
      ]).then(() => {
        setShowPlaylist(preFsPlaylistRef.current);
        setShowEq(preFsEqRef.current);
      });
    }
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const c = skin.accentColor;
  const minimizeIcon   = `<svg viewBox="0 0 24 24" width="14" height="14"><line x1="3" y1="17" x2="21" y2="17" stroke="${c}" stroke-width="3.5" stroke-linecap="butt"/></svg>`;
  const fullscreenIcon = `<svg viewBox="0 0 24 24" width="10" height="10"><rect x="3" y="3" width="18" height="18" fill="none" stroke="${c}" stroke-width="2.5"/><line x1="3" y1="8" x2="21" y2="8" stroke="${c}" stroke-width="3.5"/></svg>`;
  const closeIcon      = `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 5l14 14M19 5L5 19" stroke="${c}" stroke-width="3.5" stroke-linecap="butt"/></svg>`;

  const remaining = Math.max(0, duration - currentTime);
  const timer = fmtTime(remaining);

  return (
    <DdWindow
      title="player"
      movable
      resizable={false}
      disableSnap={disableSnap}
      icon={icon}
      fullscreenMode="expand"
      width="297px"
      minimizeIcon={minimizeIcon}
      fullscreenIcon={fullscreenIcon}
      closeIcon={closeIcon}
      onClose={onClose}
      onMove={onMove}
      fullscreenAnimation={fullscreenAnimation}
      style={{ position: 'absolute', left: initialX, top: initialY, ...skin.vars as React.CSSProperties }}
      className="dd-player"
    >
      {/* Player body */}
      <div className="dd-player__body">
        <div className="dd-player__display">

          <div className="dd-player__viz">
            <div className="dd-player__timer">{timer}</div>
            <canvas ref={canvasRef} width={100} height={35} />
          </div>

          <div className="dd-player__track">
            <p className="dd-player__neon" data-text={trackLabel}>{trackLabel || ' '}</p>
          </div>

          <div className="dd-player__screen dd-player__kbps">
            <span className="dd-player__screen-value">{kbps}</span>
            <span className="dd-player__screen-unit">kbps</span>
          </div>
          <div className="dd-player__screen dd-player__khz">
            <span className="dd-player__screen-value">{khz}</span>
            <span className="dd-player__screen-unit">kHz</span>
          </div>

          <div className="dd-player__sliders">
            <input type="range" min={0} max={100} value={volume} className="dd-player__volume"
              onChange={e => setVolume(Number(e.target.value))} />
            <input type="range" min={-100} max={100} value={balance} step={1} className="dd-player__balance"
              title="Balance" onChange={e => setBalance(Number(e.target.value))} />
            <button className="dd-player__mini-btn" onClick={() => setShowEq(v => !v)}>EQ</button>
            <button className="dd-player__mini-btn" onClick={() => setShowPlaylist(v => !v)}>PL</button>
          </div>

          <div className="dd-player__seek">
            <input type="range" min={0} max={duration || 100} value={currentTime} step={1}
              className="dd-player__seek-slider"
              onPointerDown={() => { isSeekingRef.current = true; }}
              onPointerUp={() => { isSeekingRef.current = false; }}
              onChange={e => {
                const v = Number(e.target.value);
                setCurrentTime(v);
                const audio = audioRef.current;
                if (audio && isFinite(audio.duration)) audio.currentTime = v;
              }} />
          </div>

          <div className="dd-player__controls">
            <button onClick={goPrev}>⏮︎</button>
            <button onClick={handlePause} disabled={!isPlaying}>⏸︎</button>
            <button onClick={handlePlay}>▶︎</button>
            <button onClick={handleStop}>⏹︎</button>
            <button onClick={goNext}>⏭︎</button>
            <button className="dd-player__upload-btn" onClick={() => uploadRef.current?.click()}>⏏︎</button>
            <input ref={uploadRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleUpload} />
            <button
              className={`dd-player__toggle dd-player__shuffle${shuffle ? ' dd-player__toggle--on' : ''}`}
              aria-pressed={shuffle} onClick={() => setShuffle(v => !v)}
            >Shuffle</button>
            <button
              className={`dd-player__toggle dd-player__repeat${repeat ? ' dd-player__toggle--on' : ''}`}
              aria-pressed={repeat} onClick={() => setRepeat(v => !v)}
            >Repeat</button>
          </div>

        </div>
      </div>

      {/* Playlist */}
      {showPlaylist && (
        <div className="dd-player__playlist" ref={playlistDomRef}>
          <div className="dd-player__playlist-header">playlist</div>
          <div className="dd-player__track-list">
            <ol className="dd-player__track-items">
              {playlist.map((t, i) => (
                <li key={i} className={i === currentIdx ? 'active' : ''}
                  tabIndex={0} onClick={() => playTrack(i)}
                  onKeyDown={e => e.key === 'Enter' && playTrack(i)}>
                  {t.artist ? `${t.title} — ${t.artist}` : t.title}
                </li>
              ))}
            </ol>
          </div>
          <div className="dd-player__playlist-statusbar">
            <div className="dd-player__playlist-statusbar-btns">
              <button className="dd-player__statusbar-btn" title="Add" onClick={() => uploadRef.current?.click()}>ADD</button>
              <button className="dd-player__statusbar-btn" title="Remove">REM</button>
              <button className="dd-player__statusbar-btn" title="Select">SEL</button>
              <button className="dd-player__statusbar-btn" title="Misc">MISC</button>
            </div>
            <div className="dd-player__skin-side">
              <button className="dd-player__statusbar-btn dd-player__settings-btn" title="Settings"
                onClick={() => setShowSkinMenu(v => !v)}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <div className={`dd-player__dropdown-menu dd-player__dropdown-menu--up${showSkinMenu ? ' open' : ''}`}>
                {Object.values(SKINS).map(s => (
                  <button key={s.id} role="menuitem" onClick={() => { setSkinId(s.id); setShowSkinMenu(false); }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EQ */}
      {showEq && (
        <div className="dd-player__eq" ref={eqDomRef}>
          <div className="dd-player__eq-panel">
            <div className="dd-player__eq-header"><span>equalizer</span></div>
            <div className="dd-player__eq-presets">
              <div className="dd-player__eq-side">
                <button className="dd-player__mini-btn" onClick={() => setShowPresets(v => !v)}>presets ▾</button>
                <div className={`dd-player__dropdown-menu${showPresets ? ' open' : ''}`}>
                  {EQ_PRESET_ORDER.map(key => (
                    <button key={key} role="menuitem" onClick={() => applyPreset(key)}>
                      {key.replace(/\b\w/g, m => m.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dd-player__eq-sliders">
                {EQ_FREQS.map((_, i) => (
                  <label key={i}>
                    <span>{EQ_LABELS[i]}</span>
                    <input className="dd-player__eq-slider" type="range" min={-12} max={12}
                      value={eqBands[i]} data-band={i}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setEqBands(prev => { const n = [...prev]; n[i] = v; return n; });
                      }} />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DdWindow>
  );
}
