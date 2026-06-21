import { JSDOM } from 'jsdom';

describe('stone skin selection', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    (global as any).window = dom.window;
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete (global as any).window;
  });

  test('reads and writes normalized selected stone skin ids', () => {
    const selection = require('../ui/stone-skin/selection.ts');

    window.localStorage.setItem(selection.STONE_SKIN_STORAGE_KEY, 'o-stone');
    expect(selection.readStoredStoneSkinId(window)).toBe('o-stone');

    expect(selection.writeStoredStoneSkinId(window, 'missing')).toBe(true);
    expect(window.localStorage.getItem(selection.STONE_SKIN_STORAGE_KEY)).toBe('jade-rim');
    expect(window.localStorage.getItem(selection.LEGACY_STONE_SKIN_STORAGE_KEY)).toBe('jade-rim');
    expect(selection.readStoredStoneSkinId(window)).toBe('jade-rim');
  });
});
