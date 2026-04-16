/* ═══════════════════════════════════════════════
   Sunset Visualizer
   ─────────────────────────────────────────────
   Pixelated sunset that matches the sunrise
   transition overlay exactly — same sun position,
   grid size, and color palette.
   ═══════════════════════════════════════════════ */

window.VisualizerSunset = {
  name: 'sunset',

  // Offscreen canvas for pixel work
  _off: null,
  _offCtx: null,

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    const w = canvas.width;
    const h = canvas.height;

    // Match transition constants
    const TX_SUN_X = 0.5;
    const TX_SUN_Y = 0.65;

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

    const t = performance.now() * 0.001;

    // Audio reactivity — gentle lum boost from bass
    analyser.getByteFrequencyData(dataArray);
    let bass = 0;
    const bassEnd = Math.min(8, bufferLength);
    for (let i = 0; i < bassEnd; i++) bass += dataArray[i];
    bass = bass / (bassEnd * 255);           // 0-1

    // Sun position — identical to renderTransition at transitionAlpha ≈ 0
    const sunY = TX_SUN_Y;
    const sunX = TX_SUN_X + Math.sin(t * 0.15) * 0.05;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ny = y / rows;
        const nx = x / cols;
        const dx = nx - sunX;
        const dy = (ny - sunY) * 2;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let hue, sat, lum;

        if (ny > sunY + 0.05) {
          // Below horizon — dark earth
          const depth = Math.min(1, (ny - sunY - 0.05) / 0.3);
          hue = 260 + depth * 20;
          sat = 15;
          lum = Math.max(1, 6 * (1 - depth));
        } else {
          // Sky — warm at horizon, cool at top
          const skyH = Math.max(0, (sunY - ny) / sunY);
          hue = 25 + skyH * 240;
          sat = 75 - skyH * 25;
          lum = 28 - skyH * 20;
        }

        // Sun glow
        if (dist < 0.6) {
          const g = Math.pow(1 - dist / 0.6, 2);
          hue = hue + (40 - hue) * g;
          lum = Math.min(100, lum + g * 55);
          sat = Math.min(100, sat + g * 25);
        }

        // Shimmer
        lum += Math.sin(x * 0.7 + y * 0.5 + t * 1.2) * 1.5;

        // Subtle audio pulse on luminance
        lum += bass * 4;

        lum = Math.max(0, Math.min(100, lum));
        sat = Math.max(0, Math.min(100, sat));

        oc.fillStyle = `hsl(${hue},${sat}%,${lum}%)`;
        oc.fillRect(x, y, 1, 1);
      }
    }

    // Draw pixelated to main canvas
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._off, 0, 0, w, h);
    ctx.restore();
  }
};
