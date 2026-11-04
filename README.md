# @dreamdesk/player

A Winamp-style music player for React, built on [@dreamdesk/ui](https://github.com/stonedem0/dreamdesk): playlist, 7-band EQ with presets, skins, a spectrum / oscilloscope display, and a WebGL visualizer in a window of its own.

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

It needs `@dreamdesk/ui` 3.1 or later. `@dreamdesk/ui`, `react` and `react-dom` are peer dependencies, so your app provides them and ends up with a single copy of each.

## Using it

Like Winamp:

- **Playlist:** click a track to select it (Ctrl/⌘ or Shift for several), double-click to play. ADD, REM, SEL and MISC manage the list; each track shows its length, and the status bar the selected / total time.
- **Display:** click it to cycle the visualizer (bars, oscilloscope, off); click the timer to switch time played / time left.
- **Keys:** Z X C V B for previous, play, pause, stop and next, while the Player is the window in use. The keyboard's media keys and a phone's lock screen work too.
- **Right-click** the Player for its menu: transport, playlist, equalizer, visualization and skins.
- **Expand** (the title bar's middle button) opens the equalizer and playlist, and the visualizer if there is one.

## Props

| Prop | |
|---|---|
| `initialTracks` | `{ title, artist, src, album?, artwork? }[]` to start with (`album` and `artwork` show on the lock screen) |
| `skin` / `onSkinChange` | `"tokyo-3-sunset"` or `"pastelcore"`; called when the visitor picks one |
| `defaultFullscreen` / `onFullscreenChange` | start expanded (equalizer and playlist open); called when it changes |
| `defaultVisualizerMode` / `onVisualizerModeChange` | the display: `"bars"`, `"scope"` or `"off"` |
| `defaultTimeMode` / `onTimeModeChange` | the timer: `"elapsed"` (default) or `"remaining"` |
| `onAudioSource` | gets the Player's audio (`{ analyser, audio }`, and `null` when it goes), for a visualizer |
| `onVisualizerToggle` / `visualizerOpen` | adds **Visualization** to the right-click menu, and ticks it while open |
| `initialX`, `initialY` / `onMove` | where the window starts; called after it's dragged |
| `icon`, `disableSnap`, `onClose` | passed to the @dreamdesk/ui window |

The `on…` callbacks are there so a host can remember the visitor's choices.

## The visualizer window

`VisualizerWindow` is the WebGL visualizer in a window skinned like the Player, Winamp's MilkDrop style: close button only, double-click for fullscreen, and with `dockTo` as tall as the Player with its panels.

```tsx
import { useState } from "react";
import { Player, VisualizerWindow, type AudioSource } from "@dreamdesk/player";

function App() {
  const [source, setSource] = useState<AudioSource | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Player initialTracks={tracks} onAudioSource={setSource}
        onVisualizerToggle={() => setOpen((v) => !v)} visualizerOpen={open} />
      {open && (
        <VisualizerWindow source={source} initialX={500} initialY={100}
          dockTo={() => document.querySelector<HTMLElement>(".dd-player:not(.dd-player--viz)")}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}
```

`Visualizer` is the bare canvas, for a window of your own. It needs WebGL2; without it, it shows only its background.

## Skins

`SKINS` holds them, `DEFAULT_SKIN` is `"tokyo-3-sunset"`. A skin is CSS variables on the Player, so a host can adjust one: colours (`--player-bg`, `--color-text-primary`, …), backgrounds (`--player-body-bg`, `--eq-body-bg`, `--playlist-body-bg`), and edges (`--border-color`, `--edge-image` for gradient edges).

## The static page

`index.html` is the original plain-JS player (no build step): open it in a browser, put audio files in `public/tracks/`, and optionally list them in `public/tracks/manifest.json` (`["song.mp3"]` or `[{"file":"song.mp3","title":"Song","artist":"Artist"}]`). `demo.html` is the React Player, with `npm run dev`.

## Releasing

Bump `version` in `package.json` in a PR and merge it, then create a GitHub Release tagged `vX.Y.Z` (`gh release create v0.2.1 --generate-notes`). The **Release to npm** workflow checks the tag matches the version, runs lint and tests, and publishes `@dreamdesk/player` to npm through trusted publishing (no npm token).

## Tests

```sh
npm test           # Vitest (happy-dom)
npm run coverage   # tests + coverage report (HTML in coverage/)
```

happy-dom has no Web Audio, so `src/__tests__/fakeAudio.ts` provides a small fake `AudioContext` that records how nodes are connected; `src/__tests__/setup.ts` installs it, stubs media playback and `fetch`. The `Player` tests swap @dreamdesk/ui's `Window` for a stand-in that records its props. CI runs the build and tests on every PR.

## License

MIT
