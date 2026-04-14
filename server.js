const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 3000;

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

const server = http.createServer((req, res) => {
  // Sanitize the URL to prevent path traversal
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = path.join(__dirname, decodeURIComponent(url.pathname));
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (url.pathname === '/') filePath = path.join(__dirname, 'index.html');

  // Special route: list tracks
  // Supports both flat (tracks/song.mp3) and categorized (tracks/rock/song.mp3) layouts.
  if (url.pathname === '/api/tracks') {
    const tracksDir = path.join(__dirname, 'tracks');
    try {
      const entries = fs.readdirSync(tracksDir, { withFileTypes: true });
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
          fs.readdirSync(path.join(tracksDir, d.name))
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
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  // Support range requests for audio seeking
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
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  🎵 Vibe Machine`);
  console.log(`  ════════════════`);
  console.log(`  Running at http://localhost:${PORT}`);
  console.log(`  Tracks:   ./tracks/<category>/<file>`);
  console.log(`  Config:   ./config.js`);
  console.log(`  Press Ctrl+C to stop\n`);
});
