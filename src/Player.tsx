import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Window as DdWindow } from '@dreamdesk/ui';
import {
  clickTrack, selectAll, invertSelection, removeSelected, crop, clear,
  sortByTitle, sortByArtist, reverse, randomize, type PlaylistState, type Selection,
} from './playlist';
import '@dreamdesk/ui/style.css';
import './player.css';
import { SKINS, DEFAULT_SKIN, type Skin } from './skins';
import type { AudioSource } from './Visualizer';
import { WINDOW_ICONS } from './windowIcons';
import {
  EQ_PRESETS,
  EQ_PRESET_ORDER,
  EQ_FREQS,
  EQ_LABELS,
  drawHistogram,
  drawOscilloscope,
  nextVisualizerMode,
  AudioEngine,
} from '../core/index.js';

/** Winamp's visualizer modes: spectrum bars, oscilloscope, or nothing. */
export type VisualizerMode = 'bars' | 'scope' | 'off';

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
  /** Called when the user picks a skin, so hosts can remember it. */
  onSkinChange?: (skinId: string) => void;
  /** Start expanded, with the playlist and EQ open. */
  defaultFullscreen?: boolean;
  /** Called when the player is expanded or collapsed, so hosts can remember it. */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** The visualizer's starting mode; a click on it cycles bars, scope, off. */
  defaultVisualizerMode?: VisualizerMode;
  /** Called when the visualizer's mode changes (e.g. to remember it). */
  onVisualizerModeChange?: (mode: VisualizerMode) => void;
  /**
   * Called with the Player's audio once it exists, and with null when the
   * Player goes away: give it to a `<Visualizer>` elsewhere (its own window).
   */
  onAudioSource?: (source: AudioSource | null) => void;
  /** Adds Visualization to the right-click menu, calling this, e.g. to open or close a `VisualizerWindow`. */
  onVisualizerToggle?: () => void;
  /** Whether that visualizer is open, so the menu ticks it. */
  visualizerOpen?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

// The playlist and EQ fold open and shut, so the window grows and shrinks
// with them. (Fading them in place left an empty block of window
// background, white or black depending on the skin, and then a jump.)
const folded = { height: '0px', opacity: 0, borderTopWidth: '0px', borderBottomWidth: '0px' };
// Follows dreamdesk-ui's pace for the whole app (--dd-motion-pace, default 1)
const pace = () => {
  const p = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dd-motion-pace'));
  return Number.isFinite(p) && p > 0 ? p : 1;
};
// Near-instant for people who ask their system for less motion (as in dreamdesk-ui)
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/**
 * Folds a panel open or shut. A fold in the other direction (a quick second
 * click) takes over from wherever this one has got to, rather than jumping.
 */
const fold = (el: HTMLDivElement, open: boolean) => {
  const running = el.getAnimations();
  const cs = getComputedStyle(el);
  const now = running.length
    ? { height: cs.height, opacity: cs.opacity, borderTopWidth: cs.borderTopWidth, borderBottomWidth: cs.borderBottomWidth }
    : null;
  running.forEach((a) => { a.finished.catch(() => {}); a.cancel(); });
  const shown = { height: `${el.offsetHeight}px`, opacity: 1 };
  el.style.overflow = 'hidden';
  const a = el.animate(open ? [now ?? folded, shown] : [now ?? shown, folded], {
    duration: reducedMotion() ? 1 : Math.round(400 * pace()),
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Shut stays shut until React removes the panel
    fill: open ? 'none' : 'forwards',
  });
  return a.finished.then(() => { if (open) el.style.overflow = ''; }, () => {});
};
const slideIn = (el: HTMLDivElement | null) => { if (el) void fold(el, true); };
const slideOut = (el: HTMLDivElement | null): Promise<void> => (el ? fold(el, false) : Promise.resolve());

