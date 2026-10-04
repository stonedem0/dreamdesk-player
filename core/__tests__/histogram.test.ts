import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_HISTOGRAM_STOPS, drawHistogram } from '../histogram.js';

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
