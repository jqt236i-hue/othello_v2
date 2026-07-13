import { JSDOM } from 'jsdom';

describe('custom skin storage and catalogs', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
    global.window = dom.window as unknown as Window & typeof globalThis;
    global.document = dom.window.document;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('normalizes custom skin labels and identifies scoped custom ids', () => {
    const storage = require('../ui/custom-skin/storage.ts');

    expect(storage.normalizeLabel('  星の盤  ')).toBe('星の盤');
    expect(storage.normalizeLabel('')).toBe('マイスキン');
    expect(storage.normalizeLabel('あいうえおかきくけこさしすせそたちつてとならにぬねの')).toHaveLength(24);
    expect(storage.isCustomSkin('custom:board:abc')).toBe(true);
    expect(storage.isCustomSkin('custom:board:abc', 'board')).toBe(true);
    expect(storage.isCustomSkin('custom:board:abc', 'stone')).toBe(false);
    expect(storage.isCustomSkin('board:abc')).toBe(false);
  });

  test('rejects unsupported image types before opening browser storage', async () => {
    const storage = require('../ui/custom-skin/storage.ts');
    const image = new Blob(['not-an-image'], { type: 'image/svg+xml' });

    await expect(storage.saveCustomSkin(window, {
      kind: 'background',
      backgroundImage: image
    })).rejects.toMatchObject({ code: 'image-type' });
  });

  test('requires both stone images', async () => {
    const storage = require('../ui/custom-skin/storage.ts');
    const image = new Blob(['image'], { type: 'image/png' });

    await expect(storage.saveCustomSkin(window, {
      kind: 'stone',
      blackImage: image
    })).rejects.toMatchObject({ code: 'image-required' });
  });

  test('appends hydrated custom definitions without changing fixed catalog ids', () => {
    const customDefinitions = {
      background: [{ id: 'custom:background:1', label: '夜空', note: '個人保存', imagePath: 'blob:bg' }],
      board: [{ id: 'custom:board:1', label: '星盤', note: '個人保存', imagePath: 'blob:board' }],
      'board-frame': [{ id: 'custom:board-frame:1', label: '星枠', note: '個人保存', imagePath: 'blob:frame' }],
      stone: [{ id: 'custom:stone:1', label: '月石', note: '個人保存', blackImagePath: 'blob:black', whiteImagePath: 'blob:white' }]
    };
    (window as any).CustomSkinStorageModule = {
      getCustomSkinDefinitions: (_root: Window, kind: keyof typeof customDefinitions) => customDefinitions[kind] || []
    };

    const backgroundCatalog = require('../ui/background-skin/catalog.ts');
    const boardCatalog = require('../ui/board-skin/catalog.ts');
    const stoneCatalog = require('../ui/stone-skin/catalog.ts');

    expect(backgroundCatalog.getBackgroundSkinDefinition('custom:background:1', window)).toEqual(expect.objectContaining({
      id: 'custom:background:1',
      imagePath: 'blob:bg'
    }));
    expect(boardCatalog.getBoardSkinDefinition('custom:board:1', window)).toEqual(expect.objectContaining({
      id: 'custom:board:1',
      imagePath: 'blob:board'
    }));
    expect(boardCatalog.getBoardFrameSkinDefinition('custom:board-frame:1', window)).toEqual(expect.objectContaining({
      id: 'custom:board-frame:1',
      imagePath: 'blob:frame'
    }));
    expect(stoneCatalog.getStoneSkinDefinition('custom:stone:1', window)).toEqual(expect.objectContaining({
      id: 'custom:stone:1',
      blackImagePath: 'blob:black',
      whiteImagePath: 'blob:white'
    }));
    expect(boardCatalog.getAllBoardSkins(window).map((skin: { id: string }) => skin.id).slice(-1)).toEqual(['custom:board:1']);
  });
});
