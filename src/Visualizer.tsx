import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Window as DdWindow } from '@dreamdesk/ui';
import { createVisualizer } from '../visualizer.js';
import { SKINS, DEFAULT_SKIN, type Skin } from './skins';
import { WINDOW_ICONS } from './windowIcons';

/** The Player's audio, as handed out by its `onAudioSource`. */
export interface AudioSource {
  analyser: AnalyserNode;
  audio: HTMLAudioElement;
}

type Rgb = [number, number, number];
/** "#ff4800" as 0-1 per channel, for the shader. */
const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export interface VisualizerProps {
  /** What to draw: the Player's audio, from `onAudioSource`. Without one it just idles. */
  source: AudioSource | null;
  /** The three colours the rings cycle through. Default: the Tokyo Sunset skin's. */
  colors?: [string, string, string];
  /** Behind the rings. */
  background?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_LOOK = SKINS['tokyo-3-sunset']!.visualizer;

/**
 * The WebGL visualizer (MilkDrop-style rings), filling its container. For one
 * in a window that matches the Player, use `VisualizerWindow`.
 * Shows only its background where WebGL2 isn't available.
 */
export function Visualizer({ source, colors = DEFAULT_LOOK.colors, background = DEFAULT_LOOK.background, className, style }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vizRef = useRef<ReturnType<typeof createVisualizer> | null>(null);
  // Read every frame, so a new source (the Player reopened) is picked up
  // without restarting the GL context
  const sourceRef = useRef(source);
  useEffect(() => { sourceRef.current = source; }, [source]);
  const look = useRef({ colors, background });
  const [c0, c1, c2] = colors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const viz = createVisualizer({
      canvas,
      getAnalyser: () => sourceRef.current?.analyser ?? null,
      getAudio: () => sourceRef.current?.audio ?? null,
      onError: (err) => console.warn('Visualizer unavailable:', err.message),
      colors: look.current.colors.map(rgb),
      background: rgb(look.current.background),
    });
    vizRef.current = viz;
    viz.start();
    return () => { viz.destroy(); vizRef.current = null; };
  }, []);

  // A skin change recolours it in place
  useEffect(() => {
    look.current = { colors: [c0, c1, c2], background };
    vizRef.current?.setColors([c0, c1, c2].map(rgb), rgb(background));
  }, [c0, c1, c2, background]);

  // Double-click for fullscreen, as in MilkDrop (Esc or another double-click leaves)
  const toggleFullscreen = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (document.fullscreenElement === canvas) void document.exitFullscreen().catch(() => {});
    else void canvas.requestFullscreen?.().catch(() => {});
  };

  return (
    <canvas
      ref={canvasRef}
      className={['dd-visualizer', className].filter(Boolean).join(' ')}
      title="Double-click for fullscreen"
      onDoubleClick={toggleFullscreen}
      style={{ display: 'block', width: '100%', height: '100%', background, ...style }}
    />
  );
}

/** The Player's panels, which fold open and shut under it. */
const PANELS = ['dd-player__playlist', 'dd-player__eq'];

/**
 * How tall the Player is with every panel open, whichever are open now (and
 * however far a fold has got): its own height, less the panels' current
 * heights, plus their full ones. A closed panel isn't in the page, so its full
 * height comes from an empty, invisible stand-in with the same class, sized by
 * player.css like the real one.
 */
export function playerStackHeight(player: HTMLElement): number {
  let height = player.offsetHeight;
  for (const cls of PANELS) {
    const panel = player.querySelector<HTMLElement>(`.${cls}`);
    if (panel) height -= panel.offsetHeight;
    const probe = document.createElement('div');
    probe.className = cls;
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    player.appendChild(probe);
    height += probe.offsetHeight;
    probe.remove();
  }
  return height;
}

export interface VisualizerWindowProps {
  /** What to draw: the Player's audio, from its `onAudioSource`. */
  source: AudioSource | null;
  /** The Player's skin, so the two match (follow the Player's `onSkinChange`). */
  skin?: string;
  initialX?: number;
  initialY?: number;
  width?: string;
  /** Used when there's no `dockTo`. */
  height?: string;
  /**
   * The Player's window (a getter, read when this opens). The visualizer is as
   * tall as the Player with its playlist and EQ open, whether they're open or
   * not, the way MilkDrop ran the height of Winamp's stacked windows. It keeps
   * that (if the Player's size changes) until it's resized by hand.
   */
  dockTo?: () => HTMLElement | null;
  icon?: string;
  disableSnap?: boolean;
  onMove?: (x: number, y: number) => void;
  onClose?: () => void;
}

/**
 * The visualizer in a window of its own, skinned like the Player: Winamp's
 * MilkDrop window. Like it, only a close button: resize it by the corner, or
 * double-click it for fullscreen.
 */
export function VisualizerWindow({
  source, skin: skinId = DEFAULT_SKIN, initialX = 500, initialY = 100,
  width = '420px', height: fixedHeight = '320px', dockTo, icon, disableSnap, onMove, onClose,
}: VisualizerWindowProps) {
  const skin: Skin = SKINS[skinId] ?? SKINS[DEFAULT_SKIN]!;
  const dockRef = useRef(dockTo);
  const [height, setHeight] = useState(() => {
    const dock = dockTo?.();
    const stack = dock ? playerStackHeight(dock) : 0;
    return stack ? `${stack}px` : fixedHeight;
  });
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep the stack's height while the two still line up
  useEffect(() => {
    const dock = dockRef.current?.();
    if (!dock || typeof ResizeObserver === 'undefined') return;
    let last = playerStackHeight(dock);
    const observer = new ResizeObserver(() => {
      const own = bodyRef.current?.closest<HTMLElement>('.dd-window');
      const now = playerStackHeight(dock);
      if (now !== last && own && Math.abs(own.offsetHeight - last) <= 1) setHeight(`${now}px`);
      last = now;
    });
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  return (
    <DdWindow
      title="visualizer"
      icon={icon}
      width={width}
      height={height}
      resizable
      movable
      disableSnap={disableSnap}
      bodyOverflow="hidden"
      defaultOpen
      disableMinimize
      disableFullscreen
      {...WINDOW_ICONS}
      onMove={onMove}
      onClose={onClose}
      style={{ position: 'absolute', left: initialX, top: initialY, ...skin.vars as CSSProperties }}
      className="dd-player dd-player--viz"
    >
      <div ref={bodyRef} className="dd-player__viz-body">
        <Visualizer source={source} colors={skin.visualizer.colors} background={skin.visualizer.background} />
      </div>
    </DdWindow>
  );
}
