/* ═══════════════════════════════════════════
   Visualizer: Frequency Bars
   Classic recording studio / equalizer look
   ═══════════════════════════════════════════ */

window.VisualizerBars = {
  name: 'bars',

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barCount = 96;
    const gap = 2;
    const totalGap = gap * (barCount - 1);
    const barWidth = (canvas.width - totalGap) / barCount;
    const maxHeight = canvas.height * 0.85;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      // Average a few frequency bins per bar for smoother look
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
      }
      const value = sum / step / 255;
      const height = value * maxHeight;

      const x = i * (barWidth + gap);
      const y = canvas.height - height;

      // Gradient from green (low) to yellow (mid) to magenta (high)
      const hue = 140 - (i / barCount) * 200; // green → magenta
      const saturation = 80 + value * 20;
      const lightness = 40 + value * 25;

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      ctx.fillRect(x, y, barWidth, height);

      // Peak cap (bright white line at top)
      if (height > 2) {
        ctx.fillStyle = `hsla(${hue}, 90%, 80%, 0.9)`;
        ctx.fillRect(x, y - 2, barWidth, 2);
      }
    }

    // Reflection (subtle mirror below)
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.scale(1, -1);
    ctx.translate(0, -canvas.height * 2);
    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
      }
      const value = sum / step / 255;
      const height = value * maxHeight * 0.3;
      const x = i * (barWidth + gap);
      const y = canvas.height - height;
      const hue = 140 - (i / barCount) * 200;
      ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
      ctx.fillRect(x, y, barWidth, height);
    }
    ctx.restore();
  }
};
