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

## Deploy to GitHub Pages

This repo is already Pages‑friendly:

- Asset paths are relative (e.g. `public/tracks/manifest.json`).
- `.nojekyll` is included so files are served “as is”.

Steps:
1. Push to GitHub.
2. Repo → Settings → Pages
3. Source: “Deploy from a branch” → Branch: `master` (or `main`) → Folder: `/(root)`.
4. Wait ~1–2 minutes. Your site will be at:
   - `https://<your-username>.github.io/winamp-tokyo-3/`

Notes:
- Private repos can deploy; the site itself is public (unless you use an org with Enterprise).
- You can add a custom domain later by adding a `CNAME` file and setting it in Pages.

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