export function Player({
  skin: initialSkinId = DEFAULT_SKIN,
  initialTracks = [],
  onClose,
  initialX = 200,
  initialY = 100,
  disableSnap = false,
  icon,
  onMove,
  onSkinChange,
  defaultFullscreen = false,
  onFullscreenChange,
  defaultVisualizerMode = 'bars',
  onVisualizerModeChange,
  onAudioSource,
  onVisualizerToggle,
  visualizerOpen = false,
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
  const [showPlaylist, setShowPlaylist] = useState(defaultFullscreen);
  const [showEq, setShowEq]             = useState(defaultFullscreen);
  const [showPresets, setShowPresets]   = useState(false);
  // Winamp's main menu: right-click the player (transport, panels, skins)
  const [mainMenu, setMainMenu]         = useState<{ x: number; y: number } | null>(null);
  const [playlist, setPlaylist]         = useState<Track[]>(initialTracks);
  const [currentIdx, setCurrentIdx]     = useState(0);
  // Winamp's playlist: click selects, double-click (or Enter) plays
  const [selection, setSelection]       = useState<Selection>({ selected: [], anchor: null });
  const [openMenu, setOpenMenu]         = useState<'rem' | 'sel' | 'misc' | null>(null);
  const [eqBands, setEqBands]           = useState<number[]>(Array(7).fill(0));

  // ── Refs ──────────────────────────────────────────────────────────────────
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const [vizMode, setVizMode] = useState<VisualizerMode>(defaultVisualizerMode);
  // Read by the frame callback, which is set up once
  const vizModeRef    = useRef(vizMode);
  const waveRef       = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const uploadRef     = useRef<HTMLInputElement>(null);
  const engineRef     = useRef<AudioEngine | null>(null);
  // Read by the frame callback so a skin change lands on the next frame
  // rather than waiting for playback to restart.
  const stopsRef      = useRef(skin.histogramGradient);
  const historyRef    = useRef<number[]>([]);
  const shuffleRef    = useRef(shuffle);
  const repeatRef     = useRef(repeat);
  const playlistRef   = useRef(playlist);
  const currentIdxRef = useRef(currentIdx);
  const isSeekingRef  = useRef(false);
  const preFsPlaylistRef = useRef(false);
  const preFsEqRef       = useRef(false);
  const preFsVizRef      = useRef(false);
  const playlistDomRef   = useRef<HTMLDivElement>(null);
  const eqDomRef         = useRef<HTMLDivElement>(null);
  const bytesCacheRef    = useRef<Map<string, Promise<number>>>(new Map());
  // Read by the audio-graph effect, which runs once
  const onAudioSourceRef = useRef(onAudioSource);
  useEffect(() => { onAudioSourceRef.current = onAudioSource; }, [onAudioSource]);
  // Expanding opens the visualizer along with the playlist and EQ; collapsing
  // puts it back the way it was, like them
  const vizRef = useRef({ open: visualizerOpen, toggle: onVisualizerToggle });
  useEffect(() => { vizRef.current = { open: visualizerOpen, toggle: onVisualizerToggle }; }, [visualizerOpen, onVisualizerToggle]);
  const onFullscreen = useCallback((isFullscreen: boolean) => {
    onFullscreenChange?.(isFullscreen);
    const viz = vizRef.current;
    if (!viz.toggle) return;
    if (isFullscreen) {
      preFsVizRef.current = viz.open;
      if (!viz.open) viz.toggle();
    } else if (viz.open && !preFsVizRef.current) viz.toggle();
  }, [onFullscreenChange]);

  useEffect(() => { shuffleRef.current = shuffle; },  [shuffle]);
  useEffect(() => { repeatRef.current = repeat; },    [repeat]);
  useEffect(() => { playlistRef.current = playlist; },[playlist]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  // ── Audio graph (imperative to survive StrictMode double-invoke) ──────────
  // The graph itself lives in core/audio-engine.js, shared with the vanilla
  // player. This effect owns only its lifetime: one engine per mount, disposed
  // on unmount. loop is off because the repeat and next-track logic below
  // needs 'ended' to fire, and no onMeta is passed because the audio-events
  // effect tracks duration, kHz and kbps itself, with its own byte cache.
  useEffect(() => {
    const engine = new AudioEngine(null, {
      loop: false,
      crossOrigin: null,
      onFrame: (data, prevData) => {
        const canvas = canvasRef.current;
        const ctx2d = canvas?.getContext('2d');
        if (!canvas || !ctx2d) return;
        const mode = vizModeRef.current;
        if (mode === 'bars') drawHistogram(ctx2d, canvas, data, prevData, stopsRef.current);
        else if (mode === 'scope') {
          const analyser = engineRef.current?.analyser;
          if (!analyser) return;
          if (waveRef.current?.length !== analyser.fftSize) waveRef.current = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(waveRef.current);
          drawOscilloscope(ctx2d, canvas, waveRef.current, stopsRef.current);
        }
      },
    });
    engineRef.current = engine;

    const audio = engine.audio!;
    audio.volume = 0.5;
    audioRef.current = audio;
    onAudioSourceRef.current?.({ analyser: engine.analyser, audio });

    return () => {
      onAudioSourceRef.current?.(null);
      engine.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, []);

  useEffect(() => { stopsRef.current = skin.histogramGradient; }, [skin.histogramGradient]);

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
  // The engine owns the frame loop and the analyser read; onFrame does the
  // drawing. Callers start it with engineRef.current.start(), which also
  // resumes the context and plays.
  const stopAnimation = useCallback(() => {
    engineRef.current?.cancelAnimation();
  }, []);

  // ── Play track ────────────────────────────────────────────────────────────
  const playTrack = useCallback(async (index: number, list?: Track[]) => {
    const tracks = list ?? playlistRef.current;
    const audio = audioRef.current;
    if (!audio || !tracks.length) return;
    const i = ((index % tracks.length) + tracks.length) % tracks.length;
    audio.pause();
    audio.src = tracks[i].src;
    fetchBytes(tracks[i].src);
    setCurrentIdx(i);
    currentIdxRef.current = i;
    setTrackLabel(tracks[i].artist ? `${tracks[i].title} — ${tracks[i].artist}` : tracks[i].title);
    await engineRef.current?.start();
  }, []);

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
      const k = engineRef.current?.sampleRateKhz() ?? 0;
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
    // computeKbps only uses refs and a state setter, so the first render's is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goNext, stopAnimation]);

  // ── Volume / balance / EQ ─────────────────────────────────────────────────
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume]);
  useEffect(() => { engineRef.current?.setPan(balance / 100); }, [balance]);
  useEffect(() => {
    eqBands.forEach((gain, i) => engineRef.current?.setEqGain(i, gain));
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
        } catch (_) { /* some servers refuse HEAD: download it instead */ }
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
    if (!audio) return;
    if (!audio.src && playlistRef.current.length) {
      audio.src = playlistRef.current[0].src;
      fetchBytes(playlistRef.current[0].src);
    }
    await engineRef.current?.start();
  }, []);

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

  // ── Playlist menus (REM, SEL, MISC) ───────────────────────────────────────
  const listState = (): PlaylistState<Track> => ({ list: playlistRef.current, current: currentIdxRef.current });
  const changeList = (next: PlaylistState<Track>) => {
    playlistRef.current = next.list;
    currentIdxRef.current = next.current;
    setPlaylist(next.list);
    setCurrentIdx(next.current);
    setSelection({ selected: [], anchor: null });
  };
  const selected = selection.selected.filter((i) => i < playlist.length);
  const setSelected = (indices: number[]) => setSelection({ selected: indices, anchor: null });

  // A click elsewhere, or Escape, closes the open menu
  useEffect(() => {
    if (!openMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('.dd-player__menu-wrap')) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  type MenuItem = [label: string, run: () => void, disabled?: boolean];
  const menu = (id: 'rem' | 'sel' | 'misc', label: string, title: string, items: MenuItem[]) => (
    <div className="dd-player__menu-wrap">
      <button className="dd-player__statusbar-btn" title={title} aria-haspopup="menu" aria-expanded={openMenu === id}
        onClick={() => { setMainMenu(null); setOpenMenu((m) => (m === id ? null : id)); }}>
        {label}
      </button>
      <div role="menu" className={`dd-player__dropdown-menu dd-player__dropdown-menu--up dd-player__dropdown-menu--left${openMenu === id ? ' open' : ''}`}>
        {items.map(([text, run, disabled]) => (
          <button key={text} role="menuitem" disabled={disabled} onClick={() => { run(); setOpenMenu(null); }}>{text}</button>
        ))}
      </div>
    </div>
  );

  // ── Visualizer mode (click the display, as in Winamp) ─────────────────────
  const cycleViz = () => {
    const next = nextVisualizerMode(vizModeRef.current);
    vizModeRef.current = next;
    setVizMode(next);
    onVisualizerModeChange?.(next);
    // Off: clear what's drawn now, since no more frames will
    if (next === 'off') {
      const canvas = canvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // ── Main menu (right-click) ───────────────────────────────────────────────
  const openMainMenu = (e: React.MouseEvent) => {
    // Inputs and buttons keep the browser's menu (copy, paste)
    if ((e.target as Element).closest('input, select, textarea')) return;
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu(null);
    setMainMenu({ x: e.clientX, y: e.clientY });
  };
  const mainMenuRef = useRef<HTMLDivElement>(null);
  // Kept on screen: flip left/up if it would spill over an edge
  useLayoutEffect(() => {
    const el = mainMenuRef.current;
    if (!el || !mainMenu) return;
    const r = el.getBoundingClientRect();
    const left = mainMenu.x + r.width > window.innerWidth ? Math.max(0, mainMenu.x - r.width) : mainMenu.x;
    const top = mainMenu.y + r.height > window.innerHeight ? Math.max(0, mainMenu.y - r.height) : mainMenu.y;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [mainMenu]);
  useEffect(() => {
    if (!mainMenu) return;
    const close = () => setMainMenu(null);
    const onPointerDown = (e: PointerEvent) => { if (!mainMenuRef.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [mainMenu]);

  const chooseSkin = (id: string) => { setSkinId(id); onSkinChange?.(id); };
  type MainItem = { label: string; run: () => void; checked?: boolean; disabled?: boolean } | 'separator' | { heading: string };
  const mainItems: MainItem[] = [
    { label: 'Play', run: () => void handlePlay(), disabled: isPlaying || !playlist.length },
    { label: 'Pause', run: handlePause, disabled: !isPlaying },
    { label: 'Stop', run: handleStop },
    { label: 'Previous', run: goPrev, disabled: !playlist.length },
    { label: 'Next', run: goNext, disabled: !playlist.length },
    'separator',
    { label: 'Playlist', run: () => togglePanel('playlist'), checked: showPlaylist },
    { label: 'Equalizer', run: () => togglePanel('eq'), checked: showEq },
    // Winamp started its visualization plugin (MilkDrop) from here, not a button
    ...(onVisualizerToggle ? [{ label: 'Visualization', run: onVisualizerToggle, checked: visualizerOpen }] : []),
    'separator',
    { heading: 'Skins' },
    ...Object.values(SKINS).map(sk => ({ label: sk.label, run: () => chooseSkin(sk.id), checked: sk.id === skinId })),
  ];

  // ── EQ presets ────────────────────────────────────────────────────────────
  const applyPreset = useCallback((name: string) => {
    const v = EQ_PRESETS[name];
    if (v) setEqBands([...v]);
    setShowPresets(false);
  }, []);

  // ── Opening and closing the playlist and EQ ─────────────────────────────
  // PL, EQ, the menu and expanding all go through showPanel, so every way of
  // opening or closing a panel folds it the same way.

  type Panel = 'playlist' | 'eq';
  const panelDom = useCallback((p: Panel) => (p === 'playlist' ? playlistDomRef : eqDomRef).current, []);
  const setPanel = useCallback((p: Panel, show: boolean) => (p === 'playlist' ? setShowPlaylist : setShowEq)(show), []);
  // Panels just mounted, to fold open once they're in the DOM
  const slideInNextRef = useRef(new Set<Panel>());
  // Each panel's latest open/close, so a close finishing late can't undo a reopen
  const panelTargetRef = useRef<Record<Panel, boolean>>({ playlist: showPlaylist, eq: showEq });

  const showPanel = useCallback((p: Panel, show: boolean) => {
    if (panelTargetRef.current[p] === show) return;
    panelTargetRef.current[p] = show;
    const el = panelDom(p);
    if (show && el) slideIn(el); // still folding shut: open it again from there
    else if (show) { slideInNextRef.current.add(p); setPanel(p, true); }
    else void slideOut(el).then(() => { if (!panelTargetRef.current[p]) setPanel(p, false); });
  }, [panelDom, setPanel]);
  const togglePanel = (p: Panel) => showPanel(p, !panelTargetRef.current[p]);

  // Runs after React commits the newly mounted panels to the DOM
  useEffect(() => {
    for (const p of slideInNextRef.current) {
      const el = panelDom(p);
      if (el) { slideIn(el); slideInNextRef.current.delete(p); }
    }
  }, [showPlaylist, showEq, panelDom]);

  // Expanding opens both; collapsing puts each back the way it was
  const fullscreenAnimation = useCallback((_el: HTMLElement, { isFullscreen }: { isFullscreen: boolean; defaultFn: () => void }) => {
    if (isFullscreen) {
      preFsPlaylistRef.current = panelTargetRef.current.playlist;
      preFsEqRef.current = panelTargetRef.current.eq;
      showPanel('playlist', true);
      showPanel('eq', true);
    } else {
      showPanel('playlist', preFsPlaylistRef.current);
      showPanel('eq', preFsEqRef.current);
    }
  }, [showPanel]);

  // ── Render ────────────────────────────────────────────────────────────────
  const { minimizeIcon, fullscreenIcon, closeIcon } = WINDOW_ICONS;

  const remaining = Math.max(0, duration - currentTime);
  const timer = fmtTime(remaining);

  return (
    <>
    <DdWindow
      title="player"
      movable
      resizable={false}
      disableSnap={disableSnap}
      icon={icon}
      fullscreenMode="expand"
      // On phones (compact desktops) keep the player's own size instead of
      // stretching it over the whole screen
      compactLayout="fit"
      width="297px"
      minimizeIcon={minimizeIcon}
      fullscreenIcon={fullscreenIcon}
      closeIcon={closeIcon}
      onClose={onClose}
      onMove={onMove}
      fullscreenAnimation={fullscreenAnimation}
      defaultFullscreen={defaultFullscreen}
      onFullscreen={onFullscreen}
      style={{ position: 'absolute', left: initialX, top: initialY, ...skin.vars as React.CSSProperties }}
      className="dd-player"
    >
      {/* Player body */}
      <div className="dd-player__body" onContextMenu={openMainMenu}>
        <div className="dd-player__display">

          <div className="dd-player__viz">
            <div className="dd-player__timer">{timer}</div>
            <canvas ref={canvasRef} width={100} height={35}
              className="dd-player__viz-canvas" role="button" tabIndex={0}
              aria-label={`Visualizer: ${vizMode === 'bars' ? 'spectrum' : vizMode === 'scope' ? 'oscilloscope' : 'off'} (click to change)`}
              title="Click to change the visualizer"
              onClick={cycleViz}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleViz(); } }} />
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
            <button className="dd-player__mini-btn" onClick={() => togglePanel('eq')}>EQ</button>
            <button className="dd-player__mini-btn" onClick={() => togglePanel('playlist')}>PL</button>
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
        <div className="dd-player__playlist" ref={playlistDomRef} onContextMenu={openMainMenu}>
          <div className="dd-player__playlist-header">playlist</div>
          <div className="dd-player__track-list">
            <ol className="dd-player__track-items">
              {playlist.map((t, i) => (
                <li key={i}
                  className={[i === currentIdx && 'active', selected.includes(i) && 'selected'].filter(Boolean).join(' ')}
                  aria-selected={selected.includes(i)}
                  tabIndex={0}
                  // Shift-click selects a range, not the text
                  onMouseDown={e => { if (e.shiftKey) e.preventDefault(); }}
                  onClick={e => setSelection(sel => clickTrack(sel, i, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey }))}
                  onDoubleClick={() => playTrack(i)}
                  onKeyDown={e => e.key === 'Enter' && playTrack(i)}>
                  {t.artist ? `${t.title} — ${t.artist}` : t.title}
                </li>
              ))}
            </ol>
          </div>
          <div className="dd-player__playlist-statusbar">
            <div className="dd-player__playlist-statusbar-btns">
              <button className="dd-player__statusbar-btn" title="Add" onClick={() => uploadRef.current?.click()}>ADD</button>
              {menu('rem', 'REM', 'Remove', [
                ['Remove selected', () => changeList(removeSelected(listState(), selected)), !selected.length],
                ['Crop (keep selected)', () => changeList(crop(listState(), selected)), !selected.length],
                ['Clear playlist', () => changeList(clear(listState())), !playlist.length],
              ])}
              {menu('sel', 'SEL', 'Select', [
                ['Select all', () => setSelected(selectAll(playlist.length)), !playlist.length],
                ['Select none', () => setSelected([]), !selected.length],
                ['Invert selection', () => setSelected(invertSelection(playlist.length, selected)), !playlist.length],
              ])}
              {menu('misc', 'MISC', 'Misc', [
                ['Sort by title', () => changeList(sortByTitle(listState())), playlist.length < 2],
                ['Sort by artist', () => changeList(sortByArtist(listState())), playlist.length < 2],
                ['Randomize list', () => changeList(randomize(listState())), playlist.length < 2],
                ['Reverse list', () => changeList(reverse(listState())), playlist.length < 2],
              ])}
            </div>
          </div>
        </div>
      )}

      {/* EQ */}
      {showEq && (
        <div className="dd-player__eq" ref={eqDomRef} onContextMenu={openMainMenu}>
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
    {mainMenu && createPortal(
      <div
        ref={mainMenuRef}
        role="menu"
        className="dd-player__dropdown-menu dd-player__main-menu open"
        style={{ ...(skin.vars as React.CSSProperties), left: mainMenu.x, top: mainMenu.y }}
        onContextMenu={e => e.preventDefault()}
      >
        {mainItems.map((item, i) =>
          item === 'separator' ? <div key={i} className="dd-player__menu-separator" role="separator" />
          : 'heading' in item ? <div key={i} className="dd-player__menu-heading">{item.heading}</div>
          : (
            <button key={i} role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
              aria-checked={item.checked} disabled={item.disabled}
              onClick={() => { item.run(); setMainMenu(null); }}>
              <span className="dd-player__menu-check" aria-hidden>{item.checked ? '✓' : ''}</span>{item.label}
            </button>
          ))}
      </div>,
      document.body,
    )}
    </>
  );
}
