# Player ideas

Local working notes. Gitignored — not part of the repo.

Things the original Winamp had (or that fit it) that the player could add.
Roughly by effort.

## Quick wins

1. **Visualizer modes.** Click the visualizer to cycle spectrum bars →
   oscilloscope (waveform) → off, as Winamp did. Ours is bars only.
2. **Elapsed / remaining time.** Click the timer to switch. Ours always counts
   down.
3. **Keyboard shortcuts.** Winamp's Z X C V B (previous, play, pause, stop,
   next); arrows to seek and change volume. Only while the player has focus.
4. **Media keys and the phone lock screen** (Media Session API). Keyboard
   play/pause keys work; phones show the track and controls on the lock screen.
5. **Track lengths in the playlist**, and the total ("7:35", "?/7:35+").

## Medium

6. **Windowshade mode.** Double-click the title bar: the player becomes a thin
   strip with the time, the track and tiny buttons. Very Winamp.
7. **Drag and drop.** Drop audio files on the player or playlist; ADD takes
   several files; drag tracks to reorder.
8. **Remember the playlist and EQ.** EQ is easy; files added by hand need
   IndexedDB to survive a reload (they're blobs, not URLs).
9. **EQ curve, preamp and ON.** The little graph of the curve above the
   sliders, an EQ on/off button and a preamp slider.
10. **Skins on phones.** Skins are only in the right-click menu, which phones
    don't have (Android long-press does; iPhone Safari doesn't). A fallback,
    e.g. in MISC.

## Big

11. **The WebGL visualizer in the React Player.** `visualizer.js` (the
    MilkDrop-style rings) is only wired into the static page (`player.js`,
    behind the `visualizer` feature flag). It's framework-agnostic (a canvas
    and the audio in), so the React Player can use it:
    - a `visualizer` option, off by default; dd-desktop uses the same rule as
      the static page (on locally, `?visualizer=1` to try it live)
    - a VIZ button next to EQ / PL, only when enabled
    - fed from the Player's own AudioEngine analyser
    - where it opens, two options:
      1. **its own window**, MilkDrop-style, to the right of the player:
         movable, resizable, fullscreen with its own button; VIZ toggles it
         (preferred)
      2. **docked inside the player window** on the right, as in the static
         page; the window widens, no separate resize or fullscreen
    - see PLAN.md: the vanilla and React players have drifted (visualizer
      only in vanilla, pastelcore and the playlist menus only in React)
12. **Real Winamp skins (.wsz).** Load classic skins. Large; Webamp already
    does it, so only worth it to compete with Webamp.
