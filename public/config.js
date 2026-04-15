/* ═══════════════════════════════════════════════
   Vibe Machine — Configuration
   ─────────────────────────────────────────────
   All branding, theming, and behavior settings
   live here. Change this file to make the
   visualizer your own.
   ═══════════════════════════════════════════════ */

window.VIBE_CONFIG = {

  // ── Branding ──
  title: 'Vibe Machine',
  subtitle: '',
  idleText: 'Drop some tracks in and press play',
  vibeButtonLabel: '⟐ VIBE MODE',

  // ── Audio ──
  // Supported formats: .ogg, .mp3, .wav, .flac, .m4a, .aac, .webm
  // Server scans tracks/ for subdirectories (categories) containing audio files.
  trackFormats: ['.ogg', '.mp3', '.wav', '.flac', '.m4a', '.aac', '.webm'],
  defaultVolume: 0.7,           // 0.0 – 1.0
  autoPlay: false,              // Start playing on load?
  shuffleByDefault: false,      // Start shuffled?

  // ── Analyser ──
  fftSize: 2048,                // Power of 2: 256–32768. Higher = more detail, more CPU
  smoothing: 0.82,              // 0.0 (jerky) – 1.0 (very smooth)

  // ── Visualizers ──
  // Order matters — this is the tab order in the UI.
  // Each entry maps to a window.Visualizer* object.
  // To add a new visualizer: create visualizers/myvis.js exposing
  //   window.VisualizerMyvis = { name: 'myvis', draw(ctx, canvas, analyser, data, len) {} }
  // then add 'myvis' here and add a <script> tag in index.html.
  visualizers: ['bars', 'waveform', 'circular', 'particles', 'starfield'],
  defaultVisualizer: 0,         // Index into the array above

  // ── Theme Colors ──
  // Used by CSS custom properties and visualizers.
  theme: {
    accent:      '#00c878',     // Primary accent (buttons, active states)
    accentRGB:   '0, 200, 120', // Same as accent but as R,G,B for rgba()
    secondary:   '#b060ff',     // Secondary accent (vibe button, waveform ghost)
    secondaryRGB: '176, 96, 255',
    bg:          '#000000',     // Background
    textPrimary: '#ffffff',
    textSecondary: '#999999',
    textDim:     '#666666',
  },

  // ── Vibe Mode ──
  vibeMouseTimeout: 2500,       // ms before cursor re-hides after mouse movement

  // ── Drop Zone ──
  // true  = show cauldron when no tracks are loaded (reusable/portfolio edition)
  // false = hide cauldron, expect pre-bundled tracks/ folder
  dropZoneEnabled: true,
};
