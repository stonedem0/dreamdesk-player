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

MIT (or your preferred license). Update this section as needed.



## React package

The player is also a React component, `@dreamdesk/player`, built on [dreamdesk-ui](https://github.com/stonedem0/dreamdesk-ui).

```sh
npm install @dreamdesk/player dreamdesk-ui react react-dom
```

```tsx
import { Player } from "@dreamdesk/player";
import "@dreamdesk/player/css";

<Player
  initialTracks={[{ title: "Track", artist: "Artist", src: "/track.mp3" }]}
  onSkinChange={(id) => localStorage.setItem("skin", id)}
/>
```

`dreamdesk-ui`, `react` and `react-dom` are peer dependencies, so your app provides them and ends up with a single copy of each. Build the package with `npm run build`; the output goes to `dist/`.
