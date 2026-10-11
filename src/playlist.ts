/**
 * Playlist operations, Winamp's way: selecting tracks, and the REM, SEL and
 * MISC menus. Pure functions over the list, the playing track's index and the
 * selected indices, so the Player only wires them up.
 *
 * The playing track is followed by identity: after a sort or a removal,
 * `current` is wherever that track now is, or -1 if it was removed (it keeps
 * playing; Next starts from the top).
 */

export interface PlaylistTrack {
  title: string;
  artist?: string;
  src: string;
}

export interface PlaylistState<T extends PlaylistTrack> {
  list: T[];
  /** Index of the playing track, -1 if none is in the list. */
  current: number;
}

// ── Selecting ───────────────────────────────────────────────────────────────

export interface Selection {
  selected: number[];
  /** Where the last plain or Ctrl/⌘ click was, for Shift-click ranges. */
  anchor: number | null;
}

/** A click on a track: alone it selects just that one; Ctrl/⌘ toggles it; Shift selects the range from the anchor. */
export function clickTrack(sel: Selection, index: number, mods: { toggle?: boolean; range?: boolean }): Selection {
  if (mods.range && sel.anchor !== null) {
    const [from, to] = sel.anchor < index ? [sel.anchor, index] : [index, sel.anchor];
    const range = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const selected = mods.toggle ? [...new Set([...sel.selected, ...range])] : range;
    return { selected: selected.sort((a, b) => a - b), anchor: sel.anchor };
  }
  if (mods.toggle) {
    const selected = sel.selected.includes(index)
      ? sel.selected.filter((i) => i !== index)
      : [...sel.selected, index].sort((a, b) => a - b);
    return { selected, anchor: index };
  }
  return { selected: [index], anchor: index };
}

export const selectAll = (length: number): number[] => Array.from({ length }, (_, i) => i);
export const invertSelection = (length: number, selected: number[]): number[] =>
  selectAll(length).filter((i) => !selected.includes(i));

// ── Changing the list ───────────────────────────────────────────────────────

/** The list in a new order (or with fewer tracks), with the playing track followed. */
function reorder<T extends PlaylistTrack>({ list, current }: PlaylistState<T>, next: T[]): PlaylistState<T> {
  const playing = current >= 0 ? list[current] : undefined;
  return { list: next, current: playing ? next.indexOf(playing) : -1 };
}

/** REM → Remove selected. */
export const removeSelected = <T extends PlaylistTrack>(state: PlaylistState<T>, selected: number[]) =>
  reorder(state, state.list.filter((_, i) => !selected.includes(i)));

/** REM → Crop: keep only the selected tracks. */
export const crop = <T extends PlaylistTrack>(state: PlaylistState<T>, selected: number[]) =>
  reorder(state, state.list.filter((_, i) => selected.includes(i)));

/** REM → Clear playlist. */
export const clear = <T extends PlaylistTrack>(state: PlaylistState<T>) => reorder(state, []);

const byText = (key: (t: PlaylistTrack) => string) => (a: PlaylistTrack, b: PlaylistTrack) =>
  key(a).localeCompare(key(b), undefined, { sensitivity: "base", numeric: true });

/** MISC → Sort by title. */
export const sortByTitle = <T extends PlaylistTrack>(state: PlaylistState<T>) =>
  reorder(state, [...state.list].sort(byText((t) => t.title)));

/** MISC → Sort by artist (then title); tracks without one go last. */
export const sortByArtist = <T extends PlaylistTrack>(state: PlaylistState<T>) =>
  reorder(state, [...state.list].sort((a, b) =>
    (a.artist ? 0 : 1) - (b.artist ? 0 : 1) || byText((t) => t.artist ?? "")(a, b) || byText((t) => t.title)(a, b)));

/** MISC → Reverse list. */
export const reverse = <T extends PlaylistTrack>(state: PlaylistState<T>) => reorder(state, [...state.list].reverse());

/** MISC → Randomize list. */
export function randomize<T extends PlaylistTrack>(state: PlaylistState<T>, random: () => number = Math.random): PlaylistState<T> {
  const next = [...state.list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return reorder(state, next);
}
