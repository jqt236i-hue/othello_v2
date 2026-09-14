import { JSDOM } from 'jsdom';
import { installFakeCustomSkinBrowser } from './helpers/fake-custom-skin-browser';

describe('Pixi appearance resolver', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'https://example.test/game/index.html'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('resolves catalog paths against document.baseURI and keeps revisions content-stable', () => {
    const resolver = require('../ui/pixi/appearance-resolver.ts');
    const selection = {
      boardSkinId: 'bluegreen-felt',
      boardFrameSkinId: 'marsh-forged-iron',
      stoneSkinId: 'jade-rim'
    };
    const first = resolver.resolveBoardAppearanceResources(window, selection);
    const second = resolver.resolveBoardAppearanceResources(window, selection);
    const changed = resolver.resolveBoardAppearanceResources(window, {
      ...selection,
      stoneSkinId: 'o-stone'
    });

    expect(first.descriptor.boardImageUrl).toBe(
      'https://example.test/game/assets/images/board/board-surface-bluegreen-felt-v1.png'
    );
    expect(first.descriptor.blackStoneImageUrl).toBe(
      'https://example.test/game/assets/images/stone-skin/jade-rim/black.png'
    );
    expect(first.descriptor.revision).toBe(second.descriptor.revision);
    expect(first.contentFingerprint).toBe(second.contentFingerprint);
    expect(changed.descriptor.revision).not.toBe(first.descriptor.revision);
    expect(first.resources.every((resource: any) => resource.sourceBlob === null)).toBe(true);
  });

  test('rejects CSS url() text instead of reparsing it', () => {
    const resolver = require('../ui/pixi/appearance-resolver.ts');

    expect(() => resolver.resolveAppearanceAssetUrl('url("assets/board.png")', document.baseURI))
      .toThrow(expect.objectContaining({ code: 'appearance-css-url-unsupported' }));
  });

  test('preserves custom source Blobs and holds their URLs through one combined display/GPU lease', async () => {
    const browser = installFakeCustomSkinBrowser(dom.window as unknown as Window);
    const storage = require('../ui/custom-skin/storage.ts');
    const boardBlob = new Blob(['custom-board'], { type: 'image/png' });
    const blackBlob = new Blob(['custom-black'], { type: 'image/png' });
    const whiteBlob = new Blob(['custom-white'], { type: 'image/png' });
    const board = await storage.saveCustomSkin(window, { kind: 'board', boardImage: boardBlob });
    const stone = await storage.saveCustomSkin(window, {
      kind: 'stone',
      blackImage: blackBlob,
      whiteImage: whiteBlob
    });
    const resolver = require('../ui/pixi/appearance-resolver.ts');
    const resolved = resolver.resolveBoardAppearanceResources(window, {
      boardSkinId: board.id,
      boardFrameSkinId: 'marsh-forged-iron',
      stoneSkinId: stone.id
    });

    expect(resolved.descriptor.boardImageUrl).toBe(board.imagePath);
    expect(resolved.descriptor.blackStoneImageUrl).toBe(stone.blackImagePath);
    expect(resolved.resources.map((resource: any) => resource.sourceBlob)).toEqual([
      boardBlob,
      blackBlob,
      whiteBlob
    ]);

    const lease = resolver.acquireBoardAppearanceObjectUrlLease(window, resolved);
    const updated = await storage.saveCustomSkin(window, {
      id: board.id,
      kind: 'board',
      boardImage: new Blob(['updated-board'], { type: 'image/png' })
    });
    expect(browser.revokedUrls).toEqual([]);
    expect(lease.urls).toEqual([board.imagePath, stone.blackImagePath, stone.whiteImagePath]);

    expect(lease.release()).toBe(true);
    expect(lease.release()).toBe(false);
    expect(browser.revokedUrls).toEqual([board.imagePath]);
    expect(updated.imagePath).not.toBe(board.imagePath);
  });

  test('uses the pure visual effects map for special-stone image descriptors', () => {
    const resolver = require('../ui/pixi/appearance-resolver.ts');

    const resource = resolver.resolveSpecialStoneAppearanceResource(window, 'TIME_STOP', 'black');

    expect(resource).toEqual(expect.objectContaining({
      role: 'special-stone',
      url: 'https://example.test/game/assets/images/special-stones/TIME_STOP-black.png',
      sourceBlob: null
    }));
    expect(resolver.resolveSpecialStoneAppearanceResource(window, 'SHINRA_BANSHO_GOD', 'white')).toEqual(
      expect.objectContaining({
        role: 'special-stone',
        url: 'https://example.test/game/assets/images/special-stones/SHINRA_BANSHO_GOD-white.png',
        sourceBlob: null
      })
    );
  });

  test('keeps committed special visuals separate from placement-only pending effects', () => {
    const resolver = require('../ui/pixi/appearance-resolver.ts');

    expect(resolver.resolveSpecialStoneAppearanceResource(
      window,
      'ULTIMATE_REVERSE_DRAGON',
      'white'
    )).toBeNull();
    expect(resolver.resolveSpecialStoneAppearanceResource(window, 'FREEZE', 'black')).toEqual(
      expect.objectContaining({
        role: 'special-stone',
        url: 'https://example.test/game/assets/images/other/ICE.png'
      })
    );
    expect(resolver.resolveSpecialStoneAppearanceResource(window, 'SEED', 'black')).toEqual(
      expect.objectContaining({
        role: 'special-stone',
        url: 'https://example.test/game/assets/images/other/seed.png'
      })
    );
    expect(resolver.resolveSpecialStoneAppearanceResource(window, 'BLOCKADE', 'white')).toEqual(
      expect.objectContaining({
        role: 'special-stone',
        url: 'https://example.test/game/assets/images/other/X.png'
      })
    );
  });
});
