import { describe, it, expect } from 'vitest';
import {
  clickTrack, selectAll, invertSelection,
  removeSelected, crop, clear, sortByTitle, sortByArtist, reverse, randomize,
} from '../playlist';

const t = (title: string, artist?: string) => ({ title, artist, src: `${title}.mp3` });
const A = t('Archangel', 'Burial');
const B = t('blue monday', 'New Order');
const C = t('Comfort', '');
const D = t('Dirt', 'Burial');
const list = [A, B, C, D];

describe('selecting', () => {
  const none = { selected: [], anchor: null };

  it('a click selects just that track', () => {
    expect(clickTrack({ selected: [0, 2], anchor: 0 }, 1, {})).toEqual({ selected: [1], anchor: 1 });
  });

  it('Ctrl/⌘-click adds or removes one', () => {
    const one = clickTrack(none, 1, {});
    const two = clickTrack(one, 3, { toggle: true });
    expect(two.selected).toEqual([1, 3]);
    expect(clickTrack(two, 1, { toggle: true }).selected).toEqual([3]);
  });

  it('Shift-click selects the range from the last click, either way', () => {
    const one = clickTrack(none, 2, {});
    expect(clickTrack(one, 0, { range: true })).toEqual({ selected: [0, 1, 2], anchor: 2 });
    expect(clickTrack(one, 3, { range: true }).selected).toEqual([2, 3]);
  });

  it('Shift-click without an earlier click selects just that one', () => {
    expect(clickTrack(none, 2, { range: true }).selected).toEqual([2]);
  });

  it('select all, and invert', () => {
    expect(selectAll(4)).toEqual([0, 1, 2, 3]);
    expect(invertSelection(4, [0, 2])).toEqual([1, 3]);
  });
});

describe('REM', () => {
  it('removes the selected tracks, following the playing one', () => {
    expect(removeSelected({ list, current: 3 }, [0, 2])).toEqual({ list: [B, D], current: 1 });
  });

  it("removing the playing track leaves nothing playing in the list", () => {
    expect(removeSelected({ list, current: 1 }, [1])).toEqual({ list: [A, C, D], current: -1 });
  });

  it('crop keeps only the selected', () => {
    expect(crop({ list, current: 2 }, [1, 2])).toEqual({ list: [B, C], current: 1 });
  });

  it('clear empties it', () => {
    expect(clear({ list, current: 0 })).toEqual({ list: [], current: -1 });
  });
});

describe('MISC', () => {
  it('sorts by title, ignoring case', () => {
    expect(sortByTitle({ list: [D, B, A, C], current: 0 })).toEqual({ list: [A, B, C, D], current: 3 });
  });

  it('sorts by artist then title, tracks without an artist last', () => {
    expect(sortByArtist({ list: [C, D, B, A], current: 0 }).list).toEqual([A, D, B, C]);
  });

  it('reverses', () => {
    expect(reverse({ list, current: 0 })).toEqual({ list: [D, C, B, A], current: 3 });
  });

  it('randomizes, keeping every track and following the playing one', () => {
    let seed = 0.37;
    const random = () => (seed = (seed * 9301 + 49297) % 233280 / 233280);
    const shuffled = randomize({ list, current: 1 }, random);
    expect([...shuffled.list].sort((a, b) => a.title.localeCompare(b.title))).toEqual(list);
    expect(shuffled.list[shuffled.current]).toBe(B);
  });
});
