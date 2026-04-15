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

- Node.js (v18+)
- A browser
- Audio files you legally own rights to play

That's it. The runtime has zero production dependencies — just the Node.js standard library.

For development (testing):

```bash
npm install
```

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

All branding, colors, and behavior live in [`config.js`](public/config.js):

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

1. Create `public/visualizers/yourmode.js` exposing a global object:

```js
window.VisualizerYourmode = {
  name: 'yourmode',
  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    // Your rendering code here
  }
};
```

2. Add a `<script>` tag in `public/index.html` before `app.js`
3. Add a button in `#viz-modes` in `public/index.html`
4. Add `'yourmode'` to the `visualizers` array in `public/config.js`

## Architecture

```
vibe-machine/
├── server.js                → Node.js static server + /api/tracks endpoint
├── jest.config.js           → Test runner configuration
├── .editorconfig            → Consistent formatting across editors
├── .github/
│   └── workflows/ci.yml     → CI pipeline (tests on push & PR)
├── public/                  → Client assets (served as static files)
│   ├── index.html           → Single-page shell
│   ├── styles.css           → Dark theme with CSS custom properties
│   ├── config.js            → All settings (branding, audio, theme)
│   ├── app.js               → Main controller (audio, state, UI)
│   └── visualizers/         → Each mode is a standalone draw() function
│       ├── bars.js
│       ├── waveform.js
│       ├── circular.js
│       ├── particles.js
│       └── starfield.js
├── tests/                   → Test suite
│   ├── server.test.js       → Server integration & unit tests
│   └── config.test.js       → Config schema validation
└── tracks/                  → Your music (gitignored)
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
| Testing | Jest (server + config validation) |
| CI | GitHub Actions (Node 18/20/22 matrix) |
| Build system | There isn't one. You're welcome. |

## The Anti-Vibe

We unironically named this thing "Vibe Machine" and then gave it a CI pipeline.

Behind the particles and starfields, this project follows the same engineering practices you'd expect from production software:

- **Automated CI** — GitHub Actions runs the full test suite on every push to `main` and on every pull request, across Node 18, 20, and 22
- **Unit & integration tests** — Server endpoints, path traversal protection, MIME type handling, audio format detection, and config schema validation
- **Structured codebase** — Client code in `public/`, server logic at root, tests isolated in `tests/`, CI in `.github/`
- **Testable architecture** — Server exports its handler and constants for direct testing; conditional `listen()` keeps the module importable
- **Editor consistency** — `.editorconfig` enforces formatting conventions across contributors

Because even a project called "Vibe Machine" should pass a code review.

## License

[MIT](LICENSE)
