import catalog = require('../ui/hand-mat-skin/catalog');
import selection = require('../ui/hand-mat-skin/selection');
import runtime = require('../ui/hand-mat-skin/runtime');
import controller = require('../ui/hand-mat-skin/controller');
const { JSDOM } = require('jsdom');

const IDS = ['espresso-leather', 'walnut-felt', 'scholars-oxblood', 'midnight-bookcloth'];
const LABELS = ['濃茶の革マット', '木枠とフェルト', '赤茶革の書斎マット', '青緑の布マット（既定）'];
const DEFAULT_ID = 'midnight-bookcloth';
const KEY = 'reversi.handMatSkin';
const LEGACY_KEY = 'othello.handMatSkin';

function createStorage(initial: Record<string, string> = {}) {
  const values = { ...initial };
  return {
    values,
    getItem: jest.fn((key: string) => values[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { values[key] = value; })
  };
}

function createFixture(initial: Record<string, string> = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="handMatSkinOptions"></div><div id="hand" style="left: 4px"></div><div id="board">board</div></body></html>');
  const storage = createStorage(initial);
  const root = { document: dom.window.document, localStorage: storage };
  return { dom, root, storage, document: dom.window.document as Document };
}

describe('手札置き catalog', () => {
  test('always exposes precisely four standard choices without ownership/custom dependencies', () => {
    const root = {
      CosmeticCatalogSharedModule: { createOwnedCosmeticCatalogApi: jest.fn(() => { throw new Error('unused'); }) },
      CustomSkinStorageModule: { getCustomSkinDefinitions: jest.fn(() => [{ id: 'custom' }]) }
    };
    const skins = catalog.getAllHandMatSkins(root);
    expect(skins.map((skin) => skin.id)).toEqual(IDS);
    expect(skins.map((skin) => skin.label)).toEqual(LABELS);
    expect(skins.map((skin) => skin.note)).toEqual(Array(4).fill('初期所持'));
    skins.forEach((skin) => expect(skin.imagePath).toBe(`assets/images/ui/card-area-${skin.id}-v1.webp`));
    expect(root.CustomSkinStorageModule.getCustomSkinDefinitions).not.toHaveBeenCalled();
    expect(root.CosmeticCatalogSharedModule.createOwnedCosmeticCatalogApi).not.toHaveBeenCalled();
    expect(Object.isFrozen(catalog.BASE_HAND_MAT_SKINS)).toBe(true);
    skins[0].label = 'changed';
    expect(catalog.getHandMatSkinDefinition(IDS[0]).label).toBe(LABELS[0]);
  });

  test.each(IDS)('accepts %s with optional root', (id) => {
    expect(catalog.normalizeHandMatSkinId(` ${id} `)).toBe(id);
    expect(catalog.getHandMatSkinDefinition(id, {}).id).toBe(id);
  });

  test.each([null, undefined, '', 'unknown', 'custom', 42, {}, { toString: () => IDS[1] }])('invalid input %p selects the default', (value) => {
    expect(catalog.normalizeHandMatSkinId(value)).toBe(DEFAULT_ID);
    expect(catalog.getHandMatSkinDefinition(value).id).toBe(DEFAULT_ID);
  });
});

describe('手札置き storage', () => {
  test.each(IDS)('writes both keys and restores %s', (id) => {
    const root = { localStorage: createStorage() };
    expect(selection.writeStoredHandMatSkinId(root, id)).toBe(true);
    expect(root.localStorage.setItem.mock.calls).toEqual([[KEY, id], [LEGACY_KEY, id]]);
    expect(selection.readStoredHandMatSkinId(root)).toBe(id);
    expect(selection.readStoredHandMatSkinId({ localStorage: createStorage({ [LEGACY_KEY]: id }) })).toBe(id);
  });

  test('current key wins, invalid stored/write values normalize to default without repairing on read', () => {
    const localStorage = createStorage({ [KEY]: 'invalid', [LEGACY_KEY]: IDS[2] });
    const root = { localStorage };
    expect(selection.readStoredHandMatSkinId(root)).toBe(DEFAULT_ID);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(selection.writeStoredHandMatSkinId(root, null)).toBe(true);
    expect(localStorage.values).toEqual({ [KEY]: DEFAULT_ID, [LEGACY_KEY]: DEFAULT_ID });
  });

  test.each([null, {}, { localStorage: null }, {
    get localStorage(): never { throw new Error('denied'); }
  }, {
    localStorage: { getItem() { throw new Error('read denied'); }, setItem() { throw new Error('quota'); } }
  }])('storage unavailable/throwing is safe (%#)', (root) => {
    expect(selection.readStoredHandMatSkinId(root)).toBe(DEFAULT_ID);
    expect(selection.writeStoredHandMatSkinId(root, IDS[1])).toBe(false);
  });
});

describe('手札置き runtime/controller', () => {
  test('runtime changes only the document-root image token and identifier, without image loading', () => {
    const f = createFixture();
    try {
      const bodyBefore = f.document.body.outerHTML;
      f.document.documentElement.style.setProperty('--existing', 'keep');
      expect(runtime.syncDisplayedHandMatSkin(f.root, IDS[3])?.id).toBe(IDS[3]);
      expect(f.document.documentElement.style.getPropertyValue('--hand-mat-image')).toBe(`url("assets/images/ui/card-area-${IDS[3]}-v1.webp")`);
      expect(f.document.documentElement.getAttribute('data-hand-mat-skin-id')).toBe(IDS[3]);
      expect(f.document.documentElement.style.getPropertyValue('--existing')).toBe('keep');
      expect(f.document.body.outerHTML).toBe(bodyBefore);
      expect(runtime.syncDisplayedHandMatSkin(f.root, null)?.id).toBe(DEFAULT_ID);
      expect(runtime.syncDisplayedHandMatSkin({}, IDS[0])).toBeNull();
    } finally { f.dom.window.close(); }
  });

  test('renders four image/label radios; every click saves, updates ARIA and survives recreation', () => {
    const f = createFixture();
    try {
      const api = controller.setupHandMatSkinControls({ root: f.root })!;
      expect(api.getSelectedSkinId()).toBe(DEFAULT_ID);
      expect(f.storage.setItem).not.toHaveBeenCalled();
      const buttons = Array.from(f.document.querySelectorAll<HTMLButtonElement>('.hand-mat-skin-option'));
      expect(buttons).toHaveLength(4);
      buttons.forEach((button, i) => {
        expect(button.getAttribute('role')).toBe('radio');
        expect(button.getAttribute('data-hand-mat-skin-id')).toBe(IDS[i]);
        expect(button.getAttribute('aria-label')).toBe('手札置き ' + LABELS[i]);
        expect(button.querySelector('img')!.getAttribute('src')).toBe(`assets/images/ui/card-area-${IDS[i]}-v1.webp`);
        expect(button.querySelector('.hand-mat-skin-option-label')!.textContent).toBe(LABELS[i]);
        button.click();
        expect(api.getSelectedSkinId()).toBe(IDS[i]);
        expect(f.storage.values).toEqual({ [KEY]: IDS[i], [LEGACY_KEY]: IDS[i] });
        expect(button.getAttribute('aria-checked')).toBe('true');
        expect(button.classList.contains('is-selected')).toBe(true);
        expect(f.document.querySelectorAll('[role="radio"][aria-checked="true"]')).toHaveLength(1);
      });
      f.storage.setItem.mockClear();
      const restored = controller.setupHandMatSkinControls({ root: f.root })!;
      expect(restored.getSelectedSkinId()).toBe(IDS[3]);
      restored.refreshOptions();
      expect(restored.getSelectedSkinId()).toBe(IDS[3]);
      restored.refreshOptions('invalid');
      expect(restored.getSelectedSkinId()).toBe(DEFAULT_ID);
      expect(f.storage.setItem).not.toHaveBeenCalled();
      expect(restored.selectSkin(null)?.id).toBe(DEFAULT_ID);
      expect(f.storage.values[KEY]).toBe(DEFAULT_ID);
    } finally { f.dom.window.close(); }
  });

  test.each([{ [KEY]: IDS[2] }, { [LEGACY_KEY]: IDS[1] }, { [KEY]: 'invalid' }])('initializes from saved values without writes: %p', (saved) => {
    const f = createFixture(saved);
    try {
      const api = controller.setupHandMatSkinControls({ root: f.root })!;
      expect(api.getSelectedSkinId()).toBe(catalog.normalizeHandMatSkinId(saved[KEY] || saved[LEGACY_KEY]));
      expect(f.storage.setItem).not.toHaveBeenCalled();
    } finally { f.dom.window.close(); }
  });

  test('honors document/options and module injection; selection remains usable on storage errors', () => {
    const f = createFixture();
    try {
      const read = jest.fn(() => IDS[2]);
      const write = jest.fn(() => false);
      const sync = jest.fn();
      const root = {
        HandMatSkinCatalogModule: catalog,
        HandMatSkinSelectionModule: { readStoredHandMatSkinId: read, writeStoredHandMatSkinId: write },
        HandMatSkinRuntimeModule: { syncDisplayedHandMatSkin: sync }
      };
      const container = f.document.createElement('div');
      const api = controller.setupHandMatSkinControls({ root, document: f.document, optionsEl: container })!;
      expect(container.children).toHaveLength(4);
      expect(api.getSelectedSkinId()).toBe(IDS[2]);
      expect(write).not.toHaveBeenCalled();
      expect(api.selectSkin(IDS[1])?.id).toBe(IDS[1]);
      expect(sync).toHaveBeenLastCalledWith(root, IDS[1]);
      expect(write).toHaveBeenLastCalledWith(root, IDS[1]);
      const deniedRoot = { document: f.document, get localStorage(): never { throw new Error('denied'); } };
      const deniedApi = controller.setupHandMatSkinControls({ root: deniedRoot })!;
      expect(deniedApi.getSelectedSkinId()).toBe(DEFAULT_ID);
      expect(deniedApi.selectSkin(IDS[3])?.id).toBe(IDS[3]);
      expect(deniedApi.getSelectedSkinId()).toBe(IDS[3]);
      f.document.getElementById('handMatSkinOptions')!.remove();
      expect(controller.setupHandMatSkinControls({ root: deniedRoot })).toBeNull();
    } finally { f.dom.window.close(); }
  });
});
