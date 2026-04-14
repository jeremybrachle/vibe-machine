/* ═══════════════════════════════════════════
   Visualizer: Waveform (Oscilloscope)
   Glowing neon line showing the audio signal
   ═══════════════════════════════════════════ */

window.VisualizerWaveform = {
  name: 'waveform',

  draw(ctx, canvas, analyser, dataArray, bufferLength) {
    analyser.getByteTimeDomainData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerY = canvas.height / 2;

    // Dim horizontal center line
    ctx.strokeStyle = 'rgba(0, 200, 120, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    // Glow effect — draw the line multiple times with increasing blur
    const layers = [
      { blur: 20, alpha: 0.15, width: 6 },
      { blur: 10, alpha: 0.3, width: 3 },
      { blur: 0, alpha: 1, width: 1.5 },
    ];

    for (const layer of layers) {
      ctx.save();
      ctx.shadowBlur = layer.blur;
      ctx.shadowColor = '#00c878';
      ctx.globalAlpha = layer.alpha;
      ctx.strokeStyle = '#00c878';
      ctx.lineWidth = layer.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.stroke();
      ctx.restore();
    }

    // Secondary waveform (phase-shifted, different color) for depth
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#b060ff';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#b060ff';
    ctx.beginPath();
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[Math.min(i + 20, bufferLength - 1)] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
    ctx.restore();

    // Subtle grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridLines = 8;
    for (let i = 1; i < gridLines; i++) {
      const gy = (canvas.height / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(canvas.width, gy);
      ctx.stroke();
    }
    ctx.restore();
  }
};
