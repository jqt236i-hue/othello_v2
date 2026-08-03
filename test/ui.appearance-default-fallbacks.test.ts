import { JSDOM } from 'jsdom';

describe('appearance default fallbacks without catalog globals', () => {
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
    jest.dontMock('../ui/background-skin/catalog');
    jest.dontMock('../ui/board-skin/catalog');
    jest.dontMock('../ui/stone-skin/catalog');
  });

  test('uses the configured background default when the background catalog is unavailable', () => {
    jest.doMock('../ui/background-skin/catalog', () => {
      throw new Error('catalog unavailable');
    });
    const selection = require('../ui/background-skin/selection.ts');

    expect(selection.readStoredBackgroundSkinId(window)).toBe('default-25');
    expect(selection.writeStoredBackgroundSkinId(window, 'missing')).toBe(true);
    expect(window.localStorage.getItem(selection.BACKGROUND_SKIN_STORAGE_KEY)).toBe('default-25');
    expect(window.localStorage.getItem(selection.LEGACY_BACKGROUND_SKIN_STORAGE_KEY)).toBe('default-25');
  });

  test('migrates the old stored background default to the current background default', () => {
    const storage = require('../ui/storage/gacha-progress.ts');
    (window as any).GachaProgressStorage = storage;
    (window as any).GachaProgressStorageModule = storage;
    const selection = require('../ui/background-skin/selection.ts');
    window.localStorage.setItem(selection.BACKGROUND_SKIN_STORAGE_KEY, 'default');
    window.localStorage.setItem(selection.LEGACY_BACKGROUND_SKIN_STORAGE_KEY, 'default');

    expect(selection.readStoredBackgroundSkinId(window)).toBe('default-25');
    expect(window.localStorage.getItem(selection.BACKGROUND_SKIN_STORAGE_KEY)).toBe('default-25');
    expect(window.localStorage.getItem(selection.LEGACY_BACKGROUND_SKIN_STORAGE_KEY)).toBe('default-25');

    expect(selection.writeStoredBackgroundSkinId(window, 'default')).toBe(true);
    expect(selection.readStoredBackgroundSkinId(window)).toBe('default');
  });

  test('uses the configured board defaults when the board catalog is unavailable', () => {
    jest.doMock('../ui/board-skin/catalog', () => {
      throw new Error('catalog unavailable');
    });
    const selection = require('../ui/board-skin/selection.ts');

    expect(selection.readStoredBoardSkinId(window)).toBe('bluegreen-felt');
    expect(selection.writeStoredBoardSkinId(window, 'missing')).toBe(true);
    expect(window.localStorage.getItem(selection.BOARD_SKIN_STORAGE_KEY)).toBe('bluegreen-felt');
    expect(window.localStorage.getItem(selection.LEGACY_BOARD_SKIN_STORAGE_KEY)).toBe('bluegreen-felt');

    expect(selection.readStoredBoardFrameSkinId(window)).toBe('submerged-wood');
    expect(selection.writeStoredBoardFrameSkinId(window, 'missing')).toBe(true);
    expect(window.localStorage.getItem(selection.BOARD_FRAME_SKIN_STORAGE_KEY)).toBe('submerged-wood');
    expect(window.localStorage.getItem(selection.LEGACY_BOARD_FRAME_SKIN_STORAGE_KEY)).toBe('submerged-wood');
  });

  test('uses the configured stone default when the stone catalog is unavailable', () => {
    jest.doMock('../ui/stone-skin/catalog', () => {
      throw new Error('catalog unavailable');
    });
    const selection = require('../ui/stone-skin/selection.ts');
    const runtime = require('../ui/stone-skin/runtime.ts');

    expect(selection.readStoredStoneSkinId(window)).toBe('o-stone');
    expect(selection.writeStoredStoneSkinId(window, 'missing')).toBe(true);
    expect(window.localStorage.getItem(selection.STONE_SKIN_STORAGE_KEY)).toBe('o-stone');
    expect(window.localStorage.getItem(selection.LEGACY_STONE_SKIN_STORAGE_KEY)).toBe('o-stone');
    expect(runtime.getDefaultNormalStoneImagePath('black', window)).toBe('assets/images/stone-skin/o-stone/black.png');
    expect(runtime.getDefaultNormalStoneImagePath('white', window)).toBe('assets/images/stone-skin/o-stone/white.png');
  });

  test('migrates the old stored stone default to the current stone default', () => {
    const selection = require('../ui/stone-skin/selection.ts');
    window.localStorage.setItem(selection.STONE_SKIN_STORAGE_KEY, 'default');
    window.localStorage.setItem(selection.LEGACY_STONE_SKIN_STORAGE_KEY, 'default');

    expect(selection.readStoredStoneSkinId(window)).toBe('o-stone');
    expect(window.localStorage.getItem(selection.STONE_SKIN_STORAGE_KEY)).toBe('o-stone');
    expect(window.localStorage.getItem(selection.LEGACY_STONE_SKIN_STORAGE_KEY)).toBe('o-stone');

    expect(selection.writeStoredStoneSkinId(window, 'default')).toBe(true);
    expect(selection.readStoredStoneSkinId(window)).toBe('default');
  });
});
