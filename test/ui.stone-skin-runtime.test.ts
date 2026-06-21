import { JSDOM } from 'jsdom';

describe('stone skin runtime', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete (global as any).window;
    delete (global as any).document;
  });

  test('applies selected normal stone image variables to the document root', () => {
    const runtime = require('../ui/stone-skin/runtime.ts');

    const applied = runtime.syncDisplayedStoneSkin(window, 'jade-rim');

    expect(applied.id).toBe('jade-rim');
    expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('jade-rim');
    expect(document.documentElement.style.getPropertyValue('--normal-stone-black-image')).toBe('url("assets/images/stone-skin/jade-rim/black.png")');
    expect(document.documentElement.style.getPropertyValue('--normal-stone-white-image')).toBe('url("assets/images/stone-skin/jade-rim/white.png")');
  });

  test('resolves selected normal stone background images from the shared variables', () => {
    const runtime = require('../ui/stone-skin/runtime.ts');

    runtime.syncDisplayedStoneSkin(window, 'jade-rim');

    expect(runtime.getNormalStoneImageVariableName('black')).toBe('--normal-stone-black-image');
    expect(runtime.getNormalStoneImageVariableName('white')).toBe('--normal-stone-white-image');
    expect(runtime.resolveNormalStoneBackgroundImage('black', window)).toContain('assets/images/stone-skin/jade-rim/black.png');
    expect(runtime.resolveNormalStoneBackgroundImage('white', window)).toContain('assets/images/stone-skin/jade-rim/white.png');
  });

  test('falls back to the configured default stone skin images when no document root is available', () => {
    const runtime = require('../ui/stone-skin/runtime.ts');

    delete (global as any).window;
    delete (global as any).document;

    expect(runtime.resolveNormalStoneBackgroundImage('black', null)).toBe('url("assets/images/stone-skin/jade-rim/black.png")');
    expect(runtime.resolveNormalStoneBackgroundImage('white', null)).toBe('url("assets/images/stone-skin/jade-rim/white.png")');
  });
});
