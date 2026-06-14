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

    const applied = runtime.syncDisplayedStoneSkin(window, 'o-stone');

    expect(applied.id).toBe('o-stone');
    expect(document.documentElement.getAttribute('data-stone-skin-id')).toBe('o-stone');
    expect(document.documentElement.style.getPropertyValue('--normal-stone-black-image')).toBe('url("assets/images/stone-skin/o-stone/black.png")');
    expect(document.documentElement.style.getPropertyValue('--normal-stone-white-image')).toBe('url("assets/images/stone-skin/o-stone/white.png")');
  });
});
