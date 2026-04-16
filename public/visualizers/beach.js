/* ═══════════════════════════════════════════
   Visualizer: Beach
   Full-width ocean scene — sand on the bottom,
   water above with crashing waves. Audio-reactive
   wave intensity, foam, and sky glow.

   Options (toggled via viz-options panel):
     palmTrees  — draw palm tree silhouettes
     clouds     — animated clouds in the sky
   ═══════════════════════════════════════════ */

window.VisualizerBeach = {
  name: 'beach',
  options: {
    palmTrees: { label: 'Palm Trees', value: false },
    clouds:    { label: 'Clouds',     value: false },
  },

  _trees: null,
  _cloudList: null,

  _initTrees(w, h) {
    const sandTop = h * 0.72;
    this._trees = [];
    const count = Math.max(3, Math.floor(w / 300));
    for (let i = 0; i < count; i++) {
      this._trees.push({
        x: (w / (count + 1)) * (i + 1) + (Math.random() - 0.5) * 80,
        trunkH: 100 + Math.random() * 60,
        lean: (Math.random() - 0.5) * 0.35,
        fronds: 5 + Math.floor(Math.random() * 3),
        frondLen: 55 + Math.random() * 30,
        phase: Math.random() * Math.PI * 2,
      });
    }
  },

  _initClouds(w) {
    this._cloudList = [];
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      this._cloudList.push({
        x: Math.random() * w * 1.5 - w * 0.25,
        y: 30 + Math.random() * 100,
        w: 120 + Math.random() * 180,
        h: 30 + Math.random() * 25,
        speed: 8 + Math.random() * 15,
        puffs: 3 + Math.floor(Math.random() * 3),
      });
    }
  },

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteFrequencyData(dataArray);

    const w = canvas.width;
    const h = canvas.height;
    const t = performance.now() * 0.001;

    // ── Audio analysis ──
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    const energy = sum / (bufferLength * 255);

    const bassEnd = Math.floor(bufferLength * 0.08);
    let bassSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += dataArray[i];
    const bass = bassSum / (bassEnd * 255);

    const midStart = Math.floor(bufferLength * 0.1);
    const midEnd = Math.floor(bufferLength * 0.4);
    let midSum = 0;
    for (let i = midStart; i < midEnd; i++) midSum += dataArray[i];
    const mids = midSum / ((midEnd - midStart) * 255);

    // ── Layout ──
    const horizon = h * 0.42;
    const sandTop = h * 0.72;

    // ── Sky gradient (extends slightly past horizon for blending) ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon + 20);
    const skyBright = 0.6 + energy * 0.4;
    skyGrad.addColorStop(0, `rgba(25, 80, ${Math.floor(160 * skyBright)}, 1)`);
    skyGrad.addColorStop(0.45, `rgba(${Math.floor(100 + energy * 80)}, ${Math.floor(160 + energy * 60)}, ${Math.floor(220 * skyBright)}, 1)`);
    skyGrad.addColorStop(0.85, `rgba(${Math.floor(180 + energy * 50)}, ${Math.floor(210 + energy * 30)}, ${Math.floor(240 * skyBright)}, 1)`);
    skyGrad.addColorStop(1, `rgba(${Math.floor(140 + energy * 40)}, ${Math.floor(190 + energy * 30)}, ${Math.floor(220 * skyBright)}, 1)`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizon + 20);

    // ── Sun (low on horizon) ──
    const sunX = w * 0.7;
    const sunY = horizon - 20 + Math.sin(t * 0.15) * 5;
    const sunR = 35 + bass * 15;
    // Draw glow as a circle, not a square
    ctx.save();
    const sunGlow = ctx.createRadialGradient(sunX, sunY, sunR * 0.3, sunX, sunY, sunR * 4);
    sunGlow.addColorStop(0, `rgba(255, 240, 180, ${0.9 + bass * 0.1})`);
    sunGlow.addColorStop(0.25, `rgba(255, 200, 100, 0.4)`);
    sunGlow.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 4, 0, Math.PI * 2);
    ctx.fill();
    // Sun disc
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 240, 200, ${0.85 + bass * 0.15})`;
    ctx.fill();
    ctx.restore();

    // ── Clouds (optional) ──
    if (this.options.clouds.value) {
      if (!this._cloudList) this._initClouds(w);
      ctx.save();
      for (const c of this._cloudList) {
        const cx = ((c.x + c.speed * t) % (w + c.w * 2)) - c.w;
        ctx.globalAlpha = 0.7 + energy * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.55 + energy * 0.15})`;
        for (let p = 0; p < c.puffs; p++) {
          const px = cx + (p / c.puffs) * c.w;
          const py = c.y + Math.sin(p * 2.3) * c.h * 0.3;
          const pr = c.h * (0.7 + Math.sin(p * 1.7) * 0.3);
          ctx.beginPath();
          ctx.ellipse(px, py, pr * 1.5, pr, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // ── Ocean ──
    const oceanGrad = ctx.createLinearGradient(0, horizon, 0, sandTop);
    const oceanBright = 0.8 + energy * 0.2;
    oceanGrad.addColorStop(0, `rgba(20, ${Math.floor(100 * oceanBright)}, ${Math.floor(170 * oceanBright)}, 1)`);
    oceanGrad.addColorStop(0.5, `rgba(15, ${Math.floor(80 * oceanBright)}, ${Math.floor(140 * oceanBright)}, 1)`);
    oceanGrad.addColorStop(1, `rgba(30, ${Math.floor(120 * oceanBright)}, ${Math.floor(160 * oceanBright)}, 1)`);
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, horizon, w, sandTop - horizon + 10);

    // ── Waves ──
    const waveRows = 6;
    for (let waveI = 0; waveI < waveRows; waveI++) {
      const waveY = horizon + ((sandTop - horizon) / waveRows) * waveI;
      const freq = 0.008 + waveI * 0.003;
      const amp = 6 + bass * 15 + waveI * 2;
      const speed = 1.2 + waveI * 0.3;
      const alpha = 0.15 + (waveI / waveRows) * 0.1 + mids * 0.1;

      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const y = waveY
          + Math.sin(x * freq + t * speed + waveI * 1.3) * amp
          + Math.sin(x * freq * 2.3 + t * speed * 0.7) * amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();

      const depth = waveI / waveRows;
      ctx.fillStyle = `rgba(${Math.floor(20 + depth * 30)}, ${Math.floor(90 + depth * 40 + energy * 30)}, ${Math.floor(150 + depth * 30 + energy * 20)}, ${alpha})`;
      ctx.fill();

      // Wave crest foam
      if (waveI < 3) {
        ctx.save();
        ctx.globalAlpha = 0.3 + bass * 0.3;
        ctx.strokeStyle = `rgba(220, 240, 255, ${0.3 + energy * 0.3})`;
        ctx.lineWidth = 1.5 + bass * 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const y = waveY
            + Math.sin(x * freq + t * speed + waveI * 1.3) * amp
            + Math.sin(x * freq * 2.3 + t * speed * 0.7) * amp * 0.4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Shore break / crashing wave ──
    const crashY = sandTop - 8;
    const crashAmp = 4 + bass * 12;
    ctx.save();
    ctx.globalAlpha = 0.5 + bass * 0.4;
    ctx.strokeStyle = 'rgba(230, 245, 255, 0.8)';
    ctx.lineWidth = 2 + bass * 3;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y = crashY
        + Math.sin(x * 0.015 + t * 2.5) * crashAmp
        + Math.sin(x * 0.04 + t * 1.8) * crashAmp * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Foam fill below the crash line
    ctx.lineTo(w, sandTop + 15);
    ctx.lineTo(0, sandTop + 15);
    ctx.closePath();
    ctx.fillStyle = `rgba(200, 230, 245, ${0.15 + bass * 0.2})`;
    ctx.fill();
    ctx.restore();

    // ── Sand (wavy top edge — not a rectangle) ──
    // Build a wavy shoreline path matching the wave rhythm
    ctx.save();
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const waveOffset = Math.sin(x * 0.012 + t * 1.0) * 10
        + Math.sin(x * 0.025 + t * 0.6) * 5
        + Math.sin(x * 0.005 + t * 0.3) * 8;
      const y = sandTop + waveOffset;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    const sandGrad = ctx.createLinearGradient(0, sandTop - 15, 0, h);
    sandGrad.addColorStop(0, `rgb(${225 + Math.floor(energy * 20)}, ${200 + Math.floor(energy * 15)}, ${150 + Math.floor(energy * 10)})`);
    sandGrad.addColorStop(0.3, `rgb(${210 + Math.floor(energy * 15)}, ${185 + Math.floor(energy * 10)}, ${135 + Math.floor(energy * 8)})`);
    sandGrad.addColorStop(1, `rgb(${185 + Math.floor(energy * 10)}, ${160 + Math.floor(energy * 8)}, ${110 + Math.floor(energy * 5)})`);
    ctx.fillStyle = sandGrad;
    ctx.fill();
    ctx.restore();

    // Wet sand strip (gradient along wavy shoreline)
    ctx.save();
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const waveOffset = Math.sin(x * 0.012 + t * 1.0) * 10
        + Math.sin(x * 0.025 + t * 0.6) * 5
        + Math.sin(x * 0.005 + t * 0.3) * 8;
      const y = sandTop + waveOffset;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    // Offset bottom edge for wet strip width
    for (let x = w; x >= 0; x -= 2) {
      const waveOffset = Math.sin(x * 0.012 + t * 1.0) * 10
        + Math.sin(x * 0.025 + t * 0.6) * 5
        + Math.sin(x * 0.005 + t * 0.3) * 8;
      const y = sandTop + waveOffset + 20 + bass * 10;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(170, 150, 110, ${0.4 + bass * 0.2})`;
    ctx.fill();
    ctx.restore();

    // Sand texture dots
    ctx.save();
    ctx.globalAlpha = 0.12 + energy * 0.05;
    ctx.fillStyle = '#c0a070';
    for (let i = 0; i < 200; i++) {
      const sx = ((i * 137.5 + t * 0.5) % w);
      const sy = sandTop + 15 + ((i * 97.3) % (h - sandTop - 20));
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.restore();

    // ── Palm Trees (optional) ──
    if (this.options.palmTrees.value) {
      if (!this._trees) this._initTrees(w, h);
      ctx.save();
      for (const tree of this._trees) {
        const baseY = sandTop + 5;
        const sway = Math.sin(t * 0.8 + tree.phase) * 8 * (0.5 + bass * 0.5);
        const topX = tree.x + tree.lean * tree.trunkH + sway;
        const topY = baseY - tree.trunkH;

        // Trunk
        ctx.strokeStyle = 'rgba(60, 40, 20, 0.85)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tree.x, baseY);
        ctx.quadraticCurveTo(
          tree.x + tree.lean * tree.trunkH * 0.5 + sway * 0.3,
          baseY - tree.trunkH * 0.55,
          topX,
          topY
        );
        ctx.stroke();

        // Thinner inner trunk highlight
        ctx.strokeStyle = 'rgba(90, 65, 35, 0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(tree.x, baseY);
        ctx.quadraticCurveTo(
          tree.x + tree.lean * tree.trunkH * 0.5 + sway * 0.3,
          baseY - tree.trunkH * 0.55,
          topX,
          topY
        );
        ctx.stroke();

        // Fronds
        for (let f = 0; f < tree.fronds; f++) {
          const angle = (f / tree.fronds) * Math.PI * 1.6 - Math.PI * 0.3;
          const frondSway = Math.sin(t * 1.2 + tree.phase + f * 0.9) * 12 * (0.4 + bass * 0.6);
          const fx = topX + Math.cos(angle) * tree.frondLen + frondSway;
          const fy = topY + Math.sin(angle) * tree.frondLen * 0.5 + Math.abs(Math.cos(angle)) * 20;
          const cpx = topX + Math.cos(angle) * tree.frondLen * 0.4 + frondSway * 0.3;
          const cpy = topY + Math.sin(angle) * tree.frondLen * 0.15 - 10;

          ctx.strokeStyle = `rgba(30, ${Math.floor(80 + energy * 40)}, 25, 0.8)`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(cpx, cpy, fx, fy);
          ctx.stroke();

          // Leaf fill
          ctx.fillStyle = `rgba(25, ${Math.floor(90 + energy * 40)}, 30, 0.35)`;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(cpx - 5, cpy - 8, fx, fy);
          ctx.quadraticCurveTo(cpx + 5, cpy + 8, topX, topY);
          ctx.fill();
        }

        // Coconuts
        ctx.fillStyle = 'rgba(80, 50, 20, 0.7)';
        for (let c = 0; c < 3; c++) {
          const cx = topX + Math.cos(c * 2.1 + 0.5) * 6;
          const cy = topY + 4 + Math.sin(c * 2.1 + 0.5) * 4;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  },
};
