# Vibe Machine

A real-time, audio-reactive music visualizer built entirely with vanilla JavaScript, HTML Canvas, and the Web Audio API. No frameworks. No build tools. No npm install. Just vibes.

*(Yes, "vibe" is in the name. No, we will not be taking questions about our commitment to the bit.)*

## Demo

Drop your music into `tracks/`, start the server, and hit play. Five visualization modes react to your audio in real time:

| Mode | Description |
|---|---|
| **Bars** | Classic frequency EQ with peak caps and reflections |
| **Waveform** | Neon oscilloscope with glow layers |
| **Circular** | Radial frequency ring with inner glow |
| **Particles** | Physics-based particle system with connection lines |
| **Starfield** | WMP-nostalgia stars flying at your face |

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/vibe-machine.git
cd vibe-machine

# 2. Add music
#    Drop audio files into tracks/ (flat or organized in subdirectories)
#    Supports: .ogg .mp3 .wav .flac .m4a .aac .webm

# 3. Run
node server.js

# 4. Open http://localhost:3000 and press Space
```

Custom port:

```bash
node server.js 8080
```

## Prerequisites

- Node.js (v14+)
- A browser
- Audio files you legally own rights to play

That's it. The entire dependency list is the Node.js standard library.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `→` / `N` | Next track |
| `←` / `P` | Previous track |
| `S` | Toggle shuffle |
| `V` | Cycle visualizer |
| `1`–`5` | Jump to specific visualizer |
| `F` / `Enter` | Vibe Mode (fullscreen + hidden UI) |
| `M` | Mute / Unmute |
| `↑` / `↓` | Volume |
| `?` | Keyboard shortcut help |
| `Esc` | Exit Vibe Mode |

## Track Organization

```
tracks/
├── song.mp3                  # Flat — shows as "uncategorized"
├── electronic/
│   ├── track-one.ogg
│   └── track-two.flac
└── ambient/
    └── rain-sounds.wav       # Subdirectory name becomes the category
```

The server scans `tracks/` on each request, so you can add or remove files without restarting.

## Configuration

All branding, colors, and behavior live in [`config.js`](config.js):

```js
window.VIBE_CONFIG = {
  title: 'Vibe Machine',
  defaultVolume: 0.7,
  autoPlay: false,
  shuffleByDefault: false,
  fftSize: 2048,
  smoothing: 0.82,
  theme: {
    accent:    '#00c878',
    secondary: '#b060ff',
    bg:        '#000000',
    // ...
  },
};
```

## Adding a Custom Visualizer

1. Create `visualizers/yourmode.js` exposing a global object:

```js
window.VisualizerYourmode = {
  name: 'yourmode',
  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    // Your rendering code here
  }
};
```

2. Add a `<script>` tag in `index.html` before `app.js`
3. Add a button in `#viz-modes` in `index.html`
4. Add `'yourmode'` to the `visualizers` array in `config.js`

## Architecture

```
server.js          → Zero-dependency Node.js static server + /api/tracks endpoint
index.html         → Single-page shell, loads everything via <script> tags
styles.css         → Dark theme with CSS custom properties driven by config
config.js          → All settings in one place (branding, audio, theme, behavior)
app.js             → Main controller (audio pipeline, state, keyboard, UI logic)
visualizers/*.js   → Each mode is a standalone draw() function using Canvas 2D
```

The audio pipeline: `<audio> → MediaElementSource → AnalyserNode → GainNode → destination`

Each visualization mode receives the AnalyserNode and renders directly to a full-viewport canvas at display refresh rate.

## Tech Stack

| What | How |
|---|---|
| Rendering | HTML5 Canvas 2D |
| Audio analysis | Web Audio API AnalyserNode |
| Server | Node.js `http` + `fs` (stdlib only) |
| Styling | Vanilla CSS with custom properties |
| Build system | There isn't one. You're welcome. |

## License

[MIT](LICENSE)
