import { JSDOM } from 'jsdom';

describe('stone skin catalog', () => {
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

  test('exposes default and O stone as initially owned skins', () => {
    const catalog = require('../ui/stone-skin/catalog.ts');

    expect(catalog.DEFAULT_STONE_SKIN_ID).toBe('default');
    expect(catalog.getOwnedStoneSkins(window).map((skin: any) => skin.id)).toEqual(['default', 'o-stone']);
    expect(catalog.getStoneSkinDefinition('o-stone', window)).toEqual(expect.objectContaining({
      id: 'o-stone',
      label: 'O石',
      note: '初期所持',
      blackImagePath: 'assets/images/stone-skin/o-stone/black.png',
      whiteImagePath: 'assets/images/stone-skin/o-stone/white.png'
    }));
  });
});
