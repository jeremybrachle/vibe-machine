# Portfolio Handoff — Vibe Machine

## Context

Kerry's portfolio site at `/home/kerry/programming/portfolio` has a page for each project. Your page is the **Home page** (`index.html`) — currently a cosmic purple theme with animated CSS visualizer bars and an audio player.

The portfolio wants to embed your actual running app directly into the page so visitors can experience the real Vibe Machine, not just a description of it. If embedding fails (server not running, connection refused, etc.), it falls back gracefully to the current static design.

## What I Need From You

### 1. Generate `portfolio-manifest.json` at your repo root

```json
{
  "schema": 1,
  "project": "vibe-machine",
  "title": "Vibe Machine",
  "embed": {
    "type": "iframe",
    "src": "http://localhost:5001",
    "fallback": "summary"
  },
  "summary": {
    "tagline": "Real-time audio visualizer with 10+ modes",
    "description": "A browser-based audio visualizer with Canvas 2D rendering, Web Audio API analysis, and drag-and-drop music loading. Zero dependencies, pure vanilla JS.",
    "techStack": ["Vanilla JS", "Canvas 2D", "Web Audio API", "Node.js"],
    "features": [
      "10+ visualization modes (bars, waveform, circular, particles, starfield, pixel grid, sunset, starry night, piano)",
      "Drag-and-drop audio loading",
      "Mouse particle effects",
      "Keyboard shortcuts",
      "Vibe Mode (fullscreen immersion)",
      "Queue management with drag-to-reorder"
    ],
    "architecture": "Single-page app: HTML5 Canvas rendering loop driven by Web Audio AnalyserNode frequency data. Node.js static server with /api/tracks endpoint. Each visualizer is a standalone draw() function module."
  },
  "media": {
    "screenshots": [
      "portfolio-assets/bars-mode.png",
      "portfolio-assets/particles-mode.png",
      "portfolio-assets/sunset-mode.png"
    ],
    "videos": [],
    "thumbnail": "portfolio-assets/thumb.png"
  },
  "github": "https://github.com/jeremybrachle/vibe-machine",
  "localPath": "/home/kerry/programming/vibe-machine",
  "commands": {
    "install": "npm install",
    "dev": "node server.js 5001",
    "build": null
  }
}
```

Fill in the `tagline`, `description`, `features`, and `architecture` with your own accurate details — the above is my best guess from reading your code.

### 2. Fix X-Frame-Options for iframe embedding

In `server.js`, the `SECURITY_HEADERS` object has `'X-Frame-Options': 'DENY'`. Change it to:

```js
'X-Frame-Options': 'SAMEORIGIN'
```

This allows the portfolio to iframe you when both are running on localhost. Without this, the browser blocks the embed.

### 3. Create `portfolio-assets/` directory with screenshots

Take screenshots of 2-3 of your best visualizer modes and save them as:

```
portfolio-assets/
  bars-mode.png       (or whatever your best modes are)
  particles-mode.png
  sunset-mode.png
  thumb.png           (a 400x300-ish thumbnail for the project card)
```

If you can't take screenshots programmatically, just create the directory and note which modes would make the best showcase. Kerry can screenshot them manually.

### 4. Confirm the dev port

The portfolio will expect you at `http://localhost:5001`. Verify that `node server.js 5001` works without conflict. If you need a different port, update the manifest accordingly.

## How The Portfolio Will Use This

1. On dev, Kerry runs `node server.js 5001` from your directory
2. The portfolio home page checks for your iframe src
3. If reachable → shows your full app embedded in the page
4. If not reachable → shows the existing cosmic purple visualizer bars (current fallback)
5. On production deploy, the iframe src would point to a deployed URL instead

## What NOT To Change

- Don't modify your core app behavior or UI for this
- Don't add portfolio-specific code to your app.js
- The manifest and assets are the only new files needed
- The X-Frame-Options fix is the only code change

## Report Back

When done, tell me:
1. The manifest file was created at `portfolio-manifest.json`
2. The X-Frame-Options header was changed
3. What screenshots/assets were created (or what needs manual capture)
4. The confirmed dev port
5. Any issues or concerns
