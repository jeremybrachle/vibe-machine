# Portfolio Demo — Export & Update Guide

## What This Is

The portfolio at `~/programming/portfolio` contains a **standalone demo copy** of Vibe Machine in `public/vibe-machine/`. It is **not linked** to the main app — it's a separate, trimmed-down version with its own customizations. Changes to the main Vibe Machine repo do **not** automatically propagate to the demo.

## Demo vs Main — What's Different

| | Main (`vibe-machine/public/`) | Demo (`portfolio/public/vibe-machine/`) |
|---|---|---|
| Visualizers | 10 modes | 5 (blank, bars, wave, circular, starry night) |
| Default mode | Blank | Starry Night |
| Tracks | `/api/tracks` endpoint (server) | `tracks.json` (static file, no server) |
| Start screen | None — immediate UI | "Start the Vibe Machine" button |
| Auto vibe mode | No | Yes — UI hides 3s after play |
| Floating play btn | No | Yes — hover bottom of screen in vibe mode |
| Transition effect | Off | On (sunrise/sunset between songs) |
| Sun arc | Off | Off |
| AutoPlay | Off | Off (start button triggers play) |
| Server required | Yes (`node server.js`) | No (pure static files) |

## Three Update Paths

### Path A: Update the Demo Only

Edit files directly in `~/programming/portfolio/public/vibe-machine/`. The demo is self-contained — no need to touch the main repo. Good for tweaking demo behavior, swapping tracks, or adjusting config.

Key files:
- `config.js` — defaults (visualizer, effects, autoplay)
- `app.js` — demo start screen, auto-vibe, floating play button
- `index.html` — start screen HTML, trimmed viz buttons/scripts
- `styles.css` — start screen + floating play button CSS
- `tracks.json` — static track list

### Path B: Pull Fresh Code from Main → Re-apply Demo Patches

When the main app gets new features or bug fixes you want in the demo:

```bash
# 1. Nuke the old demo (keep tracks.json as reference)
cp ~/programming/portfolio/public/vibe-machine/tracks.json /tmp/tracks.json.bak

# 2. Copy fresh source
rm -rf ~/programming/portfolio/public/vibe-machine
cp -r ~/programming/vibe-machine/public ~/programming/portfolio/public/vibe-machine

# 3. Copy tracks
mkdir -p ~/programming/portfolio/public/vibe-machine/tracks/classical
cp ~/programming/vibe-machine/tracks/classical/* ~/programming/portfolio/public/vibe-machine/tracks/classical/

# 4. Restore tracks.json
cp /tmp/tracks.json.bak ~/programming/portfolio/public/vibe-machine/tracks.json

# 5. Delete unused visualizers
rm ~/programming/portfolio/public/vibe-machine/visualizers/{particles,starfield,pixelgrid,sunset,piano,synthwave,beach,beach-alt1,fireworks}.js 2>/dev/null
```

Then re-apply all demo patches manually. These are the changes that make the demo different from the main app:

**`app.js`:**
- Change `fetch('/api/tracks')` → `fetch('tracks.json')`
- Trim `visualizers` array to `[Blank, Bars, Waveform, Circular, Starrynight]`
- Add demo start screen logic (hide UI initially, show on button click)
- Add auto-vibe timer (3s after play)
- Add floating play/pause button for vibe mode
- Remove auto-vibe timer from `playTrack()` (start screen handles it)

**`index.html`:**
- Add `<div id="demo-start">` with start button before canvas
- Trim viz-btn buttons to 5 demo modes, Starry Night as `active`
- Remove `<script>` tags for deleted visualizers

**`config.js`:**
- `visualizers: ['blank', 'bars', 'waveform', 'circular', 'starrynight']`
- `defaultVisualizer: 4`
- `autoPlay: false`
- `transitionEnabled: true`
- `sunArcEnabled: false`
- All other effects: `false`

**`styles.css`:**
- Add `#demo-start` / `#btn-start` styles (start screen overlay)
- Add `#vibe-play-btn` styles (floating play/pause in vibe mode)

**This is tedious.** If you do this more than once, consider Path C.

### Path C: Sync Them 1:1 (Future Option)

If you want the demo to always mirror the main app exactly, replace the static copy approach with a live iframe:

1. Revert `portfolio/index.html` to iframe `http://localhost:5001` (or a deployed URL)
2. Delete `portfolio/public/vibe-machine/` entirely
3. Run `node server.js 5001` alongside the portfolio dev server
4. The `X-Frame-Options: SAMEORIGIN` change in the main `server.js` already supports this

For production, deploy Vibe Machine to a host (Vercel, Render, VPS) and point the iframe `src` at the deployed URL. The main app would need the demo UX changes (start screen, auto-vibe) added to its own codebase, or you'd accept showing the full UI in the portfolio.

**Tradeoffs:**
| | Static demo (current) | Live iframe |
|---|---|---|
| Server needed | No | Yes (dev) or deployed URL (prod) |
| Always up to date | No — manual sync | Yes |
| Demo customizations | Easy — edit the copy | Harder — need config flags in main app |
| Offline/static deploy | Works | Needs running server or deployed app |

---

## Screenshot Checklist

Capture these screenshots manually while the app is running (`node server.js 5001`):

1. **bars-mode.png** — Bars visualizer with music playing (the classic look)
2. **particles-mode.png** — Particles mode, ideally with mouse FX active
3. **sunset-mode.png** — Sunset visualizer with the sun arc enabled
4. **thumb.png** — ~400x300 thumbnail, any visually striking mode (bars or sunset recommended)

Tip: Use browser DevTools (Ctrl+Shift+M) to set a consistent viewport, then Ctrl+Shift+P → "Capture screenshot".
