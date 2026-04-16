/* ═══════════════════════════════════════════
   Visualizer: Synthwave
   Neon cyber landscape — moving on rails
   through a retro-futuristic grid world.
   Audio-reactive flashing, grid pulse, and
   neon glow synced to the music.

   Options:
     palmTrees  — neon palm tree silhouettes
     clouds     — glowing cyber clouds
   ═══════════════════════════════════════════ */

window.VisualizerSynthwave = {
  name: 'synthwave',
  options: {
    palmTrees: { label: 'Palm Trees', value: false },
    clouds:    { label: 'Clouds',     value: false },
  },

  _trees: null,
  _cloudList: null,
  _stars: null,

  _initTrees() {
    this._trees = [];
    for (let i = 0; i < 8; i++) {
      this._trees.push({
        side: i % 2 === 0 ? -1 : 1,
        z: 0.15 + (i / 8) * 0.7,
        trunkH: 0.15 + Math.random() * 0.08,
        lean: (Math.random() - 0.3) * 0.2,
        fronds: 5 + Math.floor(Math.random() * 3),
        frondLen: 0.06 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
      });
    }
  },

  _initClouds() {
    this._cloudList = [];
    for (let i = 0; i < 5; i++) {
      this._cloudList.push({
        x: Math.random(),
        y: 0.05 + Math.random() * 0.2,
        w: 0.1 + Math.random() * 0.15,
        h: 0.02 + Math.random() * 0.02,
        speed: 0.005 + Math.random() * 0.01,
        hue: Math.random() < 0.5 ? 300 : 180,
      });
    }
  },

  _initStars(count) {
    this._stars = [];
    for (let i = 0; i < count; i++) {
      this._stars.push({
        x: Math.random(),
        y: Math.random() * 0.45,
        size: 0.5 + Math.random() * 1.5,
        twinkle: Math.random() * Math.PI * 2,
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

    const highStart = Math.floor(bufferLength * 0.5);
    let highSum = 0;
    for (let i = highStart; i < bufferLength; i++) highSum += dataArray[i];
    const highs = highSum / ((bufferLength - highStart) * 255);

    // ── Layout ──
    const horizon = h * 0.48;
    const vp = { x: w * 0.5, y: horizon }; // vanishing point

    // ── Sky — dark gradient with neon glow ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
    skyGrad.addColorStop(0, `rgba(5, 2, ${Math.floor(20 + energy * 15)}, 1)`);
    skyGrad.addColorStop(0.6, `rgba(${Math.floor(15 + bass * 30)}, 2, ${Math.floor(40 + energy * 20)}, 1)`);
    skyGrad.addColorStop(1, `rgba(${Math.floor(40 + bass * 60)}, 5, ${Math.floor(60 + energy * 30)}, 1)`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizon + 1);

    // ── Stars ──
    if (!this._stars) this._initStars(80);
    ctx.save();
    for (const s of this._stars) {
      const twinkle = Math.sin(t * 2.5 + s.twinkle) * 0.4 + 0.6;
      ctx.globalAlpha = twinkle * (0.4 + highs * 0.4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x * w, s.y * h, s.size, s.size);
    }
    ctx.restore();

    // ── Neon sun (horizon) ──
    const sunY = horizon - 5;
    const sunR = 60 + bass * 20;

    // Sun glow
    const sunGlow = ctx.createRadialGradient(vp.x, sunY, sunR * 0.2, vp.x, sunY, sunR * 3);
    sunGlow.addColorStop(0, `rgba(255, 50, 200, ${0.5 + bass * 0.3})`);
    sunGlow.addColorStop(0.3, `rgba(255, 30, 120, ${0.2 + bass * 0.15})`);
    sunGlow.addColorStop(1, 'rgba(255, 20, 80, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, w, horizon + sunR * 2);

    // Sun body — striped
    ctx.save();
    ctx.beginPath();
    ctx.arc(vp.x, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();
    const sunBodyGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunBodyGrad.addColorStop(0, '#ff2080');
    sunBodyGrad.addColorStop(0.5, '#ff8020');
    sunBodyGrad.addColorStop(1, '#ffe040');
    ctx.fillStyle = sunBodyGrad;
    ctx.fillRect(vp.x - sunR, sunY - sunR, sunR * 2, sunR * 2);
    // Horizontal stripes cut through
    ctx.fillStyle = `rgba(5, 2, 20, ${0.7 - bass * 0.2})`;
    for (let s = 0; s < 6; s++) {
      const sy = sunY + sunR * 0.1 + s * (sunR * 0.15);
      const sh = 2 + s * 1.5;
      ctx.fillRect(vp.x - sunR, sy, sunR * 2, sh);
    }
    ctx.restore();

    // ── Clouds (optional) ──
    if (this.options.clouds.value) {
      if (!this._cloudList) this._initClouds();
      ctx.save();
      for (const c of this._cloudList) {
        const cx = ((c.x + c.speed * t) % 1.4) - 0.2;
        ctx.globalAlpha = 0.25 + energy * 0.2;
        ctx.shadowColor = c.hue === 300 ? '#ff40ff' : '#40ffff';
        ctx.shadowBlur = 20 + bass * 15;
        ctx.fillStyle = c.hue === 300
          ? `rgba(180, 40, 200, ${0.3 + energy * 0.15})`
          : `rgba(40, 180, 220, ${0.3 + energy * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(cx * w, c.y * h, c.w * w * 0.5, c.h * h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx * w + c.w * w * 0.2, c.y * h - c.h * h * 0.5, c.w * w * 0.3, c.h * h * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Ground — perspective grid ──
    const groundGrad = ctx.createLinearGradient(0, horizon, 0, h);
    groundGrad.addColorStop(0, `rgba(${Math.floor(10 + bass * 20)}, 0, ${Math.floor(30 + bass * 20)}, 1)`);
    groundGrad.addColorStop(1, `rgba(2, 0, ${Math.floor(10 + energy * 10)}, 1)`);
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Horizontal grid lines (moving toward viewer — on rails!)
    ctx.save();
    const gridSpeed = t * 0.8;
    const lineCount = 20;
    ctx.strokeStyle = `rgba(${Math.floor(80 + bass * 175)}, 20, ${Math.floor(180 + energy * 75)}, 1)`;

    for (let i = 0; i < lineCount; i++) {
      const rawZ = ((i / lineCount) + (gridSpeed % 1)) % 1;
      const z = rawZ * rawZ; // perspective compression
      const y = horizon + z * (h - horizon);
      const lineAlpha = 0.15 + z * 0.4 + bass * 0.3;
      ctx.globalAlpha = Math.min(1, lineAlpha);
      ctx.lineWidth = 0.5 + z * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical grid lines (converging to vanishing point)
    const vLines = 16;
    for (let i = -vLines / 2; i <= vLines / 2; i++) {
      const spread = i / (vLines / 2);
      const baseX = vp.x + spread * w * 1.2;
      const lineAlpha = 0.15 + Math.abs(spread) * 0.15 + energy * 0.2;
      ctx.globalAlpha = Math.min(1, lineAlpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vp.x, horizon);
      ctx.lineTo(baseX, h);
      ctx.stroke();
    }
    ctx.restore();

    // ── Audio-reactive grid flash ──
    if (bass > 0.5) {
      ctx.save();
      ctx.globalAlpha = (bass - 0.5) * 0.6;
      ctx.fillStyle = '#ff20ff';
      ctx.fillRect(0, horizon, w, h - horizon);
      ctx.restore();
    }

    // ── Side buildings / structures (cyber world feel) ──
    ctx.save();
    const buildingCount = 12;
    for (let i = 0; i < buildingCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const zi = 0.05 + (Math.floor(i / 2) / (buildingCount / 2)) * 0.85;
      const perspective = 1 - zi;
      const bw = 20 + perspective * 40;
      const bh = 40 + perspective * 120 + dataArray[i * 8 % bufferLength] * 0.3;
      const bx = side > 0
        ? vp.x + (w * 0.5 + 50) * (1 - perspective * 0.3)
        : vp.x - (w * 0.5 + 50) * (1 - perspective * 0.3) - bw;
      const by = horizon + zi * zi * (h - horizon) - bh;
      const alpha = 0.2 + perspective * 0.4;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(5, 2, 20, 0.9)`;
      ctx.fillRect(bx, by, bw, bh);

      // Neon outline on bass
      ctx.strokeStyle = i % 3 === 0
        ? `rgba(0, 255, 255, ${0.3 + bass * 0.5})`
        : i % 3 === 1
        ? `rgba(255, 0, 200, ${0.3 + bass * 0.5})`
        : `rgba(180, 0, 255, ${0.3 + bass * 0.5})`;
      ctx.lineWidth = 1 + bass * 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Window lights
      const wSize = 3;
      const wGap = 8;
      ctx.globalAlpha = alpha * (0.5 + energy * 0.5);
      for (let wy = by + 5; wy < by + bh - 5; wy += wGap) {
        for (let wx = bx + 4; wx < bx + bw - 4; wx += wGap) {
          if (Math.sin(wx * 13.7 + wy * 7.3 + t * 2) > 0.2) {
            ctx.fillStyle = i % 3 === 0 ? '#00ffff' : i % 3 === 1 ? '#ff40ff' : '#b040ff';
            ctx.fillRect(wx, wy, wSize, wSize);
          }
        }
      }
    }
    ctx.restore();

    // ── Neon Palm Trees (optional) ──
    if (this.options.palmTrees.value) {
      if (!this._trees) this._initTrees();
      ctx.save();
      for (const tree of this._trees) {
        const perspective = 1 - tree.z;
        const scale = 0.3 + perspective * 0.7;
        const tx = tree.side > 0
          ? vp.x + (w * 0.35) * (1 - tree.z * 0.5)
          : vp.x - (w * 0.35) * (1 - tree.z * 0.5);
        const baseY = horizon + tree.z * tree.z * (h - horizon);
        const trunkH = tree.trunkH * h * scale;
        const sway = Math.sin(t * 0.8 + tree.phase) * 8 * scale * (0.5 + bass * 0.5);
        const topX = tx + tree.lean * trunkH + sway;
        const topY = baseY - trunkH;

        // Neon glow for trunk
        ctx.shadowColor = '#ff20ff';
        ctx.shadowBlur = 10 + bass * 15;

        // Trunk
        ctx.strokeStyle = `rgba(255, 40, 200, ${0.6 + bass * 0.3})`;
        ctx.lineWidth = (4 + bass * 3) * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, baseY);
        ctx.quadraticCurveTo(
          tx + tree.lean * trunkH * 0.5 + sway * 0.3,
          baseY - trunkH * 0.55,
          topX,
          topY
        );
        ctx.stroke();

        // Fronds with neon glow
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 8 + bass * 12;
        const frondLen = tree.frondLen * h * scale;
        for (let f = 0; f < tree.fronds; f++) {
          const angle = (f / tree.fronds) * Math.PI * 1.6 - Math.PI * 0.3;
          const frondSway = Math.sin(t * 1.2 + tree.phase + f * 0.9) * 10 * scale * (0.4 + bass * 0.6);
          const fx = topX + Math.cos(angle) * frondLen + frondSway;
          const fy = topY + Math.sin(angle) * frondLen * 0.5 + Math.abs(Math.cos(angle)) * 15 * scale;
          const cpx = topX + Math.cos(angle) * frondLen * 0.4 + frondSway * 0.3;
          const cpy = topY + Math.sin(angle) * frondLen * 0.15 - 8 * scale;

          ctx.strokeStyle = `rgba(0, ${Math.floor(200 + energy * 55)}, ${Math.floor(180 + energy * 55)}, ${0.6 + bass * 0.3})`;
          ctx.lineWidth = (2 + bass * 2) * scale;
          ctx.beginPath();
          ctx.moveTo(topX, topY);
          ctx.quadraticCurveTo(cpx, cpy, fx, fy);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Horizon glow line ──
    ctx.save();
    ctx.shadowColor = '#ff40ff';
    ctx.shadowBlur = 15 + bass * 25;
    ctx.strokeStyle = `rgba(255, 50, 255, ${0.5 + bass * 0.4})`;
    ctx.lineWidth = 1.5 + bass * 2;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Scan line overlay (CRT feel) ──
    ctx.save();
    ctx.globalAlpha = 0.04 + energy * 0.03;
    ctx.fillStyle = '#000';
    for (let sy = 0; sy < h; sy += 3) {
      ctx.fillRect(0, sy, w, 1);
    }
    ctx.restore();

    // ── Flash on big bass hits ──
    if (bass > 0.65) {
      ctx.save();
      ctx.globalAlpha = (bass - 0.65) * 1.2;
      ctx.fillStyle = energy > 0.5 ? 'rgba(255, 0, 255, 0.08)' : 'rgba(0, 255, 255, 0.08)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  },
};
