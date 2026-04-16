const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const TRACKS_DIR = path.join(__dirname, 'tracks');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.webm': 'audio/webm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const AUDIO_EXTENSIONS = new Set(['.ogg', '.mp3', '.wav', '.flac', '.m4a', '.aac', '.webm']);

// Security headers applied to every response
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function applySecurityHeaders(res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(k, v);
  }
}

// Cache durations by file type
function getCacheControl(ext) {
  if (ext === '.html') return 'no-cache';
  if (AUDIO_EXTENSIONS.has(ext)) return 'public, max-age=86400';
  return 'public, max-age=3600';
}

// ── Route Handlers ──

function handleTrackList(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Allow': 'GET', 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }
  try {
    if (!fs.existsSync(TRACKS_DIR)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }

    const entries = fs.readdirSync(TRACKS_DIR, { withFileTypes: true });
    const allTracks = [];

    // Flat files in tracks/
    entries
      .filter(e => !e.isDirectory() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .forEach(e => allTracks.push({
        name: e.name.replace(/\.[^.]+$/, '').replace(/\./g, ' '),
        file: `tracks/${e.name}`,
        category: 'uncategorized',
      }));

    // Subdirectories as categories
    entries
      .filter(d => d.isDirectory())
      .forEach(d => {
        fs.readdirSync(path.join(TRACKS_DIR, d.name))
          .filter(f => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()))
          .forEach(f => allTracks.push({
            name: f.replace(/\.[^.]+$/, '').replace(/\./g, ' '),
            file: `tracks/${d.name}/${f}`,
            category: d.name,
          }));
      });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(allTracks));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}

function serveFile(filePath, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const cacheControl = getCacheControl(ext);

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const range = req.headers.range;
    if (range && AUDIO_EXTENSIONS.has(ext)) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': cacheControl,
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

// ── Request Router ──

function handleRequest(req, res) {
  applySecurityHeaders(res);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  // API: list tracks
  if (pathname === '/api/tracks') {
    return handleTrackList(req, res);
  }

  // Resolve file path based on route
  let filePath;
  if (pathname === '/') {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  } else if (pathname.startsWith('/tracks/')) {
    filePath = path.join(__dirname, pathname);
  } else {
    filePath = path.join(PUBLIC_DIR, pathname);
  }

  // Sanitize to prevent path traversal
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  serveFile(filePath, req, res);
}

// ── Server ──

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n  🎵 Vibe Machine`);
    console.log(`  ════════════════`);
    console.log(`  Running at http://localhost:${PORT}`);
    console.log(`  Tracks:   ./tracks/<category>/<file>`);
    console.log(`  Config:   ./public/config.js`);
    console.log(`  Press Ctrl+C to stop\n`);
  });
}

module.exports = { server, MIME_TYPES, AUDIO_EXTENSIONS, SECURITY_HEADERS, PUBLIC_DIR, TRACKS_DIR };
