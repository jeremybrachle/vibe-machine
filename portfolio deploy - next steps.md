# Vibe Machine — Portfolio Deploy: Next Steps

Handoff document covering everything built so far and what's needed to ship.

---

## What's Been Built

### Core Platform
- **Vanilla JS audio visualizer** — zero production dependencies, Node.js static server
- **Web Audio API pipeline**: `<audio>` → MediaElementSource → AnalyserNode → GainNode → destination
- **Dual canvas system**: main visualizer canvas + mouse-fx overlay (z-index: 2, pointer-events: none)
- **Electron wrapper** for desktop builds (`.exe`, `.AppImage`, `.dmg`)

### 8 Visualizers
| # | Name | Description |
|---|------|-------------|
| 1 | **Blank** | Pure black canvas — minimal, just the overlay effects |
| 2 | **Bars** | Classic frequency EQ with peak caps and reflections |
| 3 | **Waveform** | Neon oscilloscope with ghost/glow layers |
| 4 | **Circular** | Radial frequency ring with inner glow |
| 5 | **Particles** | Physics-based particle system (max 250, swap-and-pop removal) |
| 6 | **Starfield** | WMP-nostalgia star tunnel |
| 7 | **Pixel Grid** | 28px colorful rounded tiles with rainbow hue sweep |
| 8 | **Beach** | Persistent pixelated sunset landscape with audio-reactive shimmer, bass-responsive sun, water reflections |

### Overlay Effects (all default off, toggled independently)
- **🌅 Sunrise/Sunset Transition** — pixelated landscape fades in/out with song start/end, 1s black hold at start
- **☀ Persistent Sun Arc** — draggable sun that follows a parabolic arc over the song's duration, returns to path on sunset
- **▦ Pixel Edges** — 8px post-process grid with 2px gap applied over any visualizer
- **≡ Amplitude Bars** — lo-fi frequency bars behind the transition layer
- **✦ Mouse Particles** — click/hover particle effects on the overlay canvas

### UI Controls
- Top bar: 8 visualizer buttons (keyboard 1–8)
- Bottom bar: play/pause, prev/next, shuffle, progress scrubber, volume
- Bottom-left: transition controls panel (toggle buttons, duration slider, shuffle FX 🎲, reset defaults ⟲)
- Bottom-right: queue panel with drag-and-drop file zone (cauldron animation)
- Vibe Mode: hides all UI, mouse auto-hides after 2.5s
- Help overlay: `?` key

