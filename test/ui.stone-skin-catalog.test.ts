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

  test('exposes O stone as the default selected stone skin while keeping owned skins available', () => {
    const catalog = require('../ui/stone-skin/catalog.ts');

    expect(catalog.DEFAULT_STONE_SKIN_ID).toBe('o-stone');
    expect(catalog.getOwnedStoneSkins(window).map((skin: any) => skin.id)).toEqual(['default', 'o-stone', 'jade-rim', 'pearl-obsidian']);
    expect(catalog.getStoneSkinDefinition('default', window)).toEqual(expect.objectContaining({
      id: 'default',
      label: 'クラシック石',
      note: '初期所持',
      blackImagePath: 'assets/images/stone-skin/default/black.png',
      whiteImagePath: 'assets/images/stone-skin/default/white.png'
    }));
    expect(catalog.getStoneSkinDefinition('missing', window)).toEqual(expect.objectContaining({
      id: 'o-stone',
      label: '既定'
    }));
    expect(catalog.getStoneSkinDefinition('o-stone', window)).toEqual(expect.objectContaining({
      id: 'o-stone',
      label: '既定',
      note: '初期所持',
      blackImagePath: 'assets/images/stone-skin/o-stone/black.png',
      whiteImagePath: 'assets/images/stone-skin/o-stone/white.png'
    }));
    expect(catalog.getStoneSkinDefinition('jade-rim', window)).toEqual(expect.objectContaining({
      id: 'jade-rim',
      label: '碧縁石',
      note: '青緑盤に合わせた黒曜石と白玉石',
      blackImagePath: 'assets/images/stone-skin/jade-rim/black.png',
      whiteImagePath: 'assets/images/stone-skin/jade-rim/white.png'
    }));
    expect(catalog.getStoneSkinDefinition('pearl-obsidian', window)).toEqual(expect.objectContaining({
      id: 'pearl-obsidian',
      label: '真珠黒曜石',
      note: '金縁の黒曜石と真珠石',
      blackImagePath: 'assets/images/stone-skin/pearl-obsidian/black.png',
      whiteImagePath: 'assets/images/stone-skin/pearl-obsidian/white.png'
    }));
  });
});
