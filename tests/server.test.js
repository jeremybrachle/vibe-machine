const http = require('http');
const fs = require('fs');
const path = require('path');
const { server, MIME_TYPES, AUDIO_EXTENSIONS, SECURITY_HEADERS } = require('../server');

// ── Test Helpers ──

function request(urlPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const opts = { hostname: 'localhost', port, path: urlPath, method };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, body: data })
      );
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Lifecycle ──

beforeAll((done) => {
  server.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

// ── Static File Serving ──

describe('Static file serving', () => {
  test('GET / returns index.html with text/html content type', async () => {
    const res = await request('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/html');
    expect(res.body).toContain('<!DOCTYPE html>');
  });

  test('GET /styles.css returns CSS with correct content type', async () => {
    const res = await request('/styles.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/css');
  });

  test('GET /config.js returns JavaScript', async () => {
    const res = await request('/config.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/javascript');
    expect(res.body).toContain('VIBE_CONFIG');
  });

  test('GET /nonexistent returns 404', async () => {
    const res = await request('/does-not-exist.xyz');
    expect(res.status).toBe(404);
  });

  test('path traversal attempts do not return 200', async () => {
    const attempts = [
      '/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
      '/%2e%2e/package.json',
    ];
    for (const p of attempts) {
      const res = await request(p);
      expect(res.status).not.toBe(200);
    }
  });
});

// ── Track API ──

describe('Track API', () => {
  test('GET /api/tracks returns JSON array', async () => {
    const res = await request('/api/tracks');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json');
    const tracks = JSON.parse(res.body);
    expect(Array.isArray(tracks)).toBe(true);
  });
});

describe('Track API with files', () => {
  const tracksDir = path.join(__dirname, '..', 'tracks');
  const categoryDir = path.join(tracksDir, 'test-category');

  beforeAll(() => {
    fs.mkdirSync(categoryDir, { recursive: true });
    fs.writeFileSync(path.join(tracksDir, 'test-song.mp3'), '');
    fs.writeFileSync(path.join(categoryDir, 'categorized-song.ogg'), '');
  });

  afterAll(() => {
    fs.unlinkSync(path.join(tracksDir, 'test-song.mp3'));
    fs.unlinkSync(path.join(categoryDir, 'categorized-song.ogg'));
    fs.rmdirSync(categoryDir);
  });

  test('lists flat tracks with correct metadata', async () => {
    const res = await request('/api/tracks');
    const tracks = JSON.parse(res.body);
    const flat = tracks.find(t => t.file === 'tracks/test-song.mp3');
    expect(flat).toBeDefined();
    expect(flat.name).toBe('test-song');
    expect(flat.category).toBe('uncategorized');
  });

  test('lists categorized tracks with subdirectory as category', async () => {
    const res = await request('/api/tracks');
    const tracks = JSON.parse(res.body);
    const cat = tracks.find(t => t.file === 'tracks/test-category/categorized-song.ogg');
    expect(cat).toBeDefined();
    expect(cat.name).toBe('categorized-song');
    expect(cat.category).toBe('test-category');
  });

  test('ignores non-audio files', async () => {
    const res = await request('/api/tracks');
    const tracks = JSON.parse(res.body);
    const gitkeep = tracks.find(t => t.file.includes('.gitkeep'));
    expect(gitkeep).toBeUndefined();
  });
});

// ── MIME Types ──

describe('MIME type mapping', () => {
  test('maps common web formats', () => {
    expect(MIME_TYPES['.html']).toBe('text/html');
    expect(MIME_TYPES['.css']).toBe('text/css');
    expect(MIME_TYPES['.js']).toBe('application/javascript');
    expect(MIME_TYPES['.json']).toBe('application/json');
  });

  test('maps all supported audio formats', () => {
    expect(MIME_TYPES['.ogg']).toBe('audio/ogg');
    expect(MIME_TYPES['.mp3']).toBe('audio/mpeg');
    expect(MIME_TYPES['.wav']).toBe('audio/wav');
    expect(MIME_TYPES['.flac']).toBe('audio/flac');
    expect(MIME_TYPES['.m4a']).toBe('audio/mp4');
    expect(MIME_TYPES['.aac']).toBe('audio/aac');
    expect(MIME_TYPES['.webm']).toBe('audio/webm');
  });
});

// ── Audio Extensions ──

describe('Audio extensions', () => {
  test('includes all supported formats', () => {
    const expected = ['.ogg', '.mp3', '.wav', '.flac', '.m4a', '.aac', '.webm'];
    for (const ext of expected) {
      expect(AUDIO_EXTENSIONS.has(ext)).toBe(true);
    }
  });

  test('excludes non-audio formats', () => {
    expect(AUDIO_EXTENSIONS.has('.html')).toBe(false);
    expect(AUDIO_EXTENSIONS.has('.js')).toBe(false);
    expect(AUDIO_EXTENSIONS.has('.exe')).toBe(false);
  });
});

// ── Security Headers ──

describe('Security headers', () => {
  test('responses include X-Content-Type-Options: nosniff', async () => {
    const res = await request('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('responses include X-Frame-Options: DENY', async () => {
    const res = await request('/');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  test('responses include Referrer-Policy', async () => {
    const res = await request('/');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('API responses also include security headers', async () => {
    const res = await request('/api/tracks');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  test('SECURITY_HEADERS object has expected keys', () => {
    expect(SECURITY_HEADERS).toHaveProperty('X-Content-Type-Options');
    expect(SECURITY_HEADERS).toHaveProperty('X-Frame-Options');
    expect(SECURITY_HEADERS).toHaveProperty('Referrer-Policy');
  });
});

// ── Cache-Control ──

describe('Cache-Control headers', () => {
  test('HTML responses have no-cache', async () => {
    const res = await request('/');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  test('CSS/JS responses have public cache', async () => {
    const res = await request('/styles.css');
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });
});

// ── Method Validation ──

describe('HTTP method validation', () => {
  test('POST to /api/tracks returns 405', async () => {
    const res = await request('/api/tracks', 'POST');
    expect(res.status).toBe(405);
    expect(res.headers['allow']).toBe('GET');
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Method Not Allowed');
  });

  test('DELETE to /api/tracks returns 405', async () => {
    const res = await request('/api/tracks', 'DELETE');
    expect(res.status).toBe(405);
  });
});
