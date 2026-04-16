/* ═══════════════════════════════════════════
   Visualizer: Beach Alternate #1
   Pixelated sunset landscape — the original
   lo-fi beach style. Audio-reactive shimmer
   and color intensity.
   ═══════════════════════════════════════════ */

window.VisualizerBeachAlt1 = {
  name: 'beach-alt1',
  _txCanvas: null,
  _txCtx: null,

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteFrequencyData(dataArray);

    const w = canvas.width;
    const h = canvas.height;

    // Average energy for reactivity
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    const energy = sum / (bufferLength * 255);

    // Bass for sun pulse
    const bassEnd = Math.floor(bufferLength * 0.1);
    let bassSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += dataArray[i];
    const bass = bassSum / (bassEnd * 255);

    const pxSize = 20;
    const cols = Math.ceil(w / pxSize);
    const rows = Math.ceil(h / pxSize);

    if (!this._txCanvas) {
      this._txCanvas = document.createElement('canvas');
      this._txCtx = this._txCanvas.getContext('2d');
    }
    if (this._txCanvas.width !== cols || this._txCanvas.height !== rows) {
      this._txCanvas.width = cols;
      this._txCanvas.height = rows;
    }

    const txCtx = this._txCtx;
    const t = performance.now() * 0.001;

    // Sun position: settles near horizon, pulses slightly with bass
    const sunX = 0.5 + Math.sin(t * 0.08) * 0.03;
    const sunY = 0.58 + Math.sin(t * 0.05) * 0.02 - bass * 0.03;
    const horizon = sunY + 0.08;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ny = y / rows;
        const nx = x / cols;
        const dx = nx - sunX;
        const dy = (ny - sunY) * 2;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let hue, sat, lum;

        if (ny > horizon) {
          // Water / sand — uniform cool ocean
          const depth = Math.min(1, (ny - horizon) / 0.35);
          hue = 210 + depth * 20;
          sat = 25 + energy * 20;
          lum = 10 + (1 - depth) * 14 + energy * 6;
        } else {
          // Sky
          const skyH = Math.max(0, (sunY - ny) / sunY);
          hue = 20 + skyH * 220;
          sat = 80 - skyH * 25 + energy * 10;
          lum = 30 - skyH * 18 + energy * 8;
        }

        // Sun glow
        if (dist < 0.5) {
          const g = Math.pow(1 - dist / 0.5, 2);
          hue = hue + (40 - hue) * g;
          lum = Math.min(100, lum + g * 60 * (0.8 + bass * 0.2));
          sat = Math.min(100, sat + g * 25);
        }

        // Shimmer from audio
        lum += Math.sin(x * 0.7 + y * 0.5 + t * 1.5) * (1.5 + energy * 3);
        lum = Math.max(0, Math.min(100, lum));
        sat = Math.max(0, Math.min(100, sat));

        txCtx.fillStyle = `hsl(${hue},${sat}%,${lum}%)`;
        txCtx.fillRect(x, y, 1, 1);
      }
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._txCanvas, 0, 0, w, h);
  },
};
