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

    // Render mouse interaction particles
    renderMouseFx();
  }

  // ── Vibe Mode ──
  const vibeToggle = document.getElementById('vibe-toggle');
  let vibeButtonTimer = null;

  function toggleVibeMode() {
    isVibeMode = !isVibeMode;
    uiOverlay.classList.toggle('hidden', isVibeMode);
    document.body.classList.toggle('vibe-mode', isVibeMode);

    if (isVibeMode) {
      // Hide queue panel in vibe mode
      queuePanel.classList.add('queue-hidden');
      // Show button briefly, then fade it out after 1 second
      vibeToggle.classList.remove('vibe-hidden');
      vibeToggle.classList.add('vibe-active');
      clearTimeout(vibeButtonTimer);
      vibeButtonTimer = setTimeout(() => {
        vibeToggle.classList.add('vibe-hidden');
      }, 1000);
    } else {
      // Restore everything
      queuePanel.classList.remove('queue-hidden');
      clearTimeout(vibeButtonTimer);
      vibeToggle.classList.remove('vibe-active', 'vibe-hidden');
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
      case 'q':
      case 'Q':
        toggleQueueVisible();
        break;
      case 'Escape':
        if (isVibeMode) toggleVibeMode();
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
      vibeToggle.classList.remove('vibe-hidden');
    } else {
      vibeToggle.classList.add('vibe-hidden');
    }

    clearTimeout(mouseTimer);
    mouseTimer = setTimeout(() => {
      if (isVibeMode) {
        document.body.classList.add('vibe-mode'); // hide cursor
        vibeToggle.classList.add('vibe-hidden');
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

    // Drop ripples
    renderDropRipples();

    for (let i = mouseParticles.length - 1; i >= 0; i--) {
      const p = mouseParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // slight gravity
      p.life -= p.decay;

      if (p.life <= 0) {
        mouseParticles.splice(i, 1);
        continue;
      }

      const alpha = p.life;
      const light = 55 + (1 - p.life) * 25;

      mfxCtx.save();
      mfxCtx.globalAlpha = alpha;

      switch (p.shape) {
        case 'rect':
          mfxCtx.fillStyle = `hsl(${p.hue}, 85%, ${light}%)`;
          mfxCtx.shadowBlur = 6;
          mfxCtx.shadowColor = `hsl(${p.hue}, 85%, ${light}%)`;
          mfxCtx.fillRect(p.x - p.size / 2, p.y - p.size * 2, p.size, p.size * 4);
          break;

        case 'line':
          mfxCtx.strokeStyle = `hsl(${p.hue}, 80%, ${light}%)`;
          mfxCtx.shadowBlur = 8;
          mfxCtx.shadowColor = '#00c878';
          mfxCtx.lineWidth = p.size;
          mfxCtx.beginPath();
          mfxCtx.moveTo(p.x, p.y);
          mfxCtx.lineTo(p.x - p.vx * (p.length / Math.abs(p.vx || 1)), p.y);
          mfxCtx.stroke();
          break;

        case 'ring':
          mfxCtx.strokeStyle = `hsl(${p.hue}, 80%, ${light}%)`;
          mfxCtx.shadowBlur = 10;
          mfxCtx.shadowColor = `hsl(${p.hue}, 80%, ${light}%)`;
          mfxCtx.lineWidth = 1.5;
          mfxCtx.beginPath();
          mfxCtx.arc(p.x, p.y, p.size * (1 + (1 - p.life) * 3), 0, Math.PI * 2);
          mfxCtx.stroke();
          break;

        case 'glow':
          mfxCtx.fillStyle = `hsl(${p.hue}, 90%, ${light}%)`;
          mfxCtx.shadowBlur = p.size * 4;
          mfxCtx.shadowColor = `hsl(${p.hue}, 90%, ${light}%)`;
          mfxCtx.beginPath();
          mfxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          mfxCtx.fill();
          break;

        case 'comet':
          if (p.trail) {
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 12) p.trail.shift();
            mfxCtx.strokeStyle = `hsl(${p.hue}, 70%, ${light}%)`;
            mfxCtx.shadowBlur = 6;
            mfxCtx.shadowColor = `hsl(${p.hue}, 70%, 70%)`;
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

      mfxCtx.restore();
    }
  }

  // Spawn particles on mouse move and click
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    // Only spawn move particles if mouse is actually moving fast enough
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 3) {
      spawnMouseParticles(mouseX, mouseY, false);
    }
    if (isMouseDown) {
      spawnMouseParticles(mouseX, mouseY, true);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('#ui-overlay, #vibe-toggle, #queue-panel, #help-overlay')) return;
    isMouseDown = true;
    spawnMouseParticles(e.clientX, e.clientY, true);
  });

  document.addEventListener('mouseup', () => {
    isMouseDown = false;
  });

  // ── Drag-and-Drop + Queue Panel ──
  const queuePanel = document.getElementById('queue-panel');
  const queueList = document.getElementById('queue-list');
  const queueCount = document.getElementById('queue-count');
  const queueDropZone = document.getElementById('queue-drop-zone');
  const btnQueueToggle = document.getElementById('btn-queue-toggle');
  let queueCollapsed = false;

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

  loadTracks();

  // Start the render loop even before playing (shows idle visualization)
  // Use silent data until audio connects
  dataArray = new Uint8Array(1024);
  bufferLength = 1024;
  startVisualization();
})();
