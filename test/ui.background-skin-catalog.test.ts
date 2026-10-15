import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

const BACKGROUNDS = [
  { id: 'default-25', label: '既定', note: '初期所持', imagePath: 'assets/images/background/デフォルト25.webp' },
  ...[
    ['midnight-teal', '青緑ミニマル'],
    ['classic-walnut', 'クラシック木製'],
    ['quiet-slate', '静かな石造り']
  ].map(([name, label]) => ({
    id: `default-${name}`, label, note: '初期所持',
    imagePath: `assets/images/background/background-default-${name}-v1.webp`
  }))
];

describe('background skin catalog', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="backgroundSkinOptions"></div></body></html>', { url: 'https://example.test/' });
    global.window = dom.window as unknown as Window & typeof globalThis;
    global.localStorage = dom.window.localStorage;
    (window as any).GachaProgressStorageModule = require('../ui/storage/gacha-progress.ts');
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).localStorage;
  });

  test('keeps the current default and adds three initially owned backgrounds', () => {
    const storage = require('../ui/storage/gacha-progress.ts');
    (window as any).GachaProgressStorage = storage;
    (window as any).GachaProgressStorageModule = storage;
    const catalog = require('../ui/background-skin/catalog.ts');
    const expected = BACKGROUNDS;

    expect(catalog.DEFAULT_BACKGROUND_SKIN_ID).toBe('default-25');
    expect(catalog.BASE_BACKGROUND_SKINS).toEqual(expected);
    expect(catalog.BACKGROUND_SKINS).toEqual(expected);
    expect(catalog.getOwnedBackgroundSkins(window)).toEqual(expected);
    expected.forEach((skin) => {
      expect(catalog.isBackgroundSkinOwned(window, skin.id)).toBe(true);
      expect(catalog.normalizeBackgroundSkinId(skin.id, window)).toBe(skin.id);
    });
    expect(catalog.getAllBackgroundSkins(window).filter((skin: { id: string }) => !skin.id.startsWith('gacha__')))
      .toEqual(expected);
  });

  test.each(BACKGROUNDS)('saves and restores background $id after reinitialization', (skin) => {
    const controller = require('../ui/background-skin/controller.ts');
    const api = controller.setupBackgroundSkinControls({ root: window });
    const doc = dom.window.document;
    expect(Array.from(doc.querySelectorAll('.background-skin-option'))
      .map((button) => button.getAttribute('data-background-skin-id')))
      .toEqual(BACKGROUNDS.map((item) => item.id));

    (doc.querySelector(`[data-background-skin-id="${skin.id}"].background-skin-option`) as HTMLButtonElement).click();
    expect(api.getSelectedSkinId()).toBe(skin.id);
    ['reversi.backgroundSkin', 'othello.backgroundSkin'].forEach((key) => {
      expect(window.localStorage.getItem(key)).toBe(skin.id);
    });
    doc.body.removeAttribute('data-background-skin-id');
    doc.body.style.removeProperty('--selected-background-skin');
    doc.documentElement.removeAttribute('data-background-skin-id');
    doc.getElementById('backgroundSkinOptions')!.innerHTML = '';
    jest.resetModules();

    const restored = require('../ui/background-skin/controller.ts').setupBackgroundSkinControls({ root: window });
    expect(restored.getSelectedSkinId()).toBe(skin.id);
    expect(doc.documentElement.getAttribute('data-background-skin-id')).toBe(skin.id);
    expect(doc.body.getAttribute('data-background-skin-id')).toBe(skin.id);
    expect(doc.body.style.getPropertyValue('--selected-background-skin')).toBe(`url("${skin.imagePath}")`);
    expect(doc.querySelector(`[data-background-skin-id="${skin.id}"].background-skin-option`)
      ?.getAttribute('aria-checked')).toBe('true');
  });

  test.each(BACKGROUNDS.slice(1))('ships WebP and PNG source for $id', (skin) => {
    expect(fs.existsSync(path.join(__dirname, '..', skin.imagePath))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '..', skin.imagePath.replace(/\.webp$/, '.png')))).toBe(true);
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

    expect(catalog.BASE_BACKGROUND_SKINS).toHaveLength(4);
    expect(catalog.getOwnedBackgroundSkins(window).map((skin: { id: string }) => skin.id))
      .toEqual([...BACKGROUNDS.map((skin) => skin.id), skinId]);
    expect(catalog.normalizeBackgroundSkinId(skinId, window)).toBe(skinId);
    expect(catalog.getBackgroundSkinDefinition(skinId, window)?.id).toBe(skinId);
  });
});
