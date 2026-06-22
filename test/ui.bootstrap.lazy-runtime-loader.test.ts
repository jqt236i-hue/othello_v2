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
    const loader = createLazyRuntimeLoader({
      root: {
        __restoreCardReversiOptionalBootEntries: restoreOptionalBootEntries
      },
      optionalRegistrySrc: 'public/module-registry.optional.js',
      onnxRuntimeSrc: 'node_modules/onnxruntime-web/dist/ort.min.js',
      loadScript: async (src: string) => {
        loadedScripts.push(src);
      }
    });

    await loader.load('gacha');
    await loader.load('commentary');
    await loader.load('gacha');

    expect(loadedScripts).toEqual(['public/module-registry.optional.js']);
    expect(restoreOptionalBootEntries).toHaveBeenCalledTimes(1);
    expect(loader.isLoaded('gacha')).toBe(true);
    expect(loader.isLoaded('commentary')).toBe(true);
    expect(loader.isLoaded('onnx')).toBe(false);

    await loader.load('onnx');

    expect(loadedScripts).toEqual([
      'public/module-registry.optional.js',
      'node_modules/onnxruntime-web/dist/ort.min.js'
    ]);
    expect(restoreOptionalBootEntries).toHaveBeenCalledTimes(1);
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
});
