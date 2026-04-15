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

  const visualizers = [
    window.VisualizerBars,
    window.VisualizerWaveform,
    window.VisualizerCircular,
    window.VisualizerParticles,
    window.VisualizerStarfield,
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
  const vizButtons = document.querySelectorAll('.viz-btn');

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
        trackNameEl.textContent = 'No tracks found in tracks/ folder';
        return;
      }
      shuffledIndices = generateShuffleOrder();
      trackNameEl.textContent = `${tracks.length} tracks loaded — press play`;
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
  }

  function pauseTrack() {
    audio.pause();
    isPlaying = false;
    btnPlay.textContent = '▶';
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
  function setVisualizer(index) {
    currentVizIndex = ((index % visualizers.length) + visualizers.length) % visualizers.length;
    vizButtons.forEach((btn, i) => btn.classList.toggle('active', i === currentVizIndex));
    // Clear canvas for clean transition
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  }

  // ── Vibe Mode ──
  function toggleVibeMode() {
    isVibeMode = !isVibeMode;
    uiOverlay.classList.toggle('hidden', isVibeMode);
    document.body.classList.toggle('vibe-mode', isVibeMode);

    if (isVibeMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
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
  volumeSlider.addEventListener('input', (e) => setVolume(parseFloat(e.target.value)));
  progressBar.addEventListener('input', seekTo);

  vizButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => setVisualizer(i));
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
      case '?':
        toggleHelp();
        break;
      case 'Escape':
        if (isVibeMode) toggleVibeMode();
        break;
    }
  });

  // Exit vibe mode on fullscreen exit
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isVibeMode) {
      isVibeMode = false;
      uiOverlay.classList.remove('hidden');
      document.body.classList.remove('vibe-mode');
    }
  });

  // Mouse: show UI temporarily in vibe mode
  let mouseTimer = null;
  document.addEventListener('mousemove', () => {
    if (!isVibeMode) return;
    uiOverlay.classList.remove('hidden');
    document.body.classList.remove('vibe-mode');
    clearTimeout(mouseTimer);
    mouseTimer = setTimeout(() => {
      if (isVibeMode) {
        uiOverlay.classList.add('hidden');
        document.body.classList.add('vibe-mode');
      }
    }, CFG.vibeMouseTimeout || 2500);
  });

  // ── Init ──
  // Apply config-driven branding
  if (CFG.idleText) trackNameEl.textContent = CFG.idleText;
  if (CFG.vibeButtonLabel) btnVibe.textContent = CFG.vibeButtonLabel;
  if (CFG.defaultVolume != null) volumeSlider.value = CFG.defaultVolume;
  if (CFG.defaultVisualizer != null) setVisualizer(CFG.defaultVisualizer);

  loadTracks();

  // Start the render loop even before playing (shows idle visualization)
  // Use silent data until audio connects
  dataArray = new Uint8Array(1024);
  bufferLength = 1024;
  startVisualization();
})();
