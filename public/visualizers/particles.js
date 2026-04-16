/* ═══════════════════════════════════════════
   Visualizer: Particles
   Audio-reactive particle system
   ═══════════════════════════════════════════ */

window.VisualizerParticles = {
  name: 'particles',
  particles: [],
  maxParticles: 250,

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

    // Update and draw particles (swap-and-pop for fast removal)
    let len = this.particles.length;
    for (let i = len - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.life -= p.decay;
      p.size *= 0.998;

      // Remove dead particles (swap with last, pop)
      if (p.life <= 0 || p.size < 0.5) {
        this.particles[i] = this.particles[len - 1];
        this.particles.pop();
        len--;
        continue;
      }

      // Draw
      const alpha = p.life * 0.8;
      const lightness = 50 + (1 - p.life) * 20;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${p.hue}, ${p.saturation}%, ${lightness}%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

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
