import { REQUIRED_GLOBAL_TYPES } from '../browser-vite/runtime-contract';

const PNG = require('pngjs').PNG;
const {
  comparePngBuffers,
  evaluateReport,
  median,
  normalizeRequestedPaths
} = require('../scripts/compare-browser-lanes');

function makePng(red: number): Buffer {
  const image = new PNG({ width: 2, height: 2 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = red;
    image.data[offset + 1] = 20;
    image.data[offset + 2] = 30;
    image.data[offset + 3] = 255;
  }
  return PNG.sync.write(image);
}

function lane(name: 'classic' | 'vite'): any {
  return {
    lane: name,
    htmlLane: name,
    bootState: name === 'vite' ? 'ready' : '',
    viteRuntime: name === 'vite' ? {
      state: 'ready',
      moduleDelivery: 'vite-bundled',
      loadedModules: ['startup', 'layout', 'entry'],
      esmEntry: true,
      customModuleRegistry: false
    } : null,
    pixiRuntime: {
      lane: name,
      injected: true,
      version: '8.18.1',
      unavailableReason: null
    },
    boardRenderSurface: {
      renderer: 'dom',
      cellCount: 64,
      canvasCount: 0
    },
    globals: { ...REQUIRED_GLOBAL_TYPES },
    missingElements: [],
    stylesheetPaths: ['/styles-base.css', '/styles-board.css'],
    fixtureDigest: 'fixture-digest',
    boardSize: { width: 368, height: 368 },
    optionalRegistryAtStartup: false,
    moduleRegistryAtStartup: name === 'classic',
    optionalPayloadAtStartup: false,
    onnxRuntimeAtStartup: false,
    pageErrors: [],
    consoleErrors: [],
    resourceErrors: [],
    startupScriptPaths: name === 'vite'
      ? ['/vite-dist/assets/index.vite-abc123.js']
      : ['/entry-browser.js?v=1']
  };
}

describe('classic/Vite browser lane comparison', () => {
  test('uses a stable median for repeated cold-run evidence', () => {
    expect(median([910, 730, 810])).toBe(810);
    expect(median([900, 700, 800, 600])).toBe(750);
  });

  test('normalizes request URLs without their ephemeral origin', () => {
    expect(normalizeRequestedPaths([
      'http://127.0.0.1:50001/entry-browser.js?v=1',
      'http://127.0.0.1:50002/entry-browser.js?v=1'
    ])).toEqual(['/entry-browser.js?v=1']);
  });

  test('requires a pixel-identical board capture', () => {
    expect(comparePngBuffers(makePng(10), makePng(10))).toEqual({
      width: 2,
      height: 2,
      diffPixels: 0
    });
    expect(comparePngBuffers(makePng(10), makePng(200)).diffPixels).toBe(4);
  });

  test('accepts matching runtime, state, presentation, and loading contracts', () => {
    expect(evaluateReport(lane('classic'), lane('vite'), {
      width: 368,
      height: 368,
      diffPixels: 0
    })).toEqual({ ok: true, errors: [] });
  });
});
