# Vibe Machine — Visualizer Changes Handoff

## Summary
Several new visualizers were created, tested, and then disabled due to visual artifacts. A clean "sunset" visualizer was created as a replacement. This doc covers what changed and how to undo it.

---

## Current Active Visualizers
`blank → bars → waveform → circular → particles → starfield → pixelgrid → sunset`

Registered in three places:
- `public/config.js` — `visualizers` array
- `public/app.js` — `visualizers` array (lines ~39-48)
- `public/index.html` — `<button>` elements + `<script>` tags

---

## New Files Created (on disk)

| File | Status | Description |
|------|--------|-------------|
| `public/visualizers/sunset.js` | **ACTIVE** | Pixelated sunset matching the `renderTransition()` overlay. Same sun position (0.5, 0.65), 20px grid, HSL palette. Subtle bass-reactive luminance. |
| `public/visualizers/beach.js` | DISABLED | Full ocean scene — wavy sand, crashing waves, palm trees toggle, clouds toggle. Had options panel support. |
| `public/visualizers/beach-alt1.js` | DISABLED | Original pixelated beach. Had a persistent gold rectangle artifact from sun glow bleeding below horizon. This is a copy of the original `beach.js` before it was rewritten. |
| `public/visualizers/synthwave.js` | DISABLED | Neon retro-futuristic grid world. Palm trees + clouds toggles. |
| `public/visualizers/fireworks.js` | DISABLED | Audio-reactive fireworks — bass triggers launches, energy controls burst size. |

---

## How to Re-enable a Disabled Visualizer

For any of the disabled visualizers (`beach`, `beach-alt1`, `synthwave`, `fireworks`):

1. **config.js** — Add the name to the `visualizers` array:
   ```js
   visualizers: ['blank', 'bars', 'waveform', 'circular', 'particles', 'starfield', 'pixelgrid', 'sunset', 'fireworks'],
   ```

2. **index.html** — Add a button + script tag:
   ```html
   <!-- In #viz-modes -->
   <button class="viz-btn" data-mode="fireworks">Fireworks</button>

   <!-- Before app.js script tag -->
   <script src="visualizers/fireworks.js?v=4"></script>
   ```

3. **app.js** — Add to the visualizers array (~line 39):
   ```js
   window.VisualizerFireworks,
   ```

The `data-mode` value must match the visualizer's `.name` property exactly.

---

## How to Undo Everything (Revert to Pre-Session State)

To go back to the original setup with `beach-alt1` as the only beach:

1. **config.js** — Change `'sunset'` back to `'beach-alt1'`
2. **app.js** — Change `window.VisualizerSunset` back to `window.VisualizerBeachAlt1`
3. **index.html** — Change sunset button back:
   ```html
   <button class="viz-btn" data-mode="beach-alt1">Beach</button>
   ```
4. **index.html** — Change script tag back:
   ```html
   <script src="visualizers/beach-alt1.js?v=3"></script>
   ```
5. Optionally delete: `sunset.js`, `beach.js` (rewritten version), `synthwave.js`, `fireworks.js`

> **Note:** `beach-alt1.js` is the backup of the *original* `beach.js` from before any changes. The current `beach.js` is the rewritten ocean scene version.

---

## Cache Busting
Script tags use `?v=N` query params. Currently at `?v=4` for the latest files. Bump the number if the browser shows stale content. The server caches JS for 1 hour.

---

## Known Issues
- **beach-alt1.js** — Gold rectangle artifact. Sun glow math (`dist < 0.6`) extends below the horizon line, creating a visible bright block in the pixelated grid. Multiple fix attempts didn't fully resolve it.
- **Button mapping** — Was previously broken (index-based). Now fixed to use `setVisualizerByName(btn.dataset.mode)` matching the `.name` property. Don't revert this.

---

## Key Code Locations
- `app.js` line ~707: `renderTransition()` — the sunrise/sunset overlay that `sunset.js` matches
- `app.js` line ~806: `TX_SUN_X = 0.5`, `TX_SUN_Y = 0.65` — sun position constants
- `app.js` line ~288: `setVisualizerByName()` — button click handler
