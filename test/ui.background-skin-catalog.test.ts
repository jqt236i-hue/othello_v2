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
    dom.window.close();
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  test('keeps only the current default as a standard initially owned background', () => {
    const storage = require('../ui/storage/gacha-progress.ts');
    (window as any).GachaProgressStorage = storage;
    (window as any).GachaProgressStorageModule = storage;
    const catalog = require('../ui/background-skin/catalog.ts');
    const expected = [{
      id: 'default-25',
      label: '既定',
      note: '初期所持',
      imagePath: 'assets/images/background/デフォルト25.webp'
    }];

    expect(catalog.DEFAULT_BACKGROUND_SKIN_ID).toBe('default-25');
    expect(catalog.BASE_BACKGROUND_SKINS).toEqual(expected);
    expect(catalog.BACKGROUND_SKINS).toEqual(expected);
    expect(catalog.getOwnedBackgroundSkins(window)).toEqual(expected);
    expect(catalog.isBackgroundSkinOwned(window, 'default-25')).toBe(true);
    expect(catalog.getAllBackgroundSkins(window).filter((skin: { id: string }) => !skin.id.startsWith('gacha__')))
      .toEqual(expected);
  });

  test('still adds and selects a background unlocked through gacha', () => {
    const storage = require('../ui/storage/gacha-progress.ts');
    (window as any).GachaProgressStorageModule = storage;
    const skinId = 'gacha__n__background_skin__観測できなかった夜';
    (window as any).ObservationGachaCatalogModule = {
      getCatalog: () => ({ items: [{
        id: skinId,
        kind: 'background_skin',
        label: '観測できなかった夜',
        imagePath: 'assets/images/Gacha/N/観測できなかった夜.png'
      }] })
    };
    const catalog = require('../ui/background-skin/catalog.ts');

    expect(catalog.normalizeBackgroundSkinId(skinId, window)).toBe('default-25');
    storage.applyPullResults(window, [{ item: { id: skinId, kind: 'background_skin' } }]);

    expect(catalog.BASE_BACKGROUND_SKINS).toHaveLength(1);
    expect(catalog.getOwnedBackgroundSkins(window).map((skin: { id: string }) => skin.id))
      .toEqual(['default-25', skinId]);
    expect(catalog.normalizeBackgroundSkinId(skinId, window)).toBe(skinId);
    expect(catalog.getBackgroundSkinDefinition(skinId, window)?.id).toBe(skinId);
  });
});
