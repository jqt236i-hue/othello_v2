import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

describe('ui/bootstrap special stone preload', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    try { consoleErrorSpy.mockRestore(); } catch (e) { /* Intentionally empty: test cleanup guard */ }
    jest.resetModules();
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.Image; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.preloadStoneVisualEffectKeys; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.getSupportedEffectKeys; } catch (e) { /* Intentionally empty: test cleanup guard */ }
  });

  function installDom() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Image = dom.window.Image;
    return dom;
  }

  test('preloadSpecialStoneVisuals forwards supported effect keys to the stone visual preloader', () => {
    installDom();
    const preloadCalls = [];
    global.getSupportedEffectKeys = jest.fn(() => ['ultimateDragon', 'ultimateDestroyGod', 'normal', 'ultimateDragon']);
    global.preloadStoneVisualEffectKeys = jest.fn((keys) => {
      preloadCalls.push(keys);
      return { started: ['assets/images/special-stones/ultimate_reverse_dragon-black.png'], skipped: [] };
    });

    const uiBootstrap = require('../ui/bootstrap.js');
    const result = uiBootstrap.preloadSpecialStoneVisuals();

    expect(global.getSupportedEffectKeys).toHaveBeenCalledTimes(1);
    expect(global.preloadStoneVisualEffectKeys).toHaveBeenCalledTimes(1);
    expect(preloadCalls[0]).toEqual(['ultimateDragon', 'ultimateDestroyGod']);
    expect(result).toMatchObject({
      attempted: true,
      effectKeys: ['ultimateDragon', 'ultimateDestroyGod'],
      started: ['assets/images/special-stones/ultimate_reverse_dragon-black.png']
    });
  });

  test('installGameDI leaves special stone loading to the selected board backend', () => {
    installDom();
    document.documentElement.classList.add('stone-base-images-ready');
    global.getSupportedEffectKeys = jest.fn(() => ['ultimateDragon', 'ultimateDestroyGod']);
    global.preloadStoneVisualEffectKeys = jest.fn(() => ({ started: [], skipped: [] }));

    const uiBootstrap = require('../ui/bootstrap.js');
    uiBootstrap.installGameDI();

    expect(global.preloadStoneVisualEffectKeys).not.toHaveBeenCalled();
  });

  test('legacy work visual initialization does not start normal-path special image requests', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'ui.ts'), 'utf8');
    const start = source.indexOf('export function initWorkVisualsHelpers()');
    const end = source.indexOf('// ===== Work visual diagnostics', start);
    const body = source.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(body).not.toContain('preloadWorkStoneImages()');
    expect(body).not.toContain('preloadImmediateSpecialStoneImages()');
  });
});
