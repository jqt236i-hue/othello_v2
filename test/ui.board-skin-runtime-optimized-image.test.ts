import { JSDOM } from 'jsdom';

// Synthetic candidate keeps codec behavior covered without restoring removed standard skins.
const CANDIDATE_FRAME_ID = 'test-optimized-frame';
const DEFAULT_FRAME_PNG = 'test-assets/frame.png';
const DEFAULT_FRAME_WEBP = 'test-assets/frame.webp';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('board frame optimized image runtime', () => {
  let dom: JSDOM;
  let resolveOptimizedImagePath: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><body>
      <div id="board-frame"></div>
    </body></html>`, { url: 'https://example.test/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    const catalog = require('../ui/board-skin/catalog.ts');
    (window as any).BoardSkinCatalogModule = {
      ...catalog,
      getBoardFrameSkinDefinition: (skinId: string, rootRef: Window) =>
        skinId === CANDIDATE_FRAME_ID
          ? { id: CANDIDATE_FRAME_ID, imagePath: DEFAULT_FRAME_PNG }
          : catalog.getBoardFrameSkinDefinition(skinId, rootRef)
    };
    jest.doMock('../ui/assets/optimized-ui-images.generated', () => ({
      OPTIMIZED_UI_IMAGES: { [DEFAULT_FRAME_PNG]: DEFAULT_FRAME_WEBP }
    }));
    resolveOptimizedImagePath = jest.fn(async () => 'blob:admitted-frame-webp');
    jest.doMock('../ui/assets/optimized-image-codec', () => ({
      getOptimizedImagePath: (
        sourcePath: string,
        mapping: Readonly<Record<string, string>>
      ) => mapping[sourcePath] || null,
      resolveOptimizedImagePath
    }));
  });

  afterEach(() => {
    jest.dontMock('../ui/assets/optimized-image-codec');
    jest.dontMock('../ui/assets/optimized-ui-images.generated');
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('applies the admitted WebP Blob URL through the frame display path', async () => {
    const runtime = require('../ui/board-skin/runtime.ts');

    await expect(runtime.prepareBoardFrameSkin(window, CANDIDATE_FRAME_ID))
      .resolves.toMatchObject({ id: CANDIDATE_FRAME_ID });

    expect(resolveOptimizedImagePath).toHaveBeenCalledTimes(1);
    expect(resolveOptimizedImagePath).toHaveBeenCalledWith(
      window,
      DEFAULT_FRAME_PNG,
      expect.objectContaining({ [DEFAULT_FRAME_PNG]: DEFAULT_FRAME_WEBP })
    );
    expect(document.documentElement.style.getPropertyValue('--board-frame-image'))
      .toBe('url("blob:admitted-frame-webp")');
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe('url("blob:admitted-frame-webp")');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id'))
      .toBe(CANDIDATE_FRAME_ID);
  });

  test('applies PNG exactly once when the common codec returns its fallback', async () => {
    resolveOptimizedImagePath.mockResolvedValue(DEFAULT_FRAME_PNG);
    const runtime = require('../ui/board-skin/runtime.ts');

    await runtime.prepareBoardFrameSkin(window, CANDIDATE_FRAME_ID);

    expect(resolveOptimizedImagePath).toHaveBeenCalledTimes(1);
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe(`url("${DEFAULT_FRAME_PNG}")`);
  });

  test('does not let an older optimized completion overwrite a newer frame', async () => {
    const optimizedReady = deferred<string>();
    resolveOptimizedImagePath.mockReturnValue(optimizedReady.promise);
    const runtime = require('../ui/board-skin/runtime.ts');

    const defaultReady = runtime.prepareBoardFrameSkin(window, CANDIDATE_FRAME_ID);
    runtime.applyBoardFrameSkin(window, 'submerged-wood');
    await runtime.waitForPendingBoardFrameSkin(window);
    optimizedReady.resolve('blob:stale-frame-webp');

    await expect(defaultReady).resolves.toBeNull();
    expect(document.documentElement.getAttribute('data-board-frame-skin-id'))
      .toBe('submerged-wood');
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe('url("assets/images/board/board-frame-submerged-wood-v1.webp")');
  });

  test('invalidates an optimized completion when display leases are released', async () => {
    const optimizedReady = deferred<string>();
    resolveOptimizedImagePath.mockReturnValue(optimizedReady.promise);
    const runtime = require('../ui/board-skin/runtime.ts');

    const defaultReady = runtime.prepareBoardFrameSkin(window, CANDIDATE_FRAME_ID);
    runtime.releaseAppliedBoardSkinLeases(window);
    optimizedReady.resolve('blob:released-frame-webp');

    await expect(defaultReady).resolves.toBeNull();
    expect(document.documentElement.style.getPropertyValue('--board-frame-image')).toBe('');
  });
});
