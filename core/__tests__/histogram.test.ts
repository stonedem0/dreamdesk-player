import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_HISTOGRAM_STOPS, drawHistogram, drawOscilloscope, nextVisualizerMode, VISUALIZER_MODES } from '../histogram.js';

function fakeCanvas(width = 100, height = 50) {
  const gradients: { stops: [number, string][] }[] = [];
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: null as unknown,
    shadowBlur: 5,
    createLinearGradient: vi.fn(() => {
      const g = { stops: [] as [number, string][], addColorStop(p: number, c: string) { g.stops.push([p, c]); } };
      gradients.push(g);
      return g;
    }),
  };
  return { ctx, canvas: { width, height }, gradients };
}

describe('drawHistogram', () => {
  it('clears the canvas and draws one bar per value', () => {
    const { ctx, canvas } = fakeCanvas();
    drawHistogram(ctx as never, canvas as never, [-50, -20, 0], [0, 0, 0]);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 50);
    expect(ctx.fillRect).toHaveBeenCalledTimes(3);
    expect(ctx.shadowBlur).toBe(0);
  });

  it('smooths towards the new values (80% previous, 20% new)', () => {
    const { ctx, canvas } = fakeCanvas();
    const prev = [-100, -100];
    drawHistogram(ctx as never, canvas as never, [0, -50], prev);
    expect(prev).toEqual([-80, -90]);
  });

  it('resizes the previous frame when the data length changes', () => {
    const { ctx, canvas } = fakeCanvas();
    const prev = [-10];
    drawHistogram(ctx as never, canvas as never, [0, 0, 0], prev);
    expect(prev).toHaveLength(3);
    expect(prev).toEqual([0, 0, 0]);
  });

  it('colours bars with the given gradient stops, defaulting to the built-in ones', () => {
    const { ctx, canvas, gradients } = fakeCanvas();
    drawHistogram(ctx as never, canvas as never, [0], [0]);
    expect(gradients[0].stops).toEqual(DEFAULT_HISTOGRAM_STOPS);
    const custom: [number, string][] = [[0, '#000'], [1, '#fff']];
    drawHistogram(ctx as never, canvas as never, [0], [0], custom);
    expect(gradients[1].stops).toEqual(custom);
  });
});

describe('drawOscilloscope', () => {
  function fakeLine(width = 100, height = 40) {
    const points: [number, number][] = [];
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn((x: number, y: number) => points.push([x, y])),
      lineTo: vi.fn((x: number, y: number) => points.push([x, y])),
      stroke: vi.fn(),
      strokeStyle: null as unknown,
      lineWidth: 0,
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    };
    return { ctx, canvas: { width, height }, points };
  }

  it('draws silence as a flat line through the middle, across the whole display', () => {
    const { ctx, canvas, points } = fakeLine();
    drawOscilloscope(ctx as never, canvas as never, new Uint8Array(1024).fill(128));
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 40);
    expect(points).toHaveLength(100);
    expect(points.every(([, y]) => y === 20)).toBe(true);
    expect(points[0][0]).toBe(0);
    expect(points[points.length - 1][0]).toBe(100);
    expect(ctx.stroke).toHaveBeenCalledOnce();
  });

  it('draws loud samples near the top and bottom', () => {
    const { ctx, canvas, points } = fakeLine();
    const wave = new Uint8Array(200).map((_, i) => (i < 100 ? 255 : 0));
    drawOscilloscope(ctx as never, canvas as never, wave);
    const ys = points.map(([, y]) => y);
    expect(Math.min(...ys)).toBeLessThan(3);
    expect(Math.max(...ys)).toBeGreaterThan(37);
  });

  it('draws nothing without samples', () => {
    const { ctx, canvas } = fakeLine();
    drawOscilloscope(ctx as never, canvas as never, new Uint8Array(0));
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe('visualizer modes', () => {
  it('cycles bars, scope, off, and round again', () => {
    expect(VISUALIZER_MODES).toEqual(['bars', 'scope', 'off']);
    expect(nextVisualizerMode('bars')).toBe('scope');
    expect(nextVisualizerMode('scope')).toBe('off');
    expect(nextVisualizerMode('off')).toBe('bars');
  });
});
