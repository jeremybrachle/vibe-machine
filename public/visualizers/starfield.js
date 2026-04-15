/* ═══════════════════════════════════════════
   Visualizer: Starfield
   Audio-reactive stars flying toward you
   Pure Windows Media Player nostalgia
   ═══════════════════════════════════════════ */

window.VisualizerStarfield = {
  name: 'starfield',
  stars: [],
  maxStars: 500,
  initialized: false,

  initStars(canvas) {
    this.stars = [];
    for (let i = 0; i < this.maxStars; i++) {
      this.stars.push(this.newStar(canvas));
    }
    this.initialized = true;
  },

  newStar(canvas) {
    return {
      x: (Math.random() - 0.5) * canvas.width * 3,
      y: (Math.random() - 0.5) * canvas.height * 3,
      z: Math.random() * 1500 + 100,
      prevX: 0,
      prevY: 0,
      hue: Math.random() * 360,
    };
  },

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    if (!this.initialized) this.initStars(canvas);

    analyser.getByteFrequencyData(dataArray);

    // Fade with slight trail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Calculate energy
    let totalEnergy = 0;
    let bassEnergy = 0;
    const bassEnd = Math.floor(bufferLength * 0.15);
    for (let i = 0; i < bufferLength; i++) {
      totalEnergy += dataArray[i];
      if (i < bassEnd) bassEnergy += dataArray[i];
    }
    totalEnergy = totalEnergy / (bufferLength * 255);
    bassEnergy = bassEnergy / (bassEnd * 255);

    // Speed scales with audio energy
    const baseSpeed = 2;
    const speed = baseSpeed + totalEnergy * 25;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];

      // Store previous projected position for streak lines
      const prevProjScale = 400 / star.z;
      star.prevX = star.x * prevProjScale + cx;
      star.prevY = star.y * prevProjScale + cy;

      // Move star toward camera
      star.z -= speed;

      // Reset star if it passes the camera
      if (star.z <= 0) {
        Object.assign(star, this.newStar(canvas));
        star.z = 1500;
        continue;
      }

      // Project to 2D
      const projScale = 400 / star.z;
      const sx = star.x * projScale + cx;
      const sy = star.y * projScale + cy;

      // Skip offscreen stars
      if (sx < -50 || sx > canvas.width + 50 || sy < -50 || sy > canvas.height + 50) {
        Object.assign(star, this.newStar(canvas));
        star.z = 1500;
        continue;
      }

      // Star size based on depth
      const size = Math.max(0.5, (1 - star.z / 1500) * 3);
      const alpha = Math.min(1, (1 - star.z / 1500) * 1.5);

      // Color shifts with energy
      const hue = (star.hue + totalEnergy * 120) % 360;
      const saturation = 20 + totalEnergy * 60;
      const lightness = 70 + totalEnergy * 20;

      // Draw streak line
      ctx.save();
      ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha * 0.6})`;
      ctx.lineWidth = size * 0.5;
      ctx.shadowBlur = size * 4;
      ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.beginPath();
      ctx.moveTo(star.prevX, star.prevY);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.restore();

      // Draw star point
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.shadowBlur = size * 6;
      ctx.shadowColor = `hsl(${hue}, 80%, 70%)`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Bass pulse — radial flash from center
    if (bassEnergy > 0.5) {
      const pulseRadius = bassEnergy * Math.min(cx, cy);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius);
      gradient.addColorStop(0, `hsla(${260 + bassEnergy * 60}, 80%, 50%, ${(bassEnergy - 0.5) * 0.15})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
