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
    ['default', '古書机背景', 'assets/images/background/default.png'],
    ['default-2', 'デフォルト2', 'assets/images/background/デフォルト2.png'],
    ['default-3', 'デフォルト3', 'assets/images/background/デフォルト3.png'],
    ['default-4', 'デフォルト4', 'assets/images/background/デフォルト4.png'],
    ['default-5', 'デフォルト5', 'assets/images/background/デフォルト5.png'],
    ['default-6', 'デフォルト6', 'assets/images/background/デフォルト6.png'],
    ['default-7', 'デフォルト7', 'assets/images/background/デフォルト7.png'],
    ['default-8', 'デフォルト8', 'assets/images/background/デフォルト8.png'],
    ['default-9', 'デフォルト9', 'assets/images/background/デフォルト9.png'],
    ['default-10', 'デフォルト10', 'assets/images/background/デフォルト10.png'],
    ['default-11', 'デフォルト11', 'assets/images/background/デフォルト11.png'],
    ['default-12', 'デフォルト12', 'assets/images/background/デフォルト12.png'],
    ['default-13', 'デフォルト13', 'assets/images/background/デフォルト13.png'],
    ['default-14', 'デフォルト14', 'assets/images/background/デフォルト14.png'],
    ['default-15', 'デフォルト15', 'assets/images/background/デフォルト15.png'],
    ['default-16', 'デフォルト16', 'assets/images/background/デフォルト16.png'],
    ['default-17', 'デフォルト17', 'assets/images/background/デフォルト17.png'],
    ['default-18', 'デフォルト18', 'assets/images/background/デフォルト18.png'],
    ['default-19', 'デフォルト19', 'assets/images/background/デフォルト19.png'],
    ['default-20', 'デフォルト20', 'assets/images/background/デフォルト20.png'],
    ['default-21', 'デフォルト21', 'assets/images/background/デフォルト21.png'],
    ['default-22', 'デフォルト22', 'assets/images/background/デフォルト22.png'],
    ['default-23', 'デフォルト23', 'assets/images/background/デフォルト23.png'],
    ['default-24', 'デフォルト24', 'assets/images/background/デフォルト24.png'],
    ['default-25', '既定', 'assets/images/background/デフォルト25.webp'],
    ['default-26', 'デフォルト26', 'assets/images/background/デフォルト26.png'],
    ['default-27', 'デフォルト27', 'assets/images/background/デフォルト27.png'],
    ['default-28', 'デフォルト28', 'assets/images/background/デフォルト28.png']
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
