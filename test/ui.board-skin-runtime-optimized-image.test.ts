import { JSDOM } from 'jsdom';

const DEFAULT_FRAME_PNG =
  'assets/images/board/board-frame-marsh-forged-iron-v1.png';
const DEFAULT_FRAME_WEBP =
  'assets/images/board/board-frame-marsh-forged-iron-v1.webp';

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
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('applies the admitted WebP Blob URL through the frame display path', async () => {
    const runtime = require('../ui/board-skin/runtime.ts');

    await expect(runtime.prepareBoardFrameSkin(window, 'marsh-forged-iron'))
      .resolves.toMatchObject({ id: 'marsh-forged-iron' });

    expect(resolveOptimizedImagePath).toHaveBeenCalledTimes(1);
    expect(resolveOptimizedImagePath).toHaveBeenCalledWith(
      window,
      DEFAULT_FRAME_PNG,
      { [DEFAULT_FRAME_PNG]: DEFAULT_FRAME_WEBP }
    );
    expect(document.documentElement.style.getPropertyValue('--board-frame-image'))
      .toBe('url("blob:admitted-frame-webp")');
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe('url("blob:admitted-frame-webp")');
    expect(document.documentElement.getAttribute('data-board-frame-skin-id'))
      .toBe('marsh-forged-iron');
  });

  test('applies PNG exactly once when the common codec returns its fallback', async () => {
    resolveOptimizedImagePath.mockResolvedValue(DEFAULT_FRAME_PNG);
    const runtime = require('../ui/board-skin/runtime.ts');

    await runtime.prepareBoardFrameSkin(window, 'marsh-forged-iron');

    expect(resolveOptimizedImagePath).toHaveBeenCalledTimes(1);
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe(`url("${DEFAULT_FRAME_PNG}")`);
  });

  test('does not let an older optimized completion overwrite a newer frame', async () => {
    const optimizedReady = deferred<string>();
    resolveOptimizedImagePath.mockReturnValue(optimizedReady.promise);
    const runtime = require('../ui/board-skin/runtime.ts');

    const defaultReady = runtime.prepareBoardFrameSkin(window, 'marsh-forged-iron');
    runtime.applyBoardFrameSkin(window, 'submerged-wood');
    await runtime.waitForPendingBoardFrameSkin(window);
    optimizedReady.resolve('blob:stale-frame-webp');

    await expect(defaultReady).resolves.toBeNull();
    expect(document.documentElement.getAttribute('data-board-frame-skin-id'))
      .toBe('submerged-wood');
    expect(document.getElementById('board-frame')!.style.getPropertyValue('--board-frame-image'))
      .toBe('url("assets/images/board/board-frame-submerged-wood-v1.png")');
  });

  test('invalidates an optimized completion when display leases are released', async () => {
    const optimizedReady = deferred<string>();
    resolveOptimizedImagePath.mockReturnValue(optimizedReady.promise);
    const runtime = require('../ui/board-skin/runtime.ts');

    const defaultReady = runtime.prepareBoardFrameSkin(window, 'marsh-forged-iron');
    runtime.releaseAppliedBoardSkinLeases(window);
    optimizedReady.resolve('blob:released-frame-webp');

    await expect(defaultReady).resolves.toBeNull();
    expect(document.documentElement.style.getPropertyValue('--board-frame-image')).toBe('');
  });
});
