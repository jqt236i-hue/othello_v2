import { JSDOM } from 'jsdom';
import { installFakeCustomSkinBrowser } from './helpers/fake-custom-skin-browser';

describe('custom skin object URL leases', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/game/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('waits for the final lease before revoking replaced and deleted object URLs', async () => {
    const browser = installFakeCustomSkinBrowser(dom.window as unknown as Window);
    const storage = require('../ui/custom-skin/storage.ts');
    const firstBlob = new Blob(['first-board-image'], { type: 'image/png' });
    const first = await storage.saveCustomSkin(window, {
      kind: 'board',
      label: '最初の盤面',
      boardImage: firstBlob
    });
    const firstLease = storage.acquireCustomSkinObjectUrlLease(window, first.id, [first.imagePath]);
    const parallelFirstLease = storage.acquireCustomSkinObjectUrlLease(window, first.id, [first.imagePath]);
    const secondBlob = new Blob(['second-board-image'], { type: 'image/png' });
    const second = await storage.saveCustomSkin(window, {
      id: first.id,
      kind: 'board',
      label: '更新した盤面',
      boardImage: secondBlob
    });

    expect(second.imagePath).not.toBe(first.imagePath);
    expect(browser.revokedUrls).toEqual([]);
    expect(storage.getCustomSkinObjectUrlLeaseDiagnostics(window)).toEqual({
      activeLeaseCount: 2,
      retainedUrlCount: 2,
      pendingRevokeCount: 1
    });
    expect(() => storage.acquireCustomSkinObjectUrlLease(window, first.id, [first.imagePath]))
      .toThrow(expect.objectContaining({ code: 'object-url-stale' }));

    expect(firstLease.release()).toBe(true);
    expect(firstLease.release()).toBe(false);
    expect(browser.revokedUrls).toEqual([]);
    expect(parallelFirstLease.release()).toBe(true);
    expect(browser.revokedUrls).toEqual([first.imagePath]);

    const secondLease = storage.acquireCustomSkinObjectUrlLease(window, second.id, [second.imagePath]);
    await expect(storage.deleteCustomSkin(window, second.id)).resolves.toBe(true);
    expect(browser.revokedUrls).toEqual([first.imagePath]);
    expect(storage.getCustomSkinObjectUrlLeaseDiagnostics(window)).toEqual({
      activeLeaseCount: 1,
      retainedUrlCount: 1,
      pendingRevokeCount: 1
    });

    expect(secondLease.release()).toBe(true);
    expect(browser.revokedUrls).toEqual([first.imagePath, second.imagePath]);
    expect(storage.getCustomSkinObjectUrlLeaseDiagnostics(window)).toEqual({
      activeLeaseCount: 0,
      retainedUrlCount: 0,
      pendingRevokeCount: 0
    });
  });

  test('keeps byte-content fingerprints stable across object URL generations', async () => {
    installFakeCustomSkinBrowser(dom.window as unknown as Window);
    const storage = require('../ui/custom-skin/storage.ts');
    const first = await storage.saveCustomSkin(window, {
      kind: 'board',
      boardImage: new Blob(['same-image-content'], { type: 'image/png' })
    });
    const updated = await storage.saveCustomSkin(window, {
      id: first.id,
      kind: 'board',
      boardImage: new Blob(['same-image-content'], { type: 'image/png' })
    });
    const changed = await storage.saveCustomSkin(window, {
      id: first.id,
      kind: 'board',
      boardImage: new Blob(['different-image-content'], { type: 'image/png' })
    });

    expect(updated.imagePath).not.toBe(first.imagePath);
    expect(updated.contentFingerprint).toBe(first.contentFingerprint);
    expect(changed.contentFingerprint).not.toBe(first.contentFingerprint);
  });

  test('DOM board runtime swaps first and releases the previous display lease afterwards', async () => {
    const browser = installFakeCustomSkinBrowser(dom.window as unknown as Window);
    const storage = require('../ui/custom-skin/storage.ts');
    (window as any).CustomSkinStorageModule = storage;
    const runtime = require('../ui/board-skin/runtime.ts');
    const first = await storage.saveCustomSkin(window, {
      kind: 'board',
      boardImage: new Blob(['first'], { type: 'image/png' })
    });

    runtime.syncDisplayedBoardSkin(window, first.id);
    const second = await storage.saveCustomSkin(window, {
      id: first.id,
      kind: 'board',
      boardImage: new Blob(['second'], { type: 'image/png' })
    });
    expect(browser.revokedUrls).toEqual([]);

    runtime.syncDisplayedBoardSkin(window, second.id);
    expect(document.documentElement.style.getPropertyValue('--board-surface-texture-image'))
      .toBe(`url("${second.imagePath}")`);
    expect(browser.revokedUrls).toEqual([first.imagePath]);
    expect(storage.getCustomSkinObjectUrlLeaseDiagnostics(window).activeLeaseCount).toBe(1);

    runtime.releaseAppliedBoardSkinLeases(window);
    expect(storage.getCustomSkinObjectUrlLeaseDiagnostics(window).activeLeaseCount).toBe(0);
  });
});
