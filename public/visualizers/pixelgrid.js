/* ═══════════════════════════════════════════
   Visualizer: Pixel Grid
   Big colorful rounded tiles that react to audio.
   ═══════════════════════════════════════════ */

window.VisualizerPixelgrid = {
  name: 'pixelgrid',

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const cell = 28;
    const gap = 4;
    const step = cell + gap;
    const cols = Math.floor(w / step);
    const rows = Math.floor(h / step);
    const offsetX = (w - cols * step + gap) / 2;
    const offsetY = (h - rows * step + gap) / 2;
    const t = performance.now() * 0.001;
    const r = cell * 0.3; // corner radius

    for (let col = 0; col < cols; col++) {
      const freqIdx = Math.min(
        Math.floor(Math.pow(col / cols, 1.5) * bufferLength * 0.5),
        bufferLength - 1
      );
      const amp = dataArray[freqIdx] / 255;

      for (let row = 0; row < rows; row++) {
        const ri = rows - 1 - row;
        const vertFade = ri / Math.max(1, rows);
        const level = amp * (1 - vertFade * 0.5);
        if (level < 0.04) continue;

        const x = offsetX + col * step;
        const y = offsetY + row * step;

        // Wide hue sweep: warm bottom → cool top, shifting across columns
        const hue = (col * 7 + ri * 12 + t * 15) % 360;
        const sat = 65 + level * 30;
        const lum = 8 + level * 52;
        const pulse = 0.92 + Math.sin(col * 0.7 + ri * 1.1 + t * 2.5) * 0.08;

        ctx.globalAlpha = Math.min(1, level * 1.4) * pulse;
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${lum}%)`;
        ctx.beginPath();
        ctx.roundRect(x, y, cell, cell, r);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1.0;
  },
};
