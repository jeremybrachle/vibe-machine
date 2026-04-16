/* ═══════════════════════════════════════════
   Visualizer: Starry Night
   ─────────────────────────────────────────
   Pixelated night sky with twinkling stars,
   drifting clouds, and shooting stars on bass.
   Same 20px grid style as the sunset visualizer.
   ═══════════════════════════════════════════ */

window.VisualizerStarrynight = {
  name: 'starrynight',

  _off: null,
  _offCtx: null,

  // Fixed star map — generated once, stable positions
  _stars: null,
  _shooters: null,

  _initStars(cols, rows) {
    this._stars = [];
    const count = Math.floor(cols * rows * 0.06);
    for (let i = 0; i < count; i++) {
      this._stars.push({
        cx: Math.floor(Math.random() * cols),
        cy: Math.floor(Math.random() * Math.floor(rows * 0.7)),
        speed: 0.8 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        bright: 0.5 + Math.random() * 0.5,
        hue: Math.random() < 0.7 ? 45 + Math.random() * 15 : 210 + Math.random() * 30,
      });
    }
    this._shooters = [];
  },

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
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

    // Init stars on first run or resize
    if (!this._stars || this._stars.length === 0) {
      this._initStars(cols, rows);
    }

    const t = performance.now() * 0.001;

    // ── Audio ──
    analyser.getByteFrequencyData(dataArray);
    let bass = 0, mid = 0, high = 0;
    const bassEnd = Math.min(8, bufferLength);
    const midEnd = Math.min(Math.floor(bufferLength * 0.4), bufferLength);
    for (let i = 0; i < bufferLength; i++) {
      if (i < bassEnd) bass += dataArray[i];
      else if (i < midEnd) mid += dataArray[i];
      else high += dataArray[i];
    }
    bass /= bassEnd * 255;
    mid /= (midEnd - bassEnd) * 255;
    high /= (bufferLength - midEnd) * 255;

    const horizon = 0.78;

    // ── Sky pass: deep black with very subtle blue near horizon ──
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ny = y / rows;

        let hue, sat, lum;

        if (ny > horizon) {
          // Below horizon — pure black ground
          hue = 0;
          sat = 0;
          lum = 0;
        } else {
          // Sky — almost black, faint navy glow near horizon
          const skyF = ny / horizon; // 0 at top, 1 at horizon
          hue = 230;
          sat = 30 + skyF * 15;
          lum = 1 + skyF * 3; // 1% at top → 4% near horizon
        }

        // Very faint shimmer
        lum += Math.sin(x * 0.6 + y * 0.4 + t * 0.8) * 0.4;
        lum += bass * 1.5;
        lum = Math.max(0, Math.min(100, lum));

        oc.fillStyle = `hsl(${hue},${sat}%,${lum}%)`;
        oc.fillRect(x, y, 1, 1);
      }
    }

    // ── Clouds: dark indigo shapes that drift, bass-reactive ──
    const cloudBands = [
      { cy: 0.20, speed: 0.012, scale: 8, layers: 3 },
      { cy: 0.40, speed: 0.008, scale: 10, layers: 2 },
      { cy: 0.60, speed: 0.015, scale: 7, layers: 2 },
    ];

    for (const band of cloudBands) {
      const by = Math.floor(band.cy * rows);
      for (let layer = 0; layer < band.layers; layer++) {
        const drift = t * band.speed * (1 + layer * 0.3);
        for (let x = 0; x < cols; x++) {
          const nx = (x / cols + drift) % 1.0;
          // Noise-like cloud shape from layered sine
          const density =
            Math.sin(nx * band.scale + layer * 2.1) * 0.4 +
            Math.sin(nx * band.scale * 2.3 + layer * 4.7 + t * 0.05) * 0.3 +
            Math.sin(nx * band.scale * 5.1 + layer * 1.3) * 0.15;

          if (density < 0.15) continue;

          const cloudH = 3 + Math.floor(density * 3);
          for (let dy = -cloudH; dy <= cloudH; dy++) {
            const cy = by + dy + layer * 2;
            if (cy < 0 || cy >= Math.floor(rows * horizon)) continue;

            const edgeFade = 1 - Math.abs(dy) / (cloudH + 1);
            const cloudLum = 5 + density * 6 * edgeFade + mid * 3 * edgeFade;

            // Only draw if brighter than existing sky (don't lighten too much)
            oc.fillStyle = `hsl(240, 20%, ${Math.min(12, cloudLum)}%)`;
            oc.fillRect(x, cy, 1, 1);
          }
        }
      }
    }

    // ── Stars: twinkling pixels ──
    for (const star of this._stars) {
      const twinkle = 0.3 + 0.7 * Math.sin(t * star.speed + star.phase);
      const pulse = star.bright * twinkle * (0.6 + high * 0.8);
      if (pulse < 0.2) continue;

      const lum = 40 + pulse * 55;
      const sat = star.hue > 100 ? 40 : 20;

      oc.fillStyle = `hsl(${star.hue}, ${sat}%, ${lum}%)`;
      oc.fillRect(star.cx, star.cy, 1, 1);

      // Bright stars get a 1px glow cross
      if (pulse > 0.65) {
        const glowLum = 15 + pulse * 15;
        oc.fillStyle = `hsl(${star.hue}, ${sat * 0.5}%, ${glowLum}%)`;
        if (star.cx > 0) oc.fillRect(star.cx - 1, star.cy, 1, 1);
        if (star.cx < cols - 1) oc.fillRect(star.cx + 1, star.cy, 1, 1);
        if (star.cy > 0) oc.fillRect(star.cx, star.cy - 1, 1, 1);
        if (star.cy < rows - 1) oc.fillRect(star.cx, star.cy + 1, 1, 1);
      }
    }

    // ── Shooting stars: bass-triggered pixel streaks ──
    // Spawn
    if (bass > 0.5 && this._shooters.length < 3 && Math.random() < bass * 0.25) {
      const sx = Math.floor(Math.random() * cols * 0.6 + cols * 0.2);
      const sy = Math.floor(Math.random() * rows * 0.3);
      this._shooters.push({
        x: sx, y: sy,
        vx: (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6),
        vy: 0.3 + Math.random() * 0.4,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.02,
        len: 4 + Math.floor(Math.random() * 4),
      });
    }

    // Update & draw
    for (let i = this._shooters.length - 1; i >= 0; i--) {
      const s = this._shooters[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life -= s.decay;

      if (s.life <= 0 || s.x < 0 || s.x >= cols || s.y >= rows * horizon) {
        this._shooters.splice(i, 1);
        continue;
      }

      // Draw tail pixels behind the head
      for (let p = 0; p < s.len; p++) {
        const px = Math.floor(s.x - s.vx * p * 0.7);
        const py = Math.floor(s.y - s.vy * p * 0.7);
        if (px < 0 || px >= cols || py < 0 || py >= rows) continue;
        const fade = (1 - p / s.len) * s.life;
        const lum = 50 + fade * 45;
        oc.fillStyle = `hsl(45, 30%, ${lum}%)`;
        oc.fillRect(px, py, 1, 1);
      }
    }

    // ── Render to main canvas ──
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this._off, 0, 0, w, h);
    ctx.restore();
  }
};
