import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN, SKINS } from '../skins';

describe('skins', () => {
  it('includes the default skin', () => {
    expect(SKINS[DEFAULT_SKIN]).toBeDefined();
  });

  it.each(Object.entries(SKINS))('%s is complete and consistent', (key, skin) => {
    expect(skin.id).toBe(key);
    expect(skin.label).toBeTruthy();
    expect(skin.accentColor).toBeTruthy();
    expect(Object.keys(skin.vars).every((v) => v.startsWith('--'))).toBe(true);
    // Gradient stops run from 0 to 1 in order
    const positions = skin.histogramGradient.map(([p]) => p);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions[0]).toBe(0);
    expect(positions[positions.length - 1]).toBe(1);
  });
});
