/* ═══════════════════════════════════════════
   Visualizer: Circular / Radial
   Frequency data mapped around a ring
   ═══════════════════════════════════════════ */

window.VisualizerCircular = {
  name: 'circular',
  rotation: 0,

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRadius = Math.min(cx, cy) * 0.3;
    const maxBarLength = Math.min(cx, cy) * 0.45;

    // Slow rotation
    this.rotation += 0.002;

    // Calculate average energy for inner glow
    let totalEnergy = 0;
    for (let i = 0; i < bufferLength; i++) totalEnergy += dataArray[i];
    const avgEnergy = totalEnergy / bufferLength / 255;

    // Inner glow circle
    const glowRadius = baseRadius * (0.8 + avgEnergy * 0.5);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    gradient.addColorStop(0, `hsla(${280 + avgEnergy * 80}, 80%, 60%, ${0.15 + avgEnergy * 0.15})`);
    gradient.addColorStop(0.5, `hsla(${160 + avgEnergy * 60}, 70%, 40%, ${0.05 + avgEnergy * 0.05})`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Frequency bars around the circle
    const barCount = 180;
    const step = Math.floor(bufferLength / barCount);
    const angleStep = (Math.PI * 2) / barCount;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
      }
      const value = sum / step / 255;
      const barLength = value * maxBarLength;
      const angle = i * angleStep;

      const hue = (i / barCount) * 360;
      const lightness = 45 + value * 30;

      ctx.save();
      ctx.rotate(angle);

      // Outer bar
      ctx.strokeStyle = `hsla(${hue}, 85%, ${lightness}%, ${0.6 + value * 0.4})`;
      ctx.lineWidth = Math.max(1.5, (Math.PI * 2 * baseRadius) / barCount - 1);
      ctx.shadowBlur = value * 15;
      ctx.shadowColor = `hsl(${hue}, 85%, ${lightness}%)`;

      ctx.beginPath();
      ctx.moveTo(0, -baseRadius);
      ctx.lineTo(0, -(baseRadius + barLength));
      ctx.stroke();

      // Mirror bar inward (smaller)
      if (barLength > 5) {
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(0, -baseRadius);
        ctx.lineTo(0, -(baseRadius - barLength * 0.3));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    ctx.restore();

    // Inner ring
    ctx.strokeStyle = `hsla(160, 60%, 50%, ${0.2 + avgEnergy * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Outer boundary ring (pulses with energy)
    ctx.strokeStyle = `hsla(280, 60%, 50%, ${0.05 + avgEnergy * 0.1})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius + maxBarLength * avgEnergy, 0, Math.PI * 2);
    ctx.stroke();
  }
};
