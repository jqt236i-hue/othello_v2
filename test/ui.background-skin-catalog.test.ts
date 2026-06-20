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

  test.each([
    ['default-2', 'デフォルト2', 'assets/images/background/デフォルト2.png'],
    ['default-3', 'デフォルト3', 'assets/images/background/デフォルト3.png'],
    ['default-4', 'デフォルト4', 'assets/images/background/デフォルト4.png'],
    ['default-5', 'デフォルト5', 'assets/images/background/デフォルト5.png'],
    ['default-6', 'デフォルト6', 'assets/images/background/デフォルト6.png'],
    ['default-7', 'デフォルト7', 'assets/images/background/デフォルト7.png'],
    ['default-8', 'デフォルト8', 'assets/images/background/デフォルト8.png']
  ])('includes %s as an initially owned background skin', (skinId, label, imagePath) => {
    const storage = require('../ui/storage/gacha-progress.ts');
    (window as any).GachaProgressStorage = storage;
    (window as any).GachaProgressStorageModule = storage;
    const catalog = require('../ui/background-skin/catalog.ts');

    expect(catalog.isBackgroundSkinOwned(window, skinId)).toBe(true);
    expect(catalog.getOwnedBackgroundSkins(window)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: skinId,
        label,
        note: '初期所持',
        imagePath
      })
    ]));
  });
});
