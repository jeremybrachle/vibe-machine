/* ═══════════════════════════════════════════
   Visualizer: Blank
   Pure black canvas — for minimal vibes
   or just the sun on a dark sky.
   ═══════════════════════════════════════════ */

window.VisualizerBlank = {
  name: 'blank',

  draw(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  },
};
