/* ═══════════════════════════════════════════
   Visualizer: Fireworks
   Fireworks burst around the screen in sync
   with the music. Bass triggers launches,
   energy controls burst size and color.
   ═══════════════════════════════════════════ */

window.VisualizerFireworks = {
  name: 'fireworks',

  _rockets: [],
  _particles: [],
  _sparks: [],
  _lastBass: 0,
  _cooldown: 0,

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteFrequencyData(dataArray);

    const w = canvas.width;
    const h = canvas.height;
    const t = performance.now() * 0.001;
    const dt = 1 / 60; // approximate frame time

    // ── Audio analysis ──
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
    const energy = sum / (bufferLength * 255);

    const bassEnd = Math.floor(bufferLength * 0.08);
    let bassSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += dataArray[i];
    const bass = bassSum / (bassEnd * 255);

    const midStart = Math.floor(bufferLength * 0.15);
    const midEnd = Math.floor(bufferLength * 0.5);
    let midSum = 0;
    for (let i = midStart; i < midEnd; i++) midSum += dataArray[i];
    const mids = midSum / ((midEnd - midStart) * 255);

    const highStart = Math.floor(bufferLength * 0.5);
    let highSum = 0;
    for (let i = highStart; i < bufferLength; i++) highSum += dataArray[i];
    const highs = highSum / ((bufferLength - highStart) * 255);

    // ── Dark sky with subtle gradient ──
    ctx.fillStyle = `rgba(0, 0, ${Math.floor(8 + energy * 10)}, ${0.25 + (1 - energy) * 0.15})`;
    ctx.fillRect(0, 0, w, h);

    // ── Launch rockets on bass hits ──
    this._cooldown = Math.max(0, this._cooldown - dt);
    const bassRising = bass > this._lastBass + 0.05 && bass > 0.25;
    this._lastBass = bass;

    if (bassRising && this._cooldown <= 0 && this._rockets.length < 15) {
      const count = 1 + Math.floor(bass * 3);
      for (let i = 0; i < count; i++) {
        this._rockets.push({
          x: w * (0.1 + Math.random() * 0.8),
          y: h,
          vx: (Math.random() - 0.5) * 40,
          vy: -(h * 0.4 + Math.random() * h * 0.35),
          targetY: h * (0.1 + Math.random() * 0.35),
          hue: Math.random() * 360,
          trail: [],
          age: 0,
        });
      }
      this._cooldown = 0.08;
    }

    // Also launch on sustained energy even without sharp bass
    if (energy > 0.4 && Math.random() < energy * 0.04 && this._rockets.length < 10) {
      this._rockets.push({
        x: w * (0.15 + Math.random() * 0.7),
        y: h,
        vx: (Math.random() - 0.5) * 30,
        vy: -(h * 0.35 + Math.random() * h * 0.3),
        targetY: h * (0.1 + Math.random() * 0.4),
        hue: Math.random() * 360,
        trail: [],
        age: 0,
      });
    }

    // ── Update & draw rockets ──
    for (let i = this._rockets.length - 1; i >= 0; i--) {
      const r = this._rockets[i];
      r.age += dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.vy *= 0.98;

      // Rocket trail
      r.trail.push({ x: r.x, y: r.y, age: 0 });
      if (r.trail.length > 12) r.trail.shift();

      // Draw trail
      ctx.save();
      for (let j = 0; j < r.trail.length; j++) {
        const tp = r.trail[j];
        tp.age += dt;
        const ta = 1 - j / r.trail.length;
        ctx.globalAlpha = ta * 0.7;
        ctx.fillStyle = `hsl(${r.hue}, 80%, ${60 + ta * 30}%)`;
        ctx.fillRect(tp.x - 1, tp.y - 1, 3, 3);
      }
      ctx.restore();

      // Draw rocket head
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = `hsl(${r.hue}, 90%, 85%)`;
      ctx.fillRect(r.x - 2, r.y - 2, 4, 4);
      ctx.restore();

      // Explode when reaching target height
      if (r.y <= r.targetY || r.age > 1.5) {
        this._explode(r, w, h, energy, mids);
        this._rockets.splice(i, 1);
      }
    }

    // ── Update & draw particles ──
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; // gravity
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.alpha = Math.max(0, 1 - p.age / p.life);

      if (p.alpha <= 0) {
        this._particles.splice(i, 1);
        continue;
      }

      // Sparkle on highs
      const sparkle = highs > 0.2 ? (Math.sin(t * 20 + i) * 0.3 + 0.7) : 1;

      ctx.save();
      ctx.globalAlpha = p.alpha * sparkle;
      const lum = 50 + p.alpha * 40;
      ctx.fillStyle = `hsl(${p.hue}, ${p.sat}%, ${lum}%)`;

      if (p.type === 'ring') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'star') {
        this._drawStar(ctx, p.x, p.y, p.size);
      } else {
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
      }
      ctx.restore();

      // Trailing glow
      if (p.alpha > 0.3 && p.size > 2) {
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.15;
        ctx.fillStyle = `hsl(${p.hue}, 60%, 70%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Ground sparks / embers ──
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const s = this._sparks[i];
      s.age += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 30 * dt;
      s.alpha = Math.max(0, 1 - s.age / s.life);

      if (s.alpha <= 0) {
        this._sparks.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = s.alpha * 0.8;
      ctx.fillStyle = `hsl(${s.hue}, 90%, ${60 + s.alpha * 30}%)`;
      ctx.fillRect(s.x, s.y, 1.5, 1.5);
      ctx.restore();
    }

    // ── Flash on large explosions ──
    if (bass > 0.6 && this._particles.length > 50) {
      ctx.save();
      ctx.globalAlpha = (bass - 0.6) * 0.15;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Cap particle counts
    if (this._particles.length > 800) {
      this._particles.splice(0, this._particles.length - 800);
    }
    if (this._sparks.length > 300) {
      this._sparks.splice(0, this._sparks.length - 300);
    }
  },

  _explode(rocket, w, h, energy, mids) {
    const cx = rocket.x;
    const cy = rocket.y;
    const hue = rocket.hue;
    const burstSize = 80 + energy * 200 + mids * 100;
    const count = 40 + Math.floor(energy * 80);

    // Choose burst pattern
    const pattern = Math.random();

    if (pattern < 0.3) {
      // Ring burst
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
        const speed = burstSize * (0.8 + Math.random() * 0.4);
        this._particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          hue: hue + (Math.random() - 0.5) * 30,
          sat: 70 + Math.random() * 30,
          size: 2 + Math.random() * 3,
          alpha: 1,
          life: 1.0 + Math.random() * 0.8,
          age: 0,
          type: 'ring',
        });
      }
    } else if (pattern < 0.55) {
      // Star / scatter burst
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = burstSize * Math.random();
        this._particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          hue: hue + (Math.random() - 0.5) * 60,
          sat: 60 + Math.random() * 40,
          size: 1.5 + Math.random() * 3,
          alpha: 1,
          life: 0.8 + Math.random() * 1.0,
          age: 0,
          type: 'star',
        });
      }
    } else if (pattern < 0.75) {
      // Chrysanthemum — dense streaks
      for (let i = 0; i < count * 1.5; i++) {
        const angle = (i / (count * 1.5)) * Math.PI * 2;
        const speed = burstSize * (0.5 + Math.random() * 0.7);
        this._particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          hue: hue + i * 0.5,
          sat: 80 + Math.random() * 20,
          size: 1 + Math.random() * 2,
          alpha: 1,
          life: 1.2 + Math.random() * 0.6,
          age: 0,
          type: 'default',
        });
      }
    } else {
      // Multi-color burst
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = burstSize * (0.3 + Math.random() * 0.7);
        this._particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          hue: (hue + Math.random() * 180) % 360,
          sat: 70 + Math.random() * 30,
          size: 2 + Math.random() * 2.5,
          alpha: 1,
          life: 0.9 + Math.random() * 0.9,
          age: 0,
          type: Math.random() < 0.5 ? 'ring' : 'star',
        });
      }
    }

    // Secondary sparks / embers falling
    const sparkCount = 15 + Math.floor(energy * 30);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = burstSize * 0.3 * Math.random();
      this._sparks.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        hue: hue + (Math.random() - 0.5) * 40,
        alpha: 1,
        life: 1.5 + Math.random() * 1.5,
        age: 0,
      });
    }
  },

  _drawStar(ctx, x, y, size) {
    const spikes = 4;
    const outerR = size;
    const innerR = size * 0.4;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  },
};
