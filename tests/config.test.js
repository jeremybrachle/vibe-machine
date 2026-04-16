const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('VIBE_CONFIG', () => {
  let config;

  beforeAll(() => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'public', 'config.js'),
      'utf-8'
    );
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(source, context);
    config = context.window.VIBE_CONFIG;
  });

  test('is defined on window', () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  describe('branding', () => {
    test('has a non-empty title', () => {
      expect(typeof config.title).toBe('string');
      expect(config.title.length).toBeGreaterThan(0);
    });

    test('has idle text', () => {
      expect(typeof config.idleText).toBe('string');
    });

    test('has a vibe button label', () => {
      expect(typeof config.vibeButtonLabel).toBe('string');
    });
  });

  describe('audio settings', () => {
    test('defaultVolume is between 0 and 1', () => {
      expect(config.defaultVolume).toBeGreaterThanOrEqual(0);
      expect(config.defaultVolume).toBeLessThanOrEqual(1);
    });

    test('fftSize is a power of 2 within valid range', () => {
      const fft = config.fftSize;
      expect(fft).toBeGreaterThanOrEqual(256);
      expect(fft).toBeLessThanOrEqual(32768);
      expect(Math.log2(fft) % 1).toBe(0);
    });

    test('smoothing is between 0 and 1', () => {
      expect(config.smoothing).toBeGreaterThanOrEqual(0);
      expect(config.smoothing).toBeLessThanOrEqual(1);
    });

    test('trackFormats are valid file extensions', () => {
      expect(Array.isArray(config.trackFormats)).toBe(true);
      for (const fmt of config.trackFormats) {
        expect(fmt).toMatch(/^\.\w+$/);
      }
    });
  });

  describe('visualizers', () => {
    test('has at least one visualizer', () => {
      expect(Array.isArray(config.visualizers)).toBe(true);
      expect(config.visualizers.length).toBeGreaterThan(0);
    });

    test('defaultVisualizer is a valid index', () => {
      expect(config.defaultVisualizer).toBeGreaterThanOrEqual(0);
      expect(config.defaultVisualizer).toBeLessThan(config.visualizers.length);
    });

    test('visualizer names are non-empty strings', () => {
      for (const name of config.visualizers) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('theme', () => {
    test('has required color properties', () => {
      const required = ['accent', 'secondary', 'bg', 'textPrimary', 'textSecondary', 'textDim'];
      for (const key of required) {
        expect(config.theme[key]).toBeDefined();
      }
    });

    test('hex colors are valid format', () => {
      const hexFields = ['accent', 'secondary', 'bg', 'textPrimary', 'textSecondary', 'textDim'];
      for (const key of hexFields) {
        expect(config.theme[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    test('RGB values are provided for accent colors', () => {
      expect(config.theme.accentRGB).toBeDefined();
      expect(config.theme.secondaryRGB).toBeDefined();
      expect(config.theme.accentRGB).toMatch(/^\d+,\s*\d+,\s*\d+$/);
      expect(config.theme.secondaryRGB).toMatch(/^\d+,\s*\d+,\s*\d+$/);
    });
  });

  describe('vibe mode', () => {
    test('mouse timeout is a positive number', () => {
      expect(config.vibeMouseTimeout).toBeGreaterThan(0);
    });
  });

  describe('default toggle states', () => {
    test('all effects default to off', () => {
      expect(config.transitionEnabled).toBe(false);
      expect(config.sunArcEnabled).toBe(false);
      expect(config.lofiGridEnabled).toBe(false);
      expect(config.ampBarsEnabled).toBe(false);
      expect(config.mouseFxEnabled).toBe(false);
    });

    test('transitionDuration is a positive number', () => {
      expect(config.transitionDuration).toBeGreaterThan(0);
    });
  });
});
