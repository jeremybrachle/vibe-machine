/* ═══════════════════════════════════════════
   Visualizer: Particles
   Audio-reactive particle system
   ═══════════════════════════════════════════ */

window.VisualizerParticles = {
  name: 'particles',
  particles: [],
  maxParticles: 400,

  spawnParticle(canvas, energy, bassEnergy, trebleEnergy) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + energy * 6;
    const hue = bassEnergy > 0.6 ? 320 + Math.random() * 40 :
                trebleEnergy > 0.5 ? 160 + Math.random() * 40 :
                Math.random() * 360;

    return {
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.005 + Math.random() * 0.015,
      size: 2 + energy * 6 + Math.random() * 3,
      hue: hue,
      saturation: 70 + Math.random() * 30,
    };
  },

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteFrequencyData(dataArray);

    // Semi-transparent clear for trails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate energy bands
    const bassEnd = Math.floor(bufferLength * 0.1);
    const midEnd = Math.floor(bufferLength * 0.5);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    for (let i = 0; i < bassEnd; i++) bassSum += dataArray[i];
    for (let i = bassEnd; i < midEnd; i++) midSum += dataArray[i];
    for (let i = midEnd; i < bufferLength; i++) trebleSum += dataArray[i];

    const bassEnergy = bassSum / (bassEnd * 255);
    const midEnergy = midSum / ((midEnd - bassEnd) * 255);
    const trebleEnergy = trebleSum / ((bufferLength - midEnd) * 255);
    const totalEnergy = (bassEnergy + midEnergy + trebleEnergy) / 3;

    // Spawn particles based on energy
    const spawnCount = Math.floor(totalEnergy * 12);
    for (let i = 0; i < spawnCount && this.particles.length < this.maxParticles; i++) {
      this.particles.push(this.spawnParticle(canvas, totalEnergy, bassEnergy, trebleEnergy));
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.life -= p.decay;
      p.size *= 0.998;

      // Remove dead particles
      if (p.life <= 0 || p.size < 0.5) {
        this.particles.splice(i, 1);
        continue;
      }

      // Draw
      const alpha = p.life * 0.8;
      const lightness = 50 + (1 - p.life) * 20;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = p.size * 2;
      ctx.shadowColor = `hsl(${p.hue}, ${p.saturation}%, ${lightness}%)`;
      ctx.fillStyle = `hsl(${p.hue}, ${p.saturation}%, ${lightness}%)`;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Connection lines between nearby particles
    ctx.save();
    ctx.lineWidth = 0.5;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 80) {
          const alpha = (1 - dist / 80) * 0.15 * a.life * b.life;
          ctx.strokeStyle = `hsla(${(a.hue + b.hue) / 2}, 70%, 60%, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // Center energy bloom
    if (totalEnergy > 0.3) {
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, 100 + totalEnergy * 200
      );
      gradient.addColorStop(0, `hsla(${bassEnergy > midEnergy ? 320 : 160}, 80%, 50%, ${totalEnergy * 0.08})`);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
};
