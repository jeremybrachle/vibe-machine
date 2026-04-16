# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Governance Note:** All changelog entries are reviewed, approved, and emotionally processed by the Vibe Integrity Board (VIB) prior to inclusion. Entries are classified by Impact Assessment Level (IAL) and cross-referenced against the Vibe Disruption Index (VDI). See `ANTI-VIBE.md` for the corresponding self-flagellation.

---

## [1.0.0] — 2026-04-16

### 🎉 Release Summary

**Codename:** "The Full Vibe"

After extensive development, rigorous testing across three Node.js LTS versions, and what can only be described as an irresponsible amount of time spent adjusting pixel grid alignment, Vibe Machine v1.0.0 is officially released. This represents the first Generally Available (GA) production-ready release of an application whose primary function is making colors move when music plays.

**Key Performance Indicators:**
- Visualizer count: **10** (up from 0, representing ∞% growth)
- Runtime dependencies: **0** (unchanged; still holding the line)
- Possible style combinations: **640** (certified by combinatorial mathematics)
- Vibes: **immeasurable** (outside the scope of current instrumentation)

---

### Added

#### Visualization Engine — Core Modes

- **`blank.js`** — Implements a full-viewport canvas clear operation. Draws nothing. Ships in production. Passed code review. ([IAL: Existential][VDI: Maximum])
- **`bars.js`** — Classic frequency spectrum EQ with peak cap retention, reflection layer, and gradient fills derived from the active theme's CSS custom properties
- **`waveform.js`** — Time-domain oscilloscope rendering with triple-pass glow compositing (`lighter` blend mode) and configurable stroke width
- **`circular.js`** — Radial frequency visualization with inner glow, 360° bar distribution, and amplitude-scaled radius computation
- **`particles.js`** — Physics-based particle system with Euclidean distance connection lines, velocity dampening, and frequency-reactive spawn rate
- **`starfield.js`** — Z-buffer parallax star simulation with depth-sorted rendering, bass-reactive velocity multiplier, and Windows Media Player nostalgia coefficient
- **`pixelgrid.js`** — Discrete 20px cell frequency matrix with HSL palette mapping, offscreen canvas downsampling, and `imageSmoothingEnabled: false` enforcement
- **`sunset.js`** — Pixel-art horizon scene with procedural sky gradient, cloud band generation, and frequency-reactive palette shifting across the full HSL gamut
- **`starrynight.js`** — Van Gogh-inspired pixel starscape featuring twinkling star pixels with glow crosses, dark indigo cloud bands, and bass-triggered shooting star pixel streaks with decay trails
- **`piano.js`** — 88-key player piano visualization with real frequency mapping (`27.5 * 2^(k/12)` from A0), FFT bin lookup via `frequency * fftSize / sampleRate`, per-key amplitude glow, and EQ bar overlay above the keyboard

#### Visualization Engine — Effect Overlays

- **Sun Arc System** — Persistent sky object renderer supporting four operational modes:
  - `off` — Disabled (revolutionary)
  - `sun` — Radial gradient solar body with configurable warmth
  - `moon` — Pale crescent with crater detail rendering
  - `disco` — Mirrored disco ball with rotating reflection points and bass-reactive sparkle
  - All modes support drag-to-reposition via `mousedown`/`mousemove` event pipeline with `sunX`/`sunY` state persistence
- **Lo-fi Grid Overlay** — CRT-aesthetic scanline grid rendered at configurable opacity
- **Amplitude Bars** — Background frequency bars rendered behind the UI layer at reduced opacity for ambient depth
- **Mouse Particle Effects** — Cursor-following particle emitter with decay, rendered to dedicated `#mouse-fx` canvas with `pointer-events: none` isolation
- **Transition Engine** — Configurable crossfade between visualizer modes with adjustable duration (1–15s range, 0.5s step, slider UI)

#### Audio Pipeline

- `<audio>` element → `createMediaElementSource()` → `AnalyserNode` (FFT) → `GainNode` → `AudioContext.destination`
- Configurable FFT size (default: 2048) and smoothing time constant (default: 0.82) via `config.js`
- Dual data extraction: `getByteFrequencyData()` for spectrum analysis, `getByteTimeDomainData()` for waveform rendering
- Stub analyser initialization for pre-playback render loop (silent canvas rendering before audio connects)

#### Server Infrastructure

