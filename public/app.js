/* ═══════════════════════════════════════════════
   Vibe Machine — Main Controller
   Reads settings from window.VIBE_CONFIG (config.js)
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  const CFG = window.VIBE_CONFIG || {};

  // ── State ──
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let gainNode = null;
  let audio = null;
  let dataArray = null;
  let bufferLength = 0;
  let isPlaying = false;
  let isShuffled = false;
  let isVibeMode = false;
  let tracks = [];
  let shuffledIndices = [];
  let currentIndex = 0;
  let currentVizIndex = 0;
  let animFrame = null;

  // ── Transition State ──
  let transitionEnabled = (CFG.transitionEnabled === true);
  let transitionDuration = CFG.transitionDuration || 5;
  let transitionAlpha = 1;
  let sunArcMode = CFG.sunArcEnabled === true ? 'sun' : 'off';
  const SUN_ARC_MODES = ['off', 'sun', 'moon', 'disco'];
  const SUN_ARC_ICONS = { off: '☀', sun: '☀', moon: '🌙', disco: '🪩' };
  let lofiGridEnabled = (CFG.lofiGridEnabled === true);
  let ampBarsEnabled = (CFG.ampBarsEnabled === true);
  let mouseFxEnabled = (CFG.mouseFxEnabled === true);
  let sunDragX = null, sunDragY = null;
  let isDraggingSun = false;
  let sunReturning = false;

  // ── Super Vibes (Beat-Reactive Randomizer) ──
  let superVibesEnabled = false;
  const beatDetector = {
    // Energy-based onset detection with adaptive threshold
    energyHistory: [],          // rolling window of frame energies
    historySize: 60,            // ~1 second at 60fps
    threshold: CFG.superVibesThreshold || 1.4,  // energy must be this × average to trigger
    cooldownMs: CFG.superVibesCooldown || 400,   // minimum ms between triggers
    lastBeatTime: 0,
    // Spectral flux for transient detection
    prevSpectrum: null,
    fluxHistory: [],
    fluxHistorySize: 30,
    // Adaptive sensitivity — relaxes threshold if no beats detected for a while
    lastDetectionTime: 0,
    droughtThresholdMs: 4000,   // if no beat for 4s, lower threshold temporarily
    // Sub-band analysis for better musical sensitivity
    bandRanges: {
      low:  [0, 0.08],   // bass: kick drums, bass notes
      mid:  [0.08, 0.4], // mids: snare, vocals, melody
      high: [0.4, 1.0],  // highs: hi-hats, cymbals
    },
    bandHistory: { low: [], mid: [], high: [] },
  };

  function detectBeat() {
    if (!superVibesEnabled || !analyser || !dataArray) return false;
    if (!audioCtx || !isPlaying) return false;

    const now = performance.now();
    if (now - beatDetector.lastBeatTime < beatDetector.cooldownMs) return false;

    // Get frequency data
    analyser.getByteFrequencyData(dataArray);

    const len = bufferLength;
    if (len === 0) return false;

    // Calculate sub-band energies
    const bandEnergies = {};
    for (const [band, [lo, hi]] of Object.entries(beatDetector.bandRanges)) {
      const start = Math.floor(lo * len);
      const end = Math.floor(hi * len);
      let sum = 0;
      for (let i = start; i < end; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      bandEnergies[band] = Math.sqrt(sum / Math.max(1, end - start));
    }

    // Total energy (weighted: bass is most important for beat detection)
    const totalEnergy = bandEnergies.low * 1.5 + bandEnergies.mid * 1.0 + bandEnergies.high * 0.5;

    // Spectral flux: how much the spectrum changed from last frame
    let flux = 0;
    if (beatDetector.prevSpectrum) {
      for (let i = 0; i < len; i++) {
        const diff = dataArray[i] - beatDetector.prevSpectrum[i];
        if (diff > 0) flux += diff; // only positive changes (onsets, not decays)
      }
    }
    beatDetector.prevSpectrum = new Uint8Array(dataArray);

    // Push to histories
    beatDetector.energyHistory.push(totalEnergy);
    if (beatDetector.energyHistory.length > beatDetector.historySize) {
      beatDetector.energyHistory.shift();
    }

    beatDetector.fluxHistory.push(flux);
    if (beatDetector.fluxHistory.length > beatDetector.fluxHistorySize) {
      beatDetector.fluxHistory.shift();
    }

    for (const band of Object.keys(beatDetector.bandRanges)) {
      beatDetector.bandHistory[band].push(bandEnergies[band]);
      if (beatDetector.bandHistory[band].length > beatDetector.historySize) {
        beatDetector.bandHistory[band].shift();
      }
    }

    // Need enough history to compare
    if (beatDetector.energyHistory.length < 10) return false;

    // Calculate averages
    const avgEnergy = beatDetector.energyHistory.reduce((a, b) => a + b, 0) / beatDetector.energyHistory.length;
    const avgFlux = beatDetector.fluxHistory.length > 5
      ? beatDetector.fluxHistory.reduce((a, b) => a + b, 0) / beatDetector.fluxHistory.length
      : 0;

    // Bass-specific average (crucial for 4/4 detection)
    const bassHistory = beatDetector.bandHistory.low;
    const avgBass = bassHistory.reduce((a, b) => a + b, 0) / bassHistory.length;

    // Adaptive threshold: if nothing detected for a while, lower the bar
    let threshold = beatDetector.threshold;
    const timeSinceLastDetection = now - beatDetector.lastDetectionTime;
    if (timeSinceLastDetection > beatDetector.droughtThresholdMs) {
      // Gradually relax threshold for flowing/quiet music
      const droughtFactor = Math.min(0.3, (timeSinceLastDetection - beatDetector.droughtThresholdMs) / 10000);
      threshold = Math.max(1.15, threshold - droughtFactor);
    }

    // Beat detection criteria (any ONE of these triggers a beat):
    // 1. Total energy spike above adaptive threshold
    const energyBeat = totalEnergy > avgEnergy * threshold && avgEnergy > 15;
    // 2. Strong bass hit (most reliable for steady tempo)
    const bassBeat = bandEnergies.low > avgBass * (threshold * 1.1) && avgBass > 20;
    // 3. Large spectral flux (catches transients in flowing music like Claire de Lune)
    const fluxBeat = flux > avgFlux * (threshold * 1.3) && avgFlux > 200;

    if (energyBeat || bassBeat || fluxBeat) {
      beatDetector.lastBeatTime = now;
      beatDetector.lastDetectionTime = now;
      return true;
    }

    return false;
  }

  const visualizers = [
    window.VisualizerBlank,
    window.VisualizerBars,
    window.VisualizerWaveform,
    window.VisualizerCircular,
    window.VisualizerParticles,
    window.VisualizerStarfield,
    window.VisualizerPixelgrid,
    window.VisualizerSunset,
    window.VisualizerStarrynight,
    window.VisualizerPiano,
  ];

  // ── DOM ──
  const canvas = document.getElementById('visualizer');
  const ctx = canvas.getContext('2d');
  const uiOverlay = document.getElementById('ui-overlay');
  const helpOverlay = document.getElementById('help-overlay');
  const trackNameEl = document.getElementById('track-name');
  const trackCategoryEl = document.getElementById('track-category');
  const btnPlay = document.getElementById('btn-play');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnMute = document.getElementById('btn-mute');
  const btnVibe = document.getElementById('btn-vibe');
  const volumeSlider = document.getElementById('volume-slider');
  const progressBar = document.getElementById('progress-bar');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal = document.getElementById('time-total');
  const vizButtons = document.querySelectorAll('.viz-btn[data-mode]');
  const btnTransition = document.getElementById('btn-transition');
  const transitionSlider = document.getElementById('transition-slider');
  const transitionLabel = document.getElementById('transition-label');
  const btnSunArc = document.getElementById('btn-sun-arc');
  const btnLofiGrid = document.getElementById('btn-lofi-grid');
  const btnAmpBars = document.getElementById('btn-amp-bars');
  const btnMouseFx = document.getElementById('btn-mouse-fx');

  // ── Canvas Resize ──
  function resizeCanvas() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // Re-init starfield on resize
    if (window.VisualizerStarfield) {
      window.VisualizerStarfield.initialized = false;
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ── Audio Setup ──
  function initAudio() {
    if (audioCtx) return;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = CFG.fftSize || 2048;
    analyser.smoothingTimeConstant = CFG.smoothing ?? 0.82;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    gainNode = audioCtx.createGain();
    gainNode.gain.value = CFG.defaultVolume ?? parseFloat(volumeSlider.value);

    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.addEventListener('ended', () => nextTrack());
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', () => {
      timeTotal.textContent = formatTime(audio.duration);
    });

    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }

  // ── Track Management ──
  async function loadTracks() {
    try {
      const res = await fetch('/api/tracks');
      tracks = await res.json();
      if (tracks.length === 0) {
        trackNameEl.textContent = CFG.idleText || 'No tracks found';
        updateQueueUI();
        return;
      }
      shuffledIndices = generateShuffleOrder();
      trackNameEl.textContent = `${tracks.length} tracks loaded — press play`;
      updateQueueUI();
      if (CFG.shuffleByDefault) toggleShuffle();
      if (CFG.autoPlay) playTrack();
    } catch (e) {
      trackNameEl.textContent = 'Error loading tracks: ' + e.message;
    }
  }

  function generateShuffleOrder() {
    const indices = Array.from({ length: tracks.length }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }

  function getTrackIndex() {
    return isShuffled ? shuffledIndices[currentIndex] : currentIndex;
  }

  function loadTrack(index) {
    if (!tracks.length) return;
    currentIndex = ((index % tracks.length) + tracks.length) % tracks.length;
    const track = tracks[getTrackIndex()];
    audio.src = track.file;
    trackNameEl.textContent = track.name;
    trackCategoryEl.textContent = track.category;
    progressBar.value = 0;
    timeCurrent.textContent = '0:00';
    timeTotal.textContent = '0:00';
    if (typeof updateQueueUI === 'function') updateQueueUI();
  }

  async function playTrack() {
    initAudio();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    if (!audio.src || audio.src === window.location.href) {
      loadTrack(0);
    }
    await audio.play();
    isPlaying = true;
    btnPlay.textContent = '⏸';
    startVisualization();
    if (typeof updateQueueUI === 'function') updateQueueUI();
  }

  function pauseTrack() {
    audio.pause();
    isPlaying = false;
    btnPlay.textContent = '▶';
    if (typeof updateQueueUI === 'function') updateQueueUI();
  }

  function togglePlay() {
    if (isPlaying) pauseTrack();
    else playTrack();
  }

  function nextTrack() {
    const wasPlaying = isPlaying;
    loadTrack(currentIndex + 1);
    if (wasPlaying) playTrack();
  }

  function prevTrack() {
    // If more than 3 seconds in, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const wasPlaying = isPlaying;
    loadTrack(currentIndex - 1);
    if (wasPlaying) playTrack();
  }

  function toggleShuffle() {
    isShuffled = !isShuffled;
    btnShuffle.classList.toggle('active', isShuffled);
    if (isShuffled) {
      shuffledIndices = generateShuffleOrder();
      // Put current track at the start of shuffle
      const currentActual = getTrackIndex();
      const idx = shuffledIndices.indexOf(currentActual);
      if (idx > 0) {
        [shuffledIndices[0], shuffledIndices[idx]] = [shuffledIndices[idx], shuffledIndices[0]];
      }
      currentIndex = 0;
    }
  }

  // ── Progress ──
  function updateProgress() {
    if (!audio || !audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBar.value = pct;
    timeCurrent.textContent = formatTime(audio.currentTime);
  }

  function seekTo(e) {
    if (!audio || !audio.duration) return;
    const pct = parseFloat(e.target.value);
    audio.currentTime = (pct / 100) * audio.duration;
  }

  function formatTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Volume ──
  function setVolume(val) {
    if (gainNode) gainNode.gain.value = val;
    updateMuteIcon(val);
  }

  function toggleMute() {
    if (!gainNode) return;
    if (gainNode.gain.value > 0) {
      gainNode._prevVolume = gainNode.gain.value;
      gainNode.gain.value = 0;
      volumeSlider.value = 0;
    } else {
      gainNode.gain.value = gainNode._prevVolume || 0.7;
      volumeSlider.value = gainNode.gain.value;
    }
    updateMuteIcon(gainNode.gain.value);
  }

  function updateMuteIcon(vol) {
    btnMute.textContent = vol === 0 ? '🔇' : vol < 0.3 ? '🔈' : vol < 0.7 ? '🔉' : '🔊';
  }

  // ── Visualization ──
  const vizOptionsEl = document.getElementById('viz-options');

  function setVisualizer(index) {
    currentVizIndex = ((index % visualizers.length) + visualizers.length) % visualizers.length;
    vizButtons.forEach((btn, i) => btn.classList.toggle('active', i === currentVizIndex));
    // Clear canvas for clean transition
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Show/hide per-visualizer option toggles
    updateVizOptions();
  }

  function setVisualizerByName(name) {
    const idx = visualizers.findIndex(v => v && v.name === name);
    if (idx >= 0) setVisualizer(idx);
  }

  function updateVizOptions() {
    const viz = visualizers[currentVizIndex];
    if (!viz || !viz.options || Object.keys(viz.options).length === 0) {
      vizOptionsEl.classList.add('hidden');
      vizOptionsEl.innerHTML = '';
      return;
    }
    vizOptionsEl.classList.remove('hidden');
    vizOptionsEl.innerHTML = '';
    for (const [key, opt] of Object.entries(viz.options)) {
      const btn = document.createElement('button');
      btn.className = 'viz-opt-btn' + (opt.value ? ' active' : '');
      btn.textContent = opt.label;
      btn.title = 'Toggle ' + opt.label;
      btn.addEventListener('click', () => {
        opt.value = !opt.value;
        btn.classList.toggle('active', opt.value);
      });
      vizOptionsEl.appendChild(btn);
    }
  }

  function cycleVisualizer() {
    setVisualizer(currentVizIndex + 1);
  }

  function startVisualization() {
    if (animFrame) return;
    renderFrame();
  }

  function renderFrame() {
    animFrame = requestAnimationFrame(renderFrame);

    // Reset transform before each frame
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    const viz = visualizers[currentVizIndex];
    const drawCanvas = { width: window.innerWidth, height: window.innerHeight };
    if (viz && analyser && dataArray) {
      viz.draw(ctx, drawCanvas, analyser, dataArray, bufferLength);
    }

    // Apply pixel-edge post-process to the main canvas
    if (lofiGridEnabled) {
      pixelateCanvas();
    }

    // Update and render transition + mouse particles
    updateTransitionAlpha();
    renderMouseFx();

    // Super Vibes: check for beats and trigger shuffles
    if (superVibesEnabled && detectBeat()) {
      superVibesBeatShuffle();
    }
  }

  // ── Pixel Edge Post-Process ──
  const pxPostCanvas = document.createElement('canvas');
  const pxPostCtx = pxPostCanvas.getContext('2d');

  function pixelateCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cell = 8;
    const gap = 2;
    const step = cell + gap;
    const smallW = Math.ceil(w / step);
    const smallH = Math.ceil(h / step);

    if (pxPostCanvas.width !== smallW || pxPostCanvas.height !== smallH) {
      pxPostCanvas.width = smallW;
      pxPostCanvas.height = smallH;
    }

    // Downscale
    pxPostCtx.clearRect(0, 0, smallW, smallH);
    pxPostCtx.drawImage(canvas, 0, 0, smallW, smallH);
    const imgData = pxPostCtx.getImageData(0, 0, smallW, smallH);
    const d = imgData.data;

    // Clear and redraw as pixel grid
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    for (let y = 0; y < smallH; y++) {
      for (let x = 0; x < smallW; x++) {
        const i = (y * smallW + x) * 4;
        if (d[i + 3] < 10) continue;
        ctx.fillStyle = `rgb(${d[i]},${d[i+1]},${d[i+2]})`;
        ctx.globalAlpha = d[i + 3] / 255;
        ctx.fillRect(x * step, y * step, cell, cell);
      }
    }

    ctx.globalAlpha = 1;
  }

  // ── Vibe Mode ──
  const vibeToggle = document.getElementById('vibe-toggle');
  const topRightButtons = document.getElementById('top-right-buttons');
  const transitionPanel = document.getElementById('transition-controls');
  let vibeButtonTimer = null;

  function toggleVibeMode() {
    isVibeMode = !isVibeMode;
    uiOverlay.classList.toggle('hidden', isVibeMode);
    document.body.classList.toggle('vibe-mode', isVibeMode);

    if (isVibeMode) {
      // Hide queue panel + transition controls in vibe mode
      queuePanel.classList.add('queue-hidden');
      transitionPanel.classList.add('tx-hidden');
      // Show button briefly, then fade it out after 1 second
      topRightButtons.classList.remove('vibe-hidden');
      topRightButtons.classList.add('vibe-active');
      clearTimeout(vibeButtonTimer);
      vibeButtonTimer = setTimeout(() => {
        topRightButtons.classList.add('vibe-hidden');
      }, 1000);
    } else {
      // Restore everything
      queuePanel.classList.remove('queue-hidden');
      transitionPanel.classList.remove('tx-hidden');
      clearTimeout(vibeButtonTimer);
      topRightButtons.classList.remove('vibe-active', 'vibe-hidden');
    }
  }

  function toggleTransition() {
    transitionEnabled = !transitionEnabled;
    btnTransition.classList.toggle('active', transitionEnabled);
  }

  function toggleSunArc() {
    const idx = SUN_ARC_MODES.indexOf(sunArcMode);
    sunArcMode = SUN_ARC_MODES[(idx + 1) % SUN_ARC_MODES.length];
    btnSunArc.classList.toggle('active', sunArcMode !== 'off');
    btnSunArc.textContent = SUN_ARC_ICONS[sunArcMode] || '☀';
  }

  function toggleLofiGrid() {
    lofiGridEnabled = !lofiGridEnabled;
    btnLofiGrid.classList.toggle('active', lofiGridEnabled);
    if (!lofiGridEnabled) {
      // Full clear to remove gray pixel remnants
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
  }

  function toggleAmpBars() {
    ampBarsEnabled = !ampBarsEnabled;
    btnAmpBars.classList.toggle('active', ampBarsEnabled);
  }

  function toggleMouseFx() {
    mouseFxEnabled = !mouseFxEnabled;
    btnMouseFx.classList.toggle('active', mouseFxEnabled);
  }

  // ── Super Vibes Toggle ──
  const btnSuperVibes = document.getElementById('btn-super-vibes');

  function toggleSuperVibes() {
    superVibesEnabled = !superVibesEnabled;
    btnSuperVibes.classList.toggle('active', superVibesEnabled);
    // Reset beat detector state on toggle
    beatDetector.energyHistory.length = 0;
    beatDetector.fluxHistory.length = 0;
    beatDetector.prevSpectrum = null;
    beatDetector.lastBeatTime = 0;
    beatDetector.lastDetectionTime = performance.now();
    for (const band of Object.keys(beatDetector.bandHistory)) {
      beatDetector.bandHistory[band].length = 0;
    }
  }

  function superVibesBeatShuffle() {
    // Variant of shuffleSettings that's lighter — randomize a subset each beat
    // to avoid overwhelming visual chaos
    const actions = [
      () => {
        // Switch visualizer (skip blank)
        const vizIdx = 1 + Math.floor(Math.random() * (visualizers.length - 1));
        setVisualizer(vizIdx);
      },
      () => {
        // Toggle a random effect
        const effects = [
          () => { transitionEnabled = !transitionEnabled; btnTransition.classList.toggle('active', transitionEnabled); },
          () => {
            sunArcMode = SUN_ARC_MODES[Math.floor(Math.random() * SUN_ARC_MODES.length)];
            btnSunArc.classList.toggle('active', sunArcMode !== 'off');
            btnSunArc.textContent = SUN_ARC_ICONS[sunArcMode] || '☀';
          },
          () => { lofiGridEnabled = !lofiGridEnabled; btnLofiGrid.classList.toggle('active', lofiGridEnabled); },
          () => { ampBarsEnabled = !ampBarsEnabled; btnAmpBars.classList.toggle('active', ampBarsEnabled); },
          () => { mouseFxEnabled = !mouseFxEnabled; btnMouseFx.classList.toggle('active', mouseFxEnabled); },
        ];
        effects[Math.floor(Math.random() * effects.length)]();
      },
    ];

    // 40% chance to switch visualizer, 60% chance to toggle an effect
    // This keeps it interesting without changing the whole scene every beat
    if (Math.random() < 0.4) {
      actions[0]();
    } else {
      actions[1]();
    }

    // Brief flash on the fountain button for visual feedback
    btnSuperVibes.classList.add('beat-flash');
    setTimeout(() => btnSuperVibes.classList.remove('beat-flash'), 120);
  }

  // ── Shuffle Randomizer ──
  function shuffleSettings() {
    // Random visualizer (skip blank at index 0)
    const vizIdx = 1 + Math.floor(Math.random() * (visualizers.length - 1));
    setVisualizer(vizIdx);

    // Random toggles for each effect
    const randBool = () => Math.random() < 0.5;

    transitionEnabled = randBool();
    btnTransition.classList.toggle('active', transitionEnabled);

    sunArcMode = SUN_ARC_MODES[Math.floor(Math.random() * SUN_ARC_MODES.length)];
    btnSunArc.classList.toggle('active', sunArcMode !== 'off');
    btnSunArc.textContent = SUN_ARC_ICONS[sunArcMode] || '☀';

    lofiGridEnabled = randBool();
    btnLofiGrid.classList.toggle('active', lofiGridEnabled);

    ampBarsEnabled = randBool();
    btnAmpBars.classList.toggle('active', ampBarsEnabled);

    mouseFxEnabled = randBool();
    btnMouseFx.classList.toggle('active', mouseFxEnabled);

    // Full clear for clean slate
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  // ── Clear to Black ──
  function clearToBlack() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    mfxCtx.setTransform(1, 0, 0, 1, 0, 0);
    mfxCtx.clearRect(0, 0, mouseFxCanvas.width, mouseFxCanvas.height);
    mfxCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  // ── Reset to Defaults ──
  function resetDefaults() {
    setVisualizer(0); // Blank
    transitionEnabled = false;
    btnTransition.classList.remove('active');
    transitionAlpha = 0;
    sunArcMode = 'off';
    btnSunArc.classList.remove('active');
    btnSunArc.textContent = '☀';
    lofiGridEnabled = false;
    btnLofiGrid.classList.remove('active');
    ampBarsEnabled = false;
    btnAmpBars.classList.remove('active');
    mouseFxEnabled = false;
    btnMouseFx.classList.remove('active');
    superVibesEnabled = false;
    btnSuperVibes.classList.remove('active');
    mouseParticles.length = 0;
    clearToBlack();
  }

  // ── Help ──
  let helpVisible = false;
  function toggleHelp() {
    helpVisible = !helpVisible;
    helpOverlay.classList.toggle('hidden', !helpVisible);
  }

  // ── Event Listeners ──

  // Buttons
  btnPlay.addEventListener('click', togglePlay);
  btnNext.addEventListener('click', nextTrack);
  btnPrev.addEventListener('click', prevTrack);
  btnShuffle.addEventListener('click', toggleShuffle);
  btnMute.addEventListener('click', toggleMute);
  btnVibe.addEventListener('click', toggleVibeMode);
  btnTransition.addEventListener('click', toggleTransition);
  btnSunArc.addEventListener('click', toggleSunArc);
  btnLofiGrid.addEventListener('click', toggleLofiGrid);
  btnAmpBars.addEventListener('click', toggleAmpBars);
  btnMouseFx.addEventListener('click', toggleMouseFx);
  btnSuperVibes.addEventListener('click', toggleSuperVibes);
  document.getElementById('btn-shuffle-fx').addEventListener('click', shuffleSettings);
  document.getElementById('btn-reset-defaults').addEventListener('click', resetDefaults);
  transitionSlider.addEventListener('input', (e) => {
    transitionDuration = parseFloat(e.target.value);
    transitionLabel.textContent = transitionDuration + 's';
  });
  volumeSlider.addEventListener('input', (e) => setVolume(parseFloat(e.target.value)));
  progressBar.addEventListener('input', seekTo);

  vizButtons.forEach((btn) => {
    btn.addEventListener('click', () => setVisualizerByName(btn.dataset.mode));
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    // Dismiss help on any key
    if (helpVisible && e.key !== '?') {
      toggleHelp();
      return;
    }

    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
      case 'n':
      case 'N':
        nextTrack();
        break;
      case 'ArrowLeft':
      case 'p':
      case 'P':
        prevTrack();
        break;
      case 's':
      case 'S':
        toggleShuffle();
        break;
      case 'v':
      case 'V':
        cycleVisualizer();
        break;
      case 'f':
      case 'F':
      case 'Enter':
        toggleVibeMode();
        break;
      case 'm':
      case 'M':
        toggleMute();
        break;
      case 'ArrowUp':
        e.preventDefault();
        volumeSlider.value = Math.min(1, parseFloat(volumeSlider.value) + 0.05);
        setVolume(parseFloat(volumeSlider.value));
        break;
      case 'ArrowDown':
        e.preventDefault();
        volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 0.05);
        setVolume(parseFloat(volumeSlider.value));
        break;
      case '1': setVisualizer(0); break;
      case '2': setVisualizer(1); break;
      case '3': setVisualizer(2); break;
      case '4': setVisualizer(3); break;
      case '5': setVisualizer(4); break;
      case '6': setVisualizer(5); break;
      case '7': setVisualizer(6); break;
      case '8': setVisualizer(7); break;
      case '9': setVisualizer(8); break;
      case '?':
        toggleHelp();
        break;
      case 'q':
      case 'Q':
        toggleQueueVisible();
        break;
      case 't':
      case 'T':
        toggleTransition();
        break;
      case 'l':
      case 'L':
        toggleLofiGrid();
        break;
      case 'a':
      case 'A':
        toggleAmpBars();
        break;
      case 'r':
      case 'R':
        shuffleSettings();
        break;
      case 'g':
      case 'G':
        toggleSuperVibes();
        break;
      case '0':
        resetDefaults();
        break;
      case 'Escape':
        if (infoOpen) closeInfo();
        else if (isVibeMode) toggleVibeMode();
        break;
      case 'i':
        if (!infoOpen) toggleInfo();
        break;
    }
  });

  // Exit vibe mode on Escape — no fullscreen tracking needed

  // Mouse: in vibe mode, show vibe button when hovering near top-right area
  let mouseTimer = null;
  document.addEventListener('mousemove', (e) => {
    if (!isVibeMode) return;
    document.body.classList.remove('vibe-mode'); // show cursor

    // Show vibe button if mouse is near top-right corner (where it lives)
    const nearTopRight = e.clientX > window.innerWidth - 250 && e.clientY < 80;
    if (nearTopRight) {
      topRightButtons.classList.remove('vibe-hidden');
    } else {
      topRightButtons.classList.add('vibe-hidden');
    }

    clearTimeout(mouseTimer);
    mouseTimer = setTimeout(() => {
      if (isVibeMode) {
        document.body.classList.add('vibe-mode'); // hide cursor
        topRightButtons.classList.add('vibe-hidden');
      }
    }, CFG.vibeMouseTimeout || 2500);
  });

  // ── Mouse Interaction FX ──
  const mouseFxCanvas = document.getElementById('mouse-fx');
  const mfxCtx = mouseFxCanvas.getContext('2d');
  const mouseParticles = [];
  const MAX_MOUSE_PARTICLES = 300;
  let mouseX = 0, mouseY = 0;
  let isMouseDown = false;

  function resizeMouseFxCanvas() {
    mouseFxCanvas.width = window.innerWidth * devicePixelRatio;
    mouseFxCanvas.height = window.innerHeight * devicePixelRatio;
    mouseFxCanvas.style.width = window.innerWidth + 'px';
    mouseFxCanvas.style.height = window.innerHeight + 'px';
    mfxCtx.scale(devicePixelRatio, devicePixelRatio);
  }
  window.addEventListener('resize', resizeMouseFxCanvas);
  resizeMouseFxCanvas();

  // ── Sunrise/Sunset Transition ──
  const txCanvas = document.createElement('canvas');
  const txCtx = txCanvas.getContext('2d');

  function updateTransitionAlpha() {
    if (!transitionEnabled) {
      transitionAlpha = Math.max(0, transitionAlpha - 0.03);
      return;
    }
    if (!audio || !isFinite(audio.duration) || audio.duration === 0 || !isPlaying) {
      return; // hold current alpha (stays dark on startup)
    }
    const timeLeft = audio.duration - audio.currentTime;
    const timeIn = audio.currentTime;
    let target = 0;

    // Sunset: fade to black at end of song
    if (timeLeft < transitionDuration) {
      target = Math.max(target, 1 - (timeLeft / transitionDuration));
    }

    // Sunrise: guaranteed 1s of full black, then fade
    if (timeIn < 1) {
      transitionAlpha = 1;
      return;
    } else if (timeIn < transitionDuration + 1) {
      const fadeProgress = (timeIn - 1) / transitionDuration;
      target = Math.max(target, 1 - fadeProgress);
    }

    transitionAlpha += (target - transitionAlpha) * 0.06;
    if (Math.abs(transitionAlpha - target) < 0.001) transitionAlpha = target;
  }

  function renderTransition() {
    if (transitionAlpha <= 0.005) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // Pure black when fully dark (startup / between songs)
    if (transitionAlpha >= 0.99) {
      mfxCtx.save();
      mfxCtx.globalAlpha = 1;
      mfxCtx.fillStyle = '#000';
      mfxCtx.fillRect(0, 0, w, h);
      mfxCtx.restore();
      return;
    }

    // Smooth fade-from-black: colors emerge gradually
    const fadeIn = Math.min(1, (1 - transitionAlpha) * 4);

    const pxSize = 20;
    const cols = Math.ceil(w / pxSize);
    const rows = Math.ceil(h / pxSize);

    if (txCanvas.width !== cols || txCanvas.height !== rows) {
      txCanvas.width = cols;
      txCanvas.height = rows;
    }

    const t = performance.now() * 0.001;
    const a = transitionAlpha;

    // Sun sits near horizon, sinks below as alpha → 1
    // Anchored to TX_SUN_X/TX_SUN_Y so it matches the arc sun origin
    const sunY = TX_SUN_Y + a * 0.25;
    const sunX = TX_SUN_X + Math.sin(t * 0.15) * 0.05;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const ny = y / rows;
        const nx = x / cols;
        const dx = nx - sunX;
        const dy = (ny - sunY) * 2;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let hue, sat, lum;

        if (ny > sunY + 0.05) {
          // Below horizon — dark earth
          const depth = Math.min(1, (ny - sunY - 0.05) / 0.3);
          hue = 260 + depth * 20;
          sat = 15;
          lum = Math.max(1, 6 * (1 - depth) * (1 - a * 0.7));
        } else {
          // Sky — warm at horizon, cool at top
          const skyH = Math.max(0, (sunY - ny) / sunY);
          hue = 25 + skyH * 240;
          sat = 75 - skyH * 25;
          lum = Math.max(1, (28 - skyH * 20) * (1 - a * 0.85));
        }

        // Sun glow
        if (dist < 0.6) {
          const g = Math.pow(1 - dist / 0.6, 2);
          hue = hue + (40 - hue) * g;
          lum = Math.min(100, lum + g * 55 * (1 - a * 0.5));
          sat = Math.min(100, sat + g * 25);
        }

        // Shimmer
        lum += Math.sin(x * 0.7 + y * 0.5 + t * 1.2) * 1.5;
        lum = Math.max(0, Math.min(100, lum)) * fadeIn;
        sat = Math.max(0, Math.min(100, sat));

        txCtx.fillStyle = `hsl(${hue},${sat}%,${lum}%)`;
        txCtx.fillRect(x, y, 1, 1);
      }
    }

    mfxCtx.save();
    mfxCtx.globalAlpha = Math.min(1, a * 1.8);
    if (lofiGridEnabled) {
      // Batch read all pixels once (avoids per-pixel getImageData)
      const imgData = txCtx.getImageData(0, 0, cols, rows).data;
      for (let py = 0; py < rows; py++) {
        for (let px = 0; px < cols; px++) {
          const i = (py * cols + px) * 4;
          if (imgData[i + 3] < 10) continue;
          mfxCtx.fillStyle = `rgb(${imgData[i]},${imgData[i+1]},${imgData[i+2]})`;
          mfxCtx.fillRect(px * pxSize, py * pxSize, pxSize - 2, pxSize - 2);
        }
      }
    } else {
      mfxCtx.imageSmoothingEnabled = false;
      mfxCtx.drawImage(txCanvas, 0, 0, w, h);
    }
    mfxCtx.restore();
  }

  // ── Persistent Sun Arc (draggable) ──
  const TX_SUN_X = 0.5;
  const TX_SUN_Y = 0.65;

  function getSunArcPos() {
    if (!audio || !isFinite(audio.duration) || audio.duration === 0) return null;
    const progress = audio.currentTime / audio.duration;

    const arcNX = 0.08 + progress * 0.84;
    const norm = 2 * progress - 1;
    const horizon = 0.78;
    const zenith = 0.08;
    const arcNY = horizon - (horizon - zenith) * (1 - norm * norm);

    return { x: arcNX * window.innerWidth, y: arcNY * window.innerHeight };
  }

  function renderSunArc() {
    if (sunArcMode === 'off' || !audio || !isFinite(audio.duration) || audio.duration === 0) return;
    if (!isPlaying && audio.currentTime === 0) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const px = 20;
    const arcPos = getSunArcPos();
    if (!arcPos) return;

    // Determine if we're in the sunset zone
    const timeLeft = audio.duration - audio.currentTime;
    const inSunset = timeLeft < transitionDuration;

    // If player dragged the sun, lerp back during sunset
    let sunPX, sunPY;
    if (sunDragX !== null && !inSunset) {
      sunPX = sunDragX;
      sunPY = sunDragY;
      sunReturning = false;
    } else if (sunDragX !== null && inSunset) {
      // Smoothly return to arc position
      sunReturning = true;
      sunDragX += (arcPos.x - sunDragX) * 0.04;
      sunDragY += (arcPos.y - sunDragY) * 0.04;
      if (Math.abs(sunDragX - arcPos.x) < 2 && Math.abs(sunDragY - arcPos.y) < 2) {
        sunDragX = null;
        sunDragY = null;
      }
      sunPX = sunDragX !== null ? sunDragX : arcPos.x;
      sunPY = sunDragY !== null ? sunDragY : arcPos.y;
    } else {
      sunPX = arcPos.x;
      sunPY = arcPos.y;
    }

    const coreR = 4;
    const glowR = 16;
    const t = performance.now() * 0.001;

    const minCol = Math.max(0, Math.floor((sunPX - glowR * px) / px));
    const maxCol = Math.min(Math.ceil(w / px), Math.ceil((sunPX + glowR * px) / px));
    const minRow = Math.max(0, Math.floor((sunPY - glowR * px) / px));
    const maxRow = Math.min(Math.ceil(h / px), Math.ceil((sunPY + glowR * px) / px));

    mfxCtx.save();

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const bx = col * px;
        const by = row * px;
        const dx = (bx + px / 2 - sunPX) / px;
        const dy = (by + px / 2 - sunPY) / px;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > glowR) continue;

        let hue, sat, lum, alpha;

        if (sunArcMode === 'sun') {
          if (dist <= coreR) {
            const f = dist / coreR;
            hue = 45 - f * 10;
            sat = 95 - f * 15;
            lum = 95 - f * 30;
            alpha = 0.9 - f * 0.15;
          } else {
            const f = (dist - coreR) / (glowR - coreR);
            hue = 35 - f * 15;
            sat = 80 - f * 25;
            lum = 50 * Math.pow(1 - f, 1.5);
            alpha = 0.45 * Math.pow(1 - f, 2);
          }
          lum += Math.sin(col * 0.9 + row * 0.7 + t * 1.5) * 2.5;
          alpha *= 0.92 + Math.sin(col * 0.4 + t * 0.8) * 0.08;

        } else if (sunArcMode === 'moon') {
          // Crescent moon: carve a dark circle offset from the bright disc
          const cutDX = dx - 1.8;
          const cutDY = dy - 0.6;
          const cutDist = Math.sqrt(cutDX * cutDX + cutDY * cutDY);
          const inCut = cutDist < coreR * 0.85;

          if (dist <= coreR && !inCut) {
            const f = dist / coreR;
            hue = 215 + f * 15;
            sat = 15 + f * 10;
            lum = 90 - f * 20;
            alpha = 0.85 - f * 0.1;
          } else if (!inCut) {
            const f = (dist - coreR) / (glowR - coreR);
            hue = 220;
            sat = 20 - f * 10;
            lum = 35 * Math.pow(1 - f, 1.8);
            alpha = 0.3 * Math.pow(1 - f, 2.2);
          } else {
            continue; // skip the cut-out area
          }
          lum += Math.sin(col * 0.5 + row * 0.3 + t * 0.6) * 1.5;
          alpha *= 0.95 + Math.sin(col * 0.3 + t * 0.4) * 0.05;

        } else if (sunArcMode === 'disco') {
          // Disco ball: mirrored facets with rotating color reflections
          if (dist > coreR + 3) {
            // Scattered light rays
            const rayAngle = Math.atan2(dy, dx);
            const rayIdx = Math.floor(((rayAngle + Math.PI) / (Math.PI * 2)) * 12 + t * 2) % 12;
            const rayF = (dist - coreR - 3) / (glowR - coreR - 3);
            if (rayF > 1 || rayF < 0) continue;
            hue = (rayIdx * 30 + t * 60) % 360;
            sat = 80;
            lum = 55 * Math.pow(1 - rayF, 2);
            alpha = 0.35 * Math.pow(1 - rayF, 2) * (0.5 + 0.5 * Math.sin(rayIdx * 1.7 + t * 3));
          } else if (dist <= coreR + 3) {
            // The ball itself: silver with faceted grid
            const facetX = Math.floor((dx + coreR) * 2.5);
            const facetY = Math.floor((dy + coreR) * 2.5);
            const facetPhase = facetX * 3.7 + facetY * 5.3 + t * 4;
            const sparkle = 0.5 + 0.5 * Math.sin(facetPhase);
            hue = (facetX * 40 + facetY * 60 + t * 80) % 360;
            sat = 30 + sparkle * 50;
            lum = 40 + sparkle * 50;
            alpha = 0.8;
          }
          // no shimmer overlay needed, facets already sparkle
        }

        if (alpha < 0.01 || lum < 1) continue;

        mfxCtx.globalAlpha = Math.min(1, alpha);
        mfxCtx.fillStyle = `hsl(${hue},${sat}%,${Math.max(0, Math.min(100, lum))}%)`;
        const pxGap = lofiGridEnabled ? 2 : 1;
        mfxCtx.fillRect(bx, by, px - pxGap, px - pxGap);
      }
    }

    mfxCtx.restore();
  }

  // ── Lofi Pixel Grid ──
  // Always renders the frequency visualization.
  // lofiGridEnabled toggles hard pixel edges vs smooth analog fill.
  function renderLofiGrid() {
    if (!ampBarsEnabled || !analyser || !dataArray) return;

    analyser.getByteFrequencyData(dataArray);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const cell = 10;
    const gap = lofiGridEnabled ? 3 : 0;
    const step = cell + gap;
    const cols = Math.ceil(w / step);
    const rows = Math.ceil(h / step);
    const fillW = lofiGridEnabled ? cell : step;
    const fillH = lofiGridEnabled ? cell : step;
    const t = performance.now() * 0.001;

    mfxCtx.save();

    for (let col = 0; col < cols; col++) {
      const freqIdx = Math.min(
        Math.floor(Math.pow(col / cols, 1.8) * bufferLength * 0.45),
        bufferLength - 1
      );
      const amp = dataArray[freqIdx] / 255;
      const litRows = Math.ceil(amp * rows);

      for (let ri = 0; ri < litRows; ri++) {
        const y = h - (ri + 1) * step;
        if (y < 0) break;

        const intensity = ri / Math.max(1, litRows);
        const hue = 35 + intensity * 12;
        const sat = 70 + intensity * 20;
        const lum = 10 + intensity * 45;
        const flicker = 0.85 + Math.sin(col * 1.7 + ri * 2.3 + t * 4) * 0.15;
        const alpha = (0.08 + intensity * 0.14) * flicker;

        mfxCtx.globalAlpha = alpha;
        mfxCtx.fillStyle = `hsl(${hue},${sat}%,${lum}%)`;
        mfxCtx.fillRect(col * step, y, fillW, fillH);
      }
    }

    mfxCtx.restore();
  }

  // Per-visualizer mouse particle styles
  const mouseStyles = {
    // 0 = bars: vertical sparks
    0: (x, y, click) => ({
      x, y,
      vx: (Math.random() - 0.5) * (click ? 8 : 2),
      vy: -(Math.random() * (click ? 14 : 6) + 2),
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02,
      size: click ? 4 + Math.random() * 4 : 2 + Math.random() * 2,
      hue: 140 - Math.random() * 200,
      shape: 'rect',
    }),
    // 1 = waveform: horizontal streaks
    1: (x, y, click) => ({
      x, y,
      vx: (Math.random() - 0.5) * (click ? 16 : 8),
      vy: (Math.random() - 0.5) * 2,
      life: 1.0,
      decay: 0.015 + Math.random() * 0.015,
      size: click ? 3 : 1.5,
      length: click ? 20 + Math.random() * 20 : 8 + Math.random() * 12,
      hue: 160,
      shape: 'line',
    }),
    // 2 = circular: ring bursts
    2: (x, y, click) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = click ? 4 + Math.random() * 6 : 1 + Math.random() * 3;
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        size: click ? 3 + Math.random() * 3 : 1.5 + Math.random() * 2,
        hue: Math.random() * 360,
        shape: 'ring',
      };
    },
    // 3 = particles: explosion clusters
    3: (x, y, click) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = click ? 6 + Math.random() * 8 : 2 + Math.random() * 4;
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.01 + Math.random() * 0.02,
        size: click ? 5 + Math.random() * 5 : 2 + Math.random() * 3,
        hue: 320 + Math.random() * 40,
        shape: 'glow',
      };
    },
    // 4 = starfield: comet trails
    4: (x, y, click) => {
      const angle = Math.atan2(y - window.innerHeight / 2, x - window.innerWidth / 2) + (Math.random() - 0.5) * 0.5;
      const speed = click ? 8 + Math.random() * 10 : 3 + Math.random() * 5;
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.008 + Math.random() * 0.012,
        size: click ? 3 : 1.5,
        hue: 200 + Math.random() * 60,
        shape: 'comet',
        trail: [],
      };
    },
  };

  function spawnMouseParticles(x, y, click) {
    const count = click ? 20 : 3;
    const styleFn = mouseStyles[currentVizIndex] || mouseStyles[0];
    for (let i = 0; i < count && mouseParticles.length < MAX_MOUSE_PARTICLES; i++) {
      mouseParticles.push(styleFn(x, y, click));
    }
  }

  function renderMouseFx() {
    mfxCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    mfxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Lofi pixel grid (behind transition)
    renderLofiGrid();

    // Sunrise/sunset transition overlay
    renderTransition();

    // Persistent sun arc (on top of transition)
    renderSunArc();

    // Drop ripples
    renderDropRipples();

    let mLen = mouseParticles.length;
    for (let i = mLen - 1; i >= 0; i--) {
      const p = mouseParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // slight gravity
      p.life -= p.decay;

      if (p.life <= 0) {
        mouseParticles[i] = mouseParticles[mLen - 1];
        mouseParticles.pop();
        mLen--;
        continue;
      }

      const alpha = p.life;
      const light = 55 + (1 - p.life) * 25;

      mfxCtx.globalAlpha = alpha;

      switch (p.shape) {
        case 'rect':
          mfxCtx.fillStyle = `hsl(${p.hue}, 85%, ${light}%)`;
          mfxCtx.fillRect(p.x - p.size / 2, p.y - p.size * 2, p.size, p.size * 4);
          break;

        case 'line':
          mfxCtx.strokeStyle = `hsl(${p.hue}, 80%, ${light}%)`;
          mfxCtx.lineWidth = p.size;
          mfxCtx.beginPath();
          mfxCtx.moveTo(p.x, p.y);
          mfxCtx.lineTo(p.x - p.vx * (p.length / Math.abs(p.vx || 1)), p.y);
          mfxCtx.stroke();
          break;

        case 'ring':
          mfxCtx.strokeStyle = `hsl(${p.hue}, 80%, ${light}%)`;
          mfxCtx.lineWidth = 1.5;
          mfxCtx.beginPath();
          mfxCtx.arc(p.x, p.y, p.size * (1 + (1 - p.life) * 3), 0, Math.PI * 2);
          mfxCtx.stroke();
          break;

        case 'glow':
          mfxCtx.fillStyle = `hsl(${p.hue}, 90%, ${light}%)`;
          mfxCtx.beginPath();
          mfxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          mfxCtx.fill();
          break;

        case 'comet':
          if (p.trail) {
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 12) p.trail.shift();
            mfxCtx.strokeStyle = `hsl(${p.hue}, 70%, ${light}%)`;
            mfxCtx.lineWidth = p.size;
            mfxCtx.beginPath();
            for (let t = 0; t < p.trail.length; t++) {
              const pt = p.trail[t];
              if (t === 0) mfxCtx.moveTo(pt.x, pt.y);
              else mfxCtx.lineTo(pt.x, pt.y);
            }
            mfxCtx.stroke();
          }
          mfxCtx.fillStyle = `hsl(${p.hue}, 80%, 85%)`;
          mfxCtx.beginPath();
          mfxCtx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
          mfxCtx.fill();
          break;
      }

      mfxCtx.globalAlpha = 1;
    }
  }

  // Spawn particles on mouse move and click
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Drag sun if active
    if (isDraggingSun) {
      sunDragX = e.clientX;
      sunDragY = e.clientY;
      return;
    }

    // Only spawn move particles if mouse is actually moving fast enough
    if (mouseFxEnabled && Math.abs(e.movementX) + Math.abs(e.movementY) > 3) {
      spawnMouseParticles(mouseX, mouseY, false);
    }
    if (mouseFxEnabled && isMouseDown) {
      spawnMouseParticles(mouseX, mouseY, true);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#ui-overlay, #top-right-buttons, #queue-panel, #help-overlay, #transition-controls')) return;

    // Check if clicking near the sun to start dragging
    if (sunArcMode !== 'off' && isPlaying) {
      const arcPos = getSunArcPos();
      const sx = sunDragX !== null ? sunDragX : (arcPos ? arcPos.x : null);
      const sy = sunDragY !== null ? sunDragY : (arcPos ? arcPos.y : null);
      if (sx !== null) {
        const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
        if (dist < 80) {
          isDraggingSun = true;
          sunDragX = e.clientX;
          sunDragY = e.clientY;
          return; // don't spawn click particles when grabbing sun
        }
      }
    }

    isMouseDown = true;
    if (mouseFxEnabled) spawnMouseParticles(e.clientX, e.clientY, true);
  });

  document.addEventListener('mouseup', () => {
    isMouseDown = false;
    isDraggingSun = false;
  });

  // ── Drag-and-Drop + Queue Panel ──
  const queuePanel = document.getElementById('queue-panel');
  const queueList = document.getElementById('queue-list');
  const queueCount = document.getElementById('queue-count');
  const queueDropZone = document.getElementById('queue-drop-zone');
  const btnQueueToggle = document.getElementById('btn-queue-toggle');
  let queueCollapsed = false;

  // Hide drop zone entirely when disabled
  if (CFG.dropZoneEnabled === false && queueDropZone) {
    queueDropZone.style.display = 'none';
  }

  const AUDIO_EXTS = new Set(
    (CFG.trackFormats || ['.ogg','.mp3','.wav','.flac','.m4a','.aac','.webm'])
      .map(e => e.replace('.', ''))
  );

  // Ripple effect particles for drop feedback
  const dropRipples = [];

  function spawnDropRipple(x, y) {
    for (let i = 0; i < 5; i++) {
      dropRipples.push({
        x, y,
        radius: 10 + i * 8,
        maxRadius: 120 + i * 60,
        life: 1.0,
        decay: 0.012 + i * 0.003,
        hue: 160 + i * 30,
        lineWidth: 3 - i * 0.4,
      });
    }
    spawnMouseParticles(x, y, true);
    spawnMouseParticles(x, y, true);
  }

  function renderDropRipples() {
    for (let i = dropRipples.length - 1; i >= 0; i--) {
      const r = dropRipples[i];
      r.radius += (r.maxRadius - r.radius) * 0.06;
      r.life -= r.decay;
      if (r.life <= 0) { dropRipples.splice(i, 1); continue; }

      mfxCtx.save();
      mfxCtx.globalAlpha = r.life * 0.6;
      mfxCtx.strokeStyle = `hsl(${r.hue}, 80%, 65%)`;
      mfxCtx.shadowBlur = 15;
      mfxCtx.shadowColor = `hsl(${r.hue}, 80%, 65%)`;
      mfxCtx.lineWidth = r.lineWidth * r.life;
      mfxCtx.beginPath();
      mfxCtx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      mfxCtx.stroke();
      mfxCtx.restore();
    }
  }

  function updateQueueUI() {
    queueCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
    queueList.innerHTML = '';
    tracks.forEach((track, i) => {
      const li = document.createElement('li');
      li.className = 'queue-item' + (i === getTrackIndex() && isPlaying ? ' active' : '');
      li.innerHTML = `
        <span class="queue-item-num">${i === getTrackIndex() && isPlaying ? '' : (i + 1)}</span>
        <span class="queue-item-name">${track.name}</span>
        <span class="queue-item-cat">${track.category}</span>
      `;
      li.addEventListener('click', () => {
        loadTrack(i);
        playTrack();
        updateQueueUI();
      });
      queueList.appendChild(li);
    });
    // Scroll the active track into view
    const active = queueList.querySelector('.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function toggleQueuePanel() {
    queueCollapsed = !queueCollapsed;
    queuePanel.classList.toggle('collapsed', queueCollapsed);
  }

  function toggleQueueVisible() {
    queuePanel.classList.toggle('queue-hidden');
  }

  // Toggle collapse on header click
  document.getElementById('queue-header').addEventListener('click', toggleQueuePanel);

  function handleDroppedFiles(files, dropX, dropY) {
    const audioFiles = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return AUDIO_EXTS.has(ext);
    });
    if (!audioFiles.length) return;

    initAudio();

    // Ripple at drop location
    spawnDropRipple(dropX || window.innerWidth / 2, dropY || window.innerHeight / 2);

    // Build tracks from dropped files (duplicates allowed — queue style)
    const firstNewIndex = tracks.length;
    const newTracks = audioFiles.map(f => {
      const url = URL.createObjectURL(f);
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[._-]/g, ' ');
      return { name, file: url, category: 'dropped' };
    });

    tracks = tracks.concat(newTracks);
    shuffledIndices = generateShuffleOrder();

    // Update the queue UI
    updateQueueUI();

    // Show queue panel if hidden
    queuePanel.classList.remove('queue-hidden');
    if (queueCollapsed) toggleQueuePanel();

    // Play the most recently added track immediately
    loadTrack(firstNewIndex);
    playTrack();
    updateQueueUI();
  }

  // Drag events — whole window
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (CFG.dropZoneEnabled === false) return;
    queuePanel.classList.add('drag-over-panel');
    queueDropZone.classList.add('drag-active');
    // Show queue if hidden
    queuePanel.classList.remove('queue-hidden');
  });

  document.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) {
      queuePanel.classList.remove('drag-over-panel');
      queueDropZone.classList.remove('drag-active');
    }
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    queuePanel.classList.remove('drag-over-panel');
    queueDropZone.classList.remove('drag-active');
    if (CFG.dropZoneEnabled === false) return;
    if (e.dataTransfer.files.length) {
      handleDroppedFiles(e.dataTransfer.files, e.clientX, e.clientY);
    }
  });

  // ── Init ──
  // Apply config-driven branding
  if (CFG.idleText) trackNameEl.textContent = CFG.idleText;
  if (CFG.vibeButtonLabel) btnVibe.textContent = CFG.vibeButtonLabel;
  if (CFG.defaultVolume != null) volumeSlider.value = CFG.defaultVolume;
  if (CFG.defaultVisualizer != null) setVisualizer(CFG.defaultVisualizer);
  if (CFG.transitionDuration != null) {
    transitionSlider.value = CFG.transitionDuration;
    transitionLabel.textContent = CFG.transitionDuration + 's';
  }
  btnSunArc.classList.toggle('active', sunArcMode !== 'off');
  btnSunArc.textContent = SUN_ARC_ICONS[sunArcMode] || '☀';
  btnLofiGrid.classList.toggle('active', lofiGridEnabled);
  btnAmpBars.classList.toggle('active', ampBarsEnabled);
  btnMouseFx.classList.toggle('active', mouseFxEnabled);
  btnTransition.classList.toggle('active', transitionEnabled);

  // ── Info overlay ──
  const infoOverlay = document.getElementById('info-overlay');
  const btnInfo = document.getElementById('btn-info');
  const btnInfoClose = document.getElementById('btn-info-close');
  let infoOpen = false;

  function openInfo() {
    if (infoOpen) return;
    infoOpen = true;
    infoOverlay.classList.remove('info-hidden');
    // Force reflow before adding visible class for transition
    void infoOverlay.offsetHeight;
    infoOverlay.classList.add('info-visible');
  }

  function closeInfo() {
    if (!infoOpen) return;
    infoOpen = false;
    infoOverlay.classList.remove('info-visible');
    setTimeout(() => {
      infoOverlay.classList.add('info-hidden');
    }, 400);
  }

  function toggleInfo() {
    if (infoOpen) closeInfo();
    else openInfo();
  }

  btnInfo.addEventListener('click', toggleInfo);
  btnInfoClose.addEventListener('click', closeInfo);

  infoOverlay.addEventListener('click', (e) => {
    if (e.target === infoOverlay) closeInfo();
  });

  loadTracks();

  // Start the render loop even before playing (shows idle visualization)
  // Use silent data + stub analyser until audio connects
  dataArray = new Uint8Array(1024);
  bufferLength = 1024;
  if (!analyser) {
    analyser = { getByteFrequencyData() {}, getByteTimeDomainData() {} };
  }
  startVisualization();
})();
