# Winamp Tokyo 3

A lightweight, static web music player with a retro Winamp vibe. No build step required — just open the page and play.

## Quick start

- Open `index.html` in a modern browser.
- Drop your audio files into `public/tracks/`.
- Optionally edit `public/tracks/manifest.json` to control the playlist:
  - Simple: `["song.mp3", "another.mp3"]`
  - Detailed: `[{"file":"song.mp3","title":"Song","artist":"Artist"}]`

If no manifest is found, a small default list is shown.

## Controls

- Play/Pause/Stop/Prev/Next
- Shuffle and Repeat
- Volume and Balance
- Equalizer (7‑band) with presets


## File structure

- `index.html` — UI and component markup
- `styles.css` — styles for the player and docks
- `player.js` — audio engine, UI wiring, animations, and playlist/eq logic
- `public/` — static assets
  - `img/` — images
  - `tracks/` — audio files and `manifest.json`

## Tuning the minimize animation

Minimize/unminimize animations are defined in `player.js` (search for `customMinimize` and the minimize sync helper). Adjust the CSS transition durations there if you want different timing.

## License

MIT



## React package

The player is also a React component, `@dreamdesk/player`, built on [@dreamdesk/ui](https://github.com/stonedem0/dreamdesk) (formerly dreamdesk-ui).

```sh
npm install @dreamdesk/player @dreamdesk/ui react react-dom
```

```tsx
import { Player } from "@dreamdesk/player";
import "@dreamdesk/player/css";

<Player
  initialTracks={[{ title: "Track", artist: "Artist", src: "/track.mp3" }]}
  onSkinChange={(id) => localStorage.setItem("skin", id)}
/>
```

It needs `@dreamdesk/ui` 3.1 or later (use it instead of the older `dreamdesk-ui`, not alongside it). `@dreamdesk/ui`, `react` and `react-dom` are peer dependencies, so your app provides them and ends up with a single copy of each.

Like Winamp: click a track to select it (Ctrl/⌘ or Shift for several) and double-click to play; REM, SEL and MISC manage the playlist; click the display to cycle the visualizer (bars, oscilloscope, off); right-click the player for its menu, including skins.

| Prop | |
|---|---|
| `initialTracks` | `{ title, artist, src }[]` to start with |
| `skin` / `onSkinChange` | `"tokyo-3-sunset"` or `"pastelcore"`; called when the visitor picks one |
| `defaultFullscreen` / `onFullscreenChange` | start expanded (playlist and EQ open); called when it changes |
| `defaultVisualizerMode` / `onVisualizerModeChange` | `"bars"`, `"scope"` or `"off"`; called when it changes |
| `initialX`, `initialY` / `onMove` | where the window starts; called after it's dragged |
| `icon`, `disableSnap`, `onClose` | passed to the @dreamdesk/ui window |

The `on…Change` callbacks are there so a host can remember the visitor's choices. Build the package with `npm run build`; the output goes to `dist/`.

## Releasing

Bump `version` in `package.json` in a PR and merge it, then create a GitHub Release tagged `vX.Y.Z` (`gh release create v0.1.2 --generate-notes`). The **Release to npm** workflow checks the tag matches the version, runs lint and tests, and publishes `@dreamdesk/player` to npm through trusted publishing (no npm token).

## Tests

```sh
npm test           # Vitest (happy-dom)
npm run coverage   # tests + coverage report (HTML in coverage/)
```

happy-dom has no Web Audio, so `src/__tests__/fakeAudio.ts` provides a small fake `AudioContext` that records how nodes are connected; `src/__tests__/setup.ts` installs it, stubs media playback and `fetch`. The `Player` tests swap @dreamdesk/ui's `Window` for a stand-in that records its props. CI runs the build and tests on every PR.
