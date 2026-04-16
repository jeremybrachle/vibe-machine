/* ═══════════════════════════════════════════
   Visualizer: Piano
   ─────────────────────────────────────────
   88-key player piano EQ. Frequency bins are
   mapped to piano keys (A0–C8). Keys light up
   white-on-black in the same pixel grid style
   as the other visualizers.
   ═══════════════════════════════════════════ */

window.VisualizerPiano = {
  name: 'piano',

  _off: null,
  _offCtx: null,

  // Which of the 88 keys are black? (0-indexed from A0)
  // Pattern relative to A: A A# B C C# D D# E F F# G G#
  //   black indices:         1        4     6        9  11
  _isBlack: null,

  _initKeys() {
    // 88 keys: key 0 = A0, key 87 = C8
    // In the chromatic scale starting from A: semitone offsets that are black
    const blackInOctave = new Set([1, 4, 6, 9, 11]);
    this._isBlack = new Array(88);
    for (let i = 0; i < 88; i++) {
      this._isBlack[i] = blackInOctave.has(i % 12);
    }
  },

  // Map piano key index (0-87) to a frequency in Hz
  // A0 = 27.5 Hz, each semitone is *2^(1/12)
  _keyToFreq(k) {
    return 27.5 * Math.pow(2, k / 12);
  },

  // Find the FFT bin closest to a given frequency
  _freqToBin(freq, sampleRate, fftSize) {
    const binHz = sampleRate / fftSize;
    return Math.round(freq / binHz);
  },

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    if (!this._isBlack) this._initKeys();

    const w = canvas.width;
    const h = canvas.height;
    const pxSize = 20;
    const cols = Math.ceil(w / pxSize);
    const rows = Math.ceil(h / pxSize);

    // Lazy-init offscreen canvas
    if (!this._off) {
      this._off = document.createElement('canvas');
      this._offCtx = this._off.getContext('2d');
    }
    if (this._off.width !== cols || this._off.height !== rows) {
      this._off.width = cols;
      this._off.height = rows;
    }
    const oc = this._offCtx;

    analyser.getByteFrequencyData(dataArray);

    // Get sample rate from audio context — try multiple access paths
    const actx = analyser.context || analyser._context || null;
    const sampleRate = actx ? actx.sampleRate : 44100;
    const fftSize = analyser.fftSize || 2048;
    const t = performance.now() * 0.001;

    // ── Black background ──
    oc.fillStyle = '#000';
    oc.fillRect(0, 0, cols, rows);

    // ── Layout: 88 keys across the screen ──
    // Each key gets a column band. We center 88 keys in the available cols.
    const totalKeys = 88;
    const keyW = Math.max(1, Math.floor(cols / totalKeys));
    const totalW = keyW * totalKeys;
    const offsetX = Math.floor((cols - totalW) / 2);

    // Vertical layout: bottom portion is the keyboard, upper portion is the EQ glow
    const keyboardTop = Math.floor(rows * 0.70); // keys occupy bottom 30%
    const eqBottom = keyboardTop - 1;

    // ── Get amplitude per key ──
    const amps = new Float32Array(totalKeys);
    for (let k = 0; k < totalKeys; k++) {
      const freq = this._keyToFreq(k);
      const bin = this._freqToBin(freq, sampleRate, fftSize);

      if (bin >= 0 && bin < bufferLength) {
        // Average a small neighborhood for smoother response
        let sum = 0;
        let count = 0;
        const spread = k < 30 ? 1 : k < 60 ? 2 : 3;
        for (let b = Math.max(0, bin - spread); b <= Math.min(bufferLength - 1, bin + spread); b++) {
          sum += dataArray[b];
          count++;
        }
        amps[k] = (sum / count) / 255;
      }
    }

    // ── Draw EQ bars above keyboard (rising from keyboard top) ──
    const maxBarRows = eqBottom; // can fill all the way to top
    for (let k = 0; k < totalKeys; k++) {
      const amp = amps[k];
      if (amp < 0.03) continue;

      const kx = offsetX + k * keyW;
      const barH = Math.floor(amp * maxBarRows * 0.85);

      for (let row = 0; row < barH; row++) {
        const ry = eqBottom - row;
        if (ry < 0) break;

        const rowF = row / Math.max(1, maxBarRows * 0.85); // 0 at bottom, 1 at top
        const fade = 1 - rowF * 0.6; // fade out toward top

        // White keys get warm white glow, black keys get cool blue
        let lum, hue, sat;
        if (this._isBlack[k]) {
          hue = 220;
          sat = 30;
          lum = (12 + amp * 35 * fade) * (0.95 + Math.sin(k * 0.9 + row * 0.3 + t * 2) * 0.05);
        } else {
          hue = 40;
          sat = 10;
          lum = (15 + amp * 45 * fade) * (0.95 + Math.sin(k * 0.7 + row * 0.4 + t * 1.5) * 0.05);
        }

        lum = Math.max(0, Math.min(100, lum));
        oc.fillStyle = `hsl(${hue}, ${sat}%, ${lum}%)`;
        for (let dx = 0; dx < keyW; dx++) {
          oc.fillRect(kx + dx, ry, 1, 1);
        }
      }
    }

    // ── Draw piano keyboard at bottom ──
    for (let k = 0; k < totalKeys; k++) {
      const kx = offsetX + k * keyW;
      const amp = amps[k];
      const isBlack = this._isBlack[k];

      for (let row = keyboardTop; row < rows; row++) {
        const rowInKey = row - keyboardTop;
        const keyRows = rows - keyboardTop;

        if (isBlack) {
          // Black key — dark, lights up slightly blue when active
          const baseLum = 1;
          const activeLum = amp * 18;
          const lum = baseLum + activeLum * (0.9 + Math.sin(t * 3 + k * 0.5) * 0.1);
          oc.fillStyle = `hsl(220, 25%, ${Math.min(20, lum)}%)`;
        } else {
          // White key — very dark at rest, lights up warm white when active
          const baseLum = 4;
          const activeLum = amp * 40;
          const shimmer = Math.sin(k * 0.3 + t * 1.2) * 0.5;
          const lum = baseLum + activeLum + shimmer;
          // Subtle gradient: brighter at top of key, darker at bottom
          const keyFade = 1 - (rowInKey / keyRows) * 0.3;
          oc.fillStyle = `hsl(40, 8%, ${Math.min(50, lum * keyFade)}%)`;
        }

        for (let dx = 0; dx < keyW; dx++) {
          oc.fillRect(kx + dx, row, 1, 1);
        }
      }

      // Key separator line (1px gap between keys)
      if (k > 0 && keyW > 1) {
        oc.fillStyle = '#000';
        for (let row = keyboardTop; row < rows; row++) {
          oc.fillRect(kx, row, 1, 1);
        }
      }
    }

    // ── Render to main canvas ──
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._off, 0, 0, w, h);
    ctx.restore();
  }
};