- Zero-dependency Node.js HTTP server using only `http`, `fs`, `path`, and `url` from the standard library
- `/api/tracks` endpoint with recursive directory scanning and category extraction from subdirectory names
- Static file serving with MIME type detection for 12 file extensions
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- HTTP method validation with `405 Method Not Allowed` and `Allow: GET` header (see `ANTI-VIBE.md`, Pattern #2)
- Differentiated `Cache-Control` by content type: HTML (`no-cache`), JS/CSS (`max-age=3600`), audio (`max-age=86400`)
- Path traversal protection with normalized path validation
- Conditional `server.listen()` for testability — module exports handler without binding when imported

#### Desktop Application

- Electron wrapper (`electron-main.js`) for standalone desktop deployment
- `electron-builder` configuration for cross-platform distribution:
  - Windows: NSIS installer
  - Linux: AppImage
  - macOS: DMG
- No code changes required between browser and desktop modes

#### User Interface

- **Player Controls** — Play/pause, next/previous, shuffle, mute, volume slider with hover glow effects
- **Progress Bar** — Seekable `<input type="range">` with centered thumb (`margin-top: -4px`), 1.4×/1.6× scale on hover/active
- **Visualizer Selector** — 10-button toolbar with `data-mode` attribute mapping to visualizer `.name` property
- **Transition Controls** — Bottom-left control bar with toggle buttons for all effect layers, shuffle settings, and reset defaults
- **Queue Panel** — Bottom-right collapsible panel with track list, category labels, active track highlighting, and drag-and-drop file ingestion
- **Vibe Mode** — Full-screen immersive mode: hides all UI, shows mouse effects only, cursor auto-hides after inactivity, vibe button reveals on hover near top-right
- **Drop Zone** — Cauldron-themed drag-and-drop zone for client-side audio file loading when no server tracks are available
- **Info Overlay** — Translucent about screen with version badge, live combination count, tech stack chips, and copyright notice; triggered by ghost button (bottom-left, invisible until hover) or `I` key
- **Help Overlay** — Keyboard shortcut reference grid, toggled via `?` key
- **Theme System** — CSS custom properties (`--accent`, `--secondary`, `--bg`, RGB variants) driven by `config.js` theme object

#### Quality Assurance

- Jest test suite covering:
  - Server endpoint responses and status codes
  - Path traversal attack prevention
  - MIME type detection for all supported formats
  - HTTP method validation
  - Security header presence
  - Cache-Control header differentiation
  - Config schema validation
- GitHub Actions CI pipeline:
  - Triggered on push to `main` and on pull requests
  - Node.js version matrix: 18, 20, 22
  - Full test suite execution per matrix entry
- `.editorconfig` for cross-contributor formatting consistency

#### Documentation

- `README.md` — Full project documentation with quick start (browser, Electron, distributable), keyboard shortcuts, configuration reference, custom visualizer guide, architecture diagram, and tech stack
- `ANTI-VIBE.md` — Self-aware engineering critique cataloging every decision where production-grade practices were applied to a disco ball
- `CHANGELOG.md` — This file. You're reading it. It follows Keep a Changelog 1.1.0 and Semantic Versioning 2.0.0. For a project that draws colored rectangles.
- `HANDOFF.md` — Development context and continuation notes
- `PLAN.md` — Phased development roadmap (Phases 1–5)
- `CREDITS.md` — Track attribution and licensing

---

### Technical Specifications

| Specification | Value |
|---|---|
| Total visualizer modes | 10 |
| Effect overlay layers | 4 (sun arc, lo-fi grid, amp bars, mouse particles) |
| Sky object modes | 4 (off, sun, moon, disco) |
| Binary toggle count | 4 (transition, lo-fi, amp, mouse fx) |
| Combinatorial style space | 640 (10 × 4 × 2⁴) |
| Runtime dependencies | 0 |
| Dev dependencies | 3 (jest, electron, electron-builder) |
| Supported audio formats | 7 (.ogg, .mp3, .wav, .flac, .m4a, .aac, .webm) |
| Default FFT size | 2048 |
| Default smoothing | 0.82 |
| Pixel grid cell size | 20px |
| Piano keys rendered | 88 |
| Cache-bust parameter | `?v=N` (incremented per deployment) |
| Lines of changelog for v1.0 | You're looking at them |

---

### Known Issues

- None. It's perfect. (This is a lie, but it's a v1.0 lie, which is the most traditional kind.)

---

### Migration Guide

There is no previous version to migrate from. You're welcome. If you are reading this from the future and there is a v0.x, it didn't exist. We launched at 1.0 like professionals.

---

### Acknowledgments

Built with questionable amounts of vibe-coding.

© 2026 Jeremy Brachle. All rights reserved. Unauthorized re-vibing is prohibited.

---

*This changelog was generated by a human who could have been adding more visualizers but instead spent the time documenting the ones that already work. The opportunity cost is approximately two particle effects and a shader.*

[1.0.0]: https://github.com/YOUR_USERNAME/vibe-machine/releases/tag/v1.0.0