### Server Hardening
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`
- Cache-Control: immutable for audio, short cache for HTML/CSS/JS
- 405 Method Not Allowed for non-GET on `/api/tracks`
- Path traversal protection

### Test Suite
- **39 tests** across 2 suites (server.test.js + config.test.js)
- Server tests: static serving, API, MIME types, security headers, cache-control, method validation
- Config tests: branding, audio settings, visualizer list, theme, vibe mode, default toggle states
- CI: GitHub Actions workflow (`.github/workflows/ci.yml`)

---

## File Structure

```
vibe-machine/
├── server.js                 # Node.js static server + /api/tracks
├── electron-main.js          # Electron desktop wrapper
├── package.json              # Scripts: start, dev, electron, build, test
├── jest.config.js            # Test config
├── public/
│   ├── index.html            # Single-page shell, all UI markup
│   ├── styles.css            # ~600 lines, dark theme, CSS custom properties
│   ├── config.js             # All settings (branding, audio, theme, defaults)
│   ├── app.js                # ~1300 lines IIFE — state, audio, rendering, UI
│   └── visualizers/
│       ├── blank.js
│       ├── bars.js
│       ├── waveform.js
│       ├── circular.js
│       ├── particles.js
│       ├── starfield.js
│       ├── pixelgrid.js
│       └── beach.js
├── tests/
│   ├── server.test.js        # 28 + 11 tests
│   └── config.test.js
├── tracks/                   # Audio files (gitignored), organized by subdirectory
├── PLAN.md                   # Original 5-phase feature plan
├── ANTI-VIBE.md              # Tongue-in-cheek docs for the "anti-vibe" security additions
└── README.md                 # Full usage docs (needs update for new visualizers)
```

---

## What Needs Updating Before Deploy

### 1. README.md — Stale Content
The README still lists 5 visualizers and keyboard shortcuts `1–5`. Needs:
- Update visualizer table to include all 8 (Blank, Pixel Grid, Beach)
- Update keyboard shortcuts to `1–8`
- Add transition controls section (T, L, A, R, 0 keys)
- Add shuffle/reset docs
- Update architecture tree to include all current files

### 2. config.js — Review Defaults
Current defaults are portfolio-ready (all effects off, blank as default visualizer, drop zone enabled). Verify these match your intended deploy persona:
- `dropZoneEnabled: true` — good for portfolio (no pre-bundled tracks needed)
- `defaultVisualizer: 0` (Blank) — consider changing to Beach (index 7) for a more impressive first impression
- `autoPlay: false` — requires user interaction (good for browser autoplay policies)

### 3. Tracks Directory
- For portfolio deploy: `tracks/` should be empty or gitignored (users drag-and-drop their own files)
- For personal/themed deploy: bundle tracks into subdirectories (they become categories)

---

## Deployment Options

### Option A: Static Hosting (GitHub Pages / Netlify / Vercel)
**Best for portfolio.** The app is 100% client-side except for `/api/tracks` (track listing).

To deploy statically:
1. The `/api/tracks` endpoint won't exist — the app already handles empty track lists gracefully (shows the cauldron drop zone)
2. Deploy the `public/` folder as-is to any static host
3. Users drag-and-drop audio files into the browser

**GitHub Pages quick deploy:**
```bash
# From repo root
git subtree push --prefix public origin gh-pages
```

Or configure GitHub Pages to serve from `public/` on main branch.

**Netlify/Vercel:**
- Set build directory to `public/`
- No build command needed (zero build step)

### Option B: Node.js Server (Railway / Render / Fly.io)
**Best if you want pre-loaded tracks or the track API.**

1. Push the full repo
2. Set start command: `node server.js`
3. Set PORT env var if the platform requires it (currently reads from `process.argv[2]` — may need to change to `process.env.PORT`)
4. Add tracks to `tracks/` before deploy

**Server PORT fix needed for cloud platforms:**
```js
// server.js line 5 — change:
const PORT = process.argv[2] || 3000;
// to:
const PORT = process.env.PORT || process.argv[2] || 3000;
```

### Option C: Electron Desktop Build
**Best for distributing as a standalone app.**

```bash
npm install
npm run build
# Output in dist/
```

Builds for current platform. Cross-platform builds require platform-specific CI or electron-builder config.

---

## Portfolio Polish Checklist

- [ ] Update README with all 8 visualizers and current keyboard shortcuts
- [ ] Decide default visualizer (Blank vs Beach for first impression)
- [ ] Add a screenshot or GIF to README for the GitHub repo card
- [ ] Add `author` field in package.json
- [ ] Add a favicon (`public/favicon.ico`)
- [ ] Consider adding `<meta>` tags for social sharing (og:image, etc.)
- [ ] Fix server PORT for cloud deploy (`process.env.PORT`)
- [ ] Test drag-and-drop flow without any pre-loaded tracks (portfolio mode)
- [ ] Test all 8 visualizers + all overlay effects with audio playing
- [ ] Test Electron build on target platform
- [ ] Remove or rename `ANTI-VIBE.md` if the nihilist humor doesn't fit the portfolio tone
- [ ] Set up GitHub repo description/topics for discoverability

---

## Known Behaviors / Notes

- **All effects default to off** — the app starts as a blank canvas with a cauldron drop zone. This is intentional for portfolio mode.
- **Transition starts with 1s full black hold** — prevents flash on song start. The sunrise then fades in over `transitionDuration` seconds.
- **Beach visualizer renders even without audio** — shows a static/gently animated sunset scene. Other visualizers show black without audio (data is all zeros).
- **Sun arc is independent of transition** — the draggable sun follows its own arc path and is not tied to the sunrise/sunset transition effect.
- **39 tests passing** — run `npm test` before any deploy to verify nothing's broken.
- **Zero production dependencies** — the only `node_modules` needed are dev dependencies (Jest, Electron, electron-builder).
