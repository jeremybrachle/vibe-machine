# Vibe Machine — Desktop Export & Feature Plan

Ordered by feasibility (quickest wins first → bigger lifts last).

---

## Phase 1 — Immediate (no new dependencies)

### 1. Vibe Mode hides all UI on click; Escape brings it back
**Effort:** ~15 min | **Status:** Almost done already

The current code already hides `#ui-overlay` and enters fullscreen. The only gap is that **exiting fullscreen via browser chrome also exits vibe mode**, and mouse movement temporarily shows UI again.

Changes:
- In `toggleVibeMode()`, keep the existing `.hidden` toggle on `#ui-overlay`
- On `Escape` keydown, exit vibe mode and **restore** UI (already works)
- Optional: disable the mouse-move auto-show behavior so UI stays fully hidden until Escape
- This is literally a few lines in `app.js`

---

## Phase 2 — Quick feature adds

### 2. Drag-and-drop files into a "cauldron" UI
**Effort:** 1–2 sessions | **No new deps**

Add a drop zone to the reusable version of the app:
- HTML: a `<div id="cauldron">` with a bubbling cauldron SVG/CSS animation
- CSS: liquid particle effect (CSS keyframe blobs + `mix-blend-mode`) that activates on `dragover`
- JS: listen for `dragover`/`drop` events → read files via `FileReader` / `URL.createObjectURL()`
  - Feed the blob URLs directly into the `<audio>` element (no server round-trip needed)
  - Build the `tracks[]` array in memory from dropped files
- Sloshy splash animation on drop (CSS `@keyframes` + a few absolutely-positioned blob divs)

This works **entirely client-side** — no server changes, no file system writes.

### 3. Two distribution flavors
**Effort:** Repo structure change

| Flavor | What ships | Tracks |
|--------|-----------|--------|
| **"Rick & Morty Edition"** | Pre-bundled with specific tracks in `tracks/` | Baked in |
| **"Reusable / Portfolio"** | Empty `tracks/`, cauldron drop zone enabled | User-supplied |

Implementation:
- Add a `config.js` flag: `dropZoneEnabled: true/false`
- The R&M edition sets it to `false` and ships with tracks
- The portfolio edition sets it to `true` and shows the cauldron on empty playlist
- Could be two branches, two config presets, or a build-time toggle

---

## Phase 3 — Desktop packaging (Electron)

### 4. Wrap in Electron so it launches like a real app
**Effort:** 1 session for basic version

Why Electron:
- Your app is already a browser app — Electron wraps Chromium around it
- Zero rewrite needed; `server.js` runs inside the Electron main process
- You get a taskbar icon, window chrome, system tray, etc.
- It looks like an old-school Windows media player

Steps:
```
npm install --save-dev electron electron-builder
```

Create `electron-main.js`:
```js
const { app, BrowserWindow } = require('electron');
const { fork } = require('child_process');
const path = require('path');

let server;
app.whenReady().then(() => {
  // Start your existing server.js in background
  server = fork(path.join(__dirname, 'server.js'));

  const win = new BrowserWindow({
    width: 1200, height: 800,
    frame: false,           // ← frameless for that media-player look
    titleBarStyle: 'hidden',
    webPreferences: { nodeIntegration: false }
  });
  win.loadURL('http://localhost:3000');
});

app.on('window-all-closed', () => {
  server?.kill();
  app.quit();
});
```

Add to `package.json`:
```json
"main": "electron-main.js",
"scripts": {
  "start": "electron .",
  "build": "electron-builder"
}
```

**Double-click to launch. No terminal. No `node server.js`.**

### 5. Is rebuilding the .exe on every code change inefficient?
**Short answer: No, for development.**

| Mode | What happens |
|------|-------------|
| **Dev** (`npm start`) | Electron loads your local files live. Change code → refresh window. No rebuild needed. |
| **Release** (`npm run build`) | Packages into `.exe` / `.dmg` / `.AppImage`. Only do this when you want to distribute a snapshot. |

You only rebuild the executable when you want to hand someone a self-contained binary. Day-to-day, you just run `npm start` (or even keep using `node server.js` + browser).

---

## Phase 4 — Polish

### 6. Old-school Windows player skin
**Effort:** Purely CSS/HTML — as much or as little as you want

- Frameless Electron window (see above) with custom title bar
- Winamp/WMP-inspired skin: brushed metal gradients, beveled buttons, chunky progress bar
- CSS `border-image` or `box-shadow` tricks for that early-2000s look
- Could even add a classic EQ slider row (visual only or wired to Web Audio BiquadFilters)

---

## Copyright & Legal Notes

### "We vibe-coded this — are we in trouble?"

**The code itself:** You're fine. AI-generated code doesn't infringe copyright by existing. You wrote the prompts, directed the architecture, reviewed the output. That's your project. MIT license is appropriate.

**The music (Rick & Morty tracks):**
- For **personal use / portfolio demo on your machine** → no issue
- For **a public GitHub repo people can clone** → don't commit copyrighted audio files to the repo. Keep `tracks/` in `.gitignore` (it already is based on your README)
- For **distributing a pre-built .exe with R&M music baked in** → that's distributing copyrighted audio, which is infringement even if free
- **Safe approach for the R&M edition:** keep it local-only. Don't publish the build artifact. The repo stays clean (no tracks committed), and you load your own files at runtime
- The **reusable/portfolio version** with the cauldron drop zone is completely clean — users supply their own audio

**TL;DR:** Don't commit or distribute other people's music. Everything else is fine.

---

## Execution Order (copy-paste checklist)

```
[x] 1. Vibe Mode UI hide fix                    — 15 min, app.js only
[x] 2. Cauldron drag-and-drop UI                — 1–2 sessions, client-side only
[x] 3. Two-flavor config setup                  — quick, config.js + branching strategy
[x] 4. Electron wrapper (no more node commands) — 1 session, 2 new files
[ ] 5. Old-school player skin / polish          — ongoing, pure CSS fun
```

Phase 1 and 4 directly solve "I don't want to run node commands." Phase 2 gives you the cool cauldron. Phase 3 splits the flavors. Phase 5 is dessert.
