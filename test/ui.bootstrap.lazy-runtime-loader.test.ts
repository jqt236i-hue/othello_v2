import { JSDOM } from 'jsdom';

describe('lazy runtime loader', () => {
  afterEach(() => {
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).loadLazyRuntimeGroup;
    delete (global as any).LazyRuntimeLoaderModule;
  });

  test('loads optional registry once and defers ONNX script to the ONNX group', async () => {
    jest.resetModules();
    const { createLazyRuntimeLoader } = require('../ui/bootstrap/lazy-runtime-loader');
    const loadedScripts: string[] = [];
    const restoreOptionalBootEntries = jest.fn();
    const configureOthelloRuntime = jest.fn();
    const configurePolicyRuntime = jest.fn();
    const root = {
      __restoreCardReversiOptionalBootEntries: restoreOptionalBootEntries,
      ort: null as any,
      require: jest.fn((moduleKey: string) => {
        if (moduleKey === 'game/ai/othello-onnx-runtime') return { configure: configureOthelloRuntime };
        if (moduleKey === 'game/ai/policy-onnx-runtime') return { configure: configurePolicyRuntime };
        throw new Error(`unexpected module: ${moduleKey}`);
      })
    };
    const loader = createLazyRuntimeLoader({
      root,
      optionalRegistrySrc: 'public/module-registry.optional.js',
      onnxRuntimeSrc: 'node_modules/onnxruntime-web/dist/ort.min.js',
      loadScript: async (src: string) => {
        loadedScripts.push(src);
        if (src === 'node_modules/onnxruntime-web/dist/ort.min.js') {
          root.ort = { Tensor: function Tensor() {} };
        }
      }
    });

    await loader.load('gacha');
    await loader.load('cosmetic');
    await loader.load('leaderboard');
    await loader.load('commentary');
    await loader.load('gacha');

    expect(loadedScripts).toEqual(['public/module-registry.optional.js']);
    expect(restoreOptionalBootEntries).toHaveBeenCalledTimes(1);
    expect(loader.isLoaded('gacha')).toBe(true);
    expect(loader.isLoaded('cosmetic')).toBe(true);
    expect(loader.isLoaded('leaderboard')).toBe(true);
    expect(loader.isLoaded('commentary')).toBe(true);
    expect(loader.isLoaded('onnx')).toBe(false);

    await loader.load('onnx');

    expect(loadedScripts).toEqual([
      'public/module-registry.optional.js',
      'node_modules/onnxruntime-web/dist/ort.min.js'
    ]);
    expect(restoreOptionalBootEntries).toHaveBeenCalledTimes(1);
    expect(configureOthelloRuntime).toHaveBeenCalledWith({ ortApi: root.ort });
    expect(configurePolicyRuntime).toHaveBeenCalledWith({ ortApi: root.ort });
    expect(loader.isLoaded('onnx')).toBe(true);
  });

  test('does not mark ONNX loaded when the runtime script exposes no API', async () => {
    jest.resetModules();
    const { createLazyRuntimeLoader } = require('../ui/bootstrap/lazy-runtime-loader');
    const root = {
      __restoreCardReversiOptionalBootEntries: jest.fn(),
      require: jest.fn()
    };
    const loader = createLazyRuntimeLoader({ root, loadScript: jest.fn(async () => undefined) });

    await expect(loader.load('onnx')).rejects.toThrow('without exposing window.ort');
    expect(loader.isLoaded('onnx')).toBe(false);
    expect(loader.getLastError('onnx')).toBeInstanceOf(Error);
    expect(root.require).not.toHaveBeenCalled();
  });

  test('skips main-thread ORT when a Vite Worker executor was installed by the group adapter', async () => {
    jest.resetModules();
    const { createLazyRuntimeLoader } = require('../ui/bootstrap/lazy-runtime-loader');
    const loadScript = jest.fn(async () => undefined);
    const loadGroup = jest.fn(async () => undefined);
    const root = { require: jest.fn() };
    const loader = createLazyRuntimeLoader({
      root,
      loadScript,
      loadGroup,
      shouldLoadMainThreadOnnxRuntime: () => false
    });

    await expect(loader.load('onnx')).resolves.toBe(true);
    expect(loadGroup).toHaveBeenCalledWith('onnx');
    expect(loadScript).not.toHaveBeenCalled();
    expect(root.require).not.toHaveBeenCalled();
    expect(loader.isLoaded('onnx')).toBe(true);
  });

  test('default loader exposes browser globals', async () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/index.html?v=1'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const mod = require('../ui/bootstrap/lazy-runtime-loader');

    expect((global as any).loadLazyRuntimeGroup).toBe(mod.loadLazyRuntimeGroup);
    expect((global as any).LazyRuntimeLoaderModule).toBe(mod);
  });

  test('deduplicates an in-flight feature load and restores only that group', async () => {
    jest.resetModules();
    const { createLazyRuntimeLoader } = require('../ui/bootstrap/lazy-runtime-loader');
    let release: (() => void) | null = null;
    const loadGroup = jest.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const restore = jest.fn();
    const loader = createLazyRuntimeLoader({
      root: { __restoreCardReversiOptionalBootEntries: restore },
      loadGroup
    });

    const first = loader.load('gacha');
    const second = loader.load('gacha');
    expect(first).toBe(second);
    expect(loadGroup).toHaveBeenCalledTimes(1);
    release!();
    await expect(first).resolves.toBe(true);
    expect(restore).not.toHaveBeenCalled();
    await loader.load('gacha');
    expect(loadGroup).toHaveBeenCalledTimes(1);
  });

  test('evicts a failed aggregate registry promise so the next action can retry', async () => {
    jest.resetModules();
    const { createLazyRuntimeLoader } = require('../ui/bootstrap/lazy-runtime-loader');
    const restore = jest.fn();
    let attempt = 0;
    const loader = createLazyRuntimeLoader({
      root: { __restoreCardReversiOptionalBootEntries: restore },
      loadScript: jest.fn(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('transient registry failure');
      })
    });

    await expect(loader.load('gacha')).rejects.toThrow('transient registry failure');
    expect(loader.isLoaded('gacha')).toBe(false);
    expect(loader.getLastError('gacha')).toBeInstanceOf(Error);
    await expect(loader.load('gacha')).resolves.toBe(true);
    expect(attempt).toBe(2);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  test('rejects unknown groups instead of silently loading CPU code', async () => {
    jest.resetModules();
    const { createLazyRuntimeLoader } = require('../ui/bootstrap/lazy-runtime-loader');
    const loadScript = jest.fn();
    const loader = createLazyRuntimeLoader({ root: {}, loadScript });

    await expect(loader.load('typo-group')).rejects.toThrow('unknown lazy runtime group');
    expect(loadScript).not.toHaveBeenCalled();
  });
});
