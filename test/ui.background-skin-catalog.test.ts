import { JSDOM } from 'jsdom';

describe('background skin catalog', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    global.window = dom.window as unknown as Window & typeof globalThis;
    global.localStorage = dom.window.localStorage;
  });

  afterEach(() => {
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  test('includes デフォルト2 as an initially owned background skin', () => {
    const storage = require('../ui/storage/gacha-progress.ts');
    (window as any).GachaProgressStorage = storage;
    (window as any).GachaProgressStorageModule = storage;
    const catalog = require('../ui/background-skin/catalog.ts');

    expect(catalog.isBackgroundSkinOwned(window, 'default-2')).toBe(true);
    expect(catalog.getOwnedBackgroundSkins(window)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'default-2',
        label: 'デフォルト2',
        note: '初期所持',
        imagePath: 'assets/images/background/デフォルト2.png'
      })
    ]));
  });

  test('includes デフォルト3 as an initially owned background skin', () => {
    const storage = require('../ui/storage/gacha-progress.ts');
    (window as any).GachaProgressStorage = storage;
    (window as any).GachaProgressStorageModule = storage;
    const catalog = require('../ui/background-skin/catalog.ts');

    expect(catalog.isBackgroundSkinOwned(window, 'default-3')).toBe(true);
    expect(catalog.getOwnedBackgroundSkins(window)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'default-3',
        label: 'デフォルト3',
        note: '初期所持',
        imagePath: 'assets/images/background/デフォルト3.png'
      })
    ]));
  });
});
