import { JSDOM } from 'jsdom';
import { installOptionalFeatureLoader } from '../browser-vite/optional-feature-loader';

describe('Vite optional feature loader', () => {
  test('loads only the requested dynamic adapter and keeps successful loads idempotent', async () => {
    jest.resetModules();
    const lazyRuntimeModule = require('../ui/bootstrap/lazy-runtime-loader');
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/vite-dist/index.vite.html'
    });
    const root: any = dom.window;
    root.LazyRuntimeLoaderModule = lazyRuntimeModule;
    const gachaLoad = jest.fn(async () => true);
    const cosmeticLoad = jest.fn(async () => true);
    const gachaImport = jest.fn(async () => ({ loadOptionalFeature: gachaLoad }));
    const cosmeticImport = jest.fn(async () => ({ loadOptionalFeature: cosmeticLoad }));

    const loader = installOptionalFeatureLoader({
      root,
      document: root.document,
      featureImports: {
        gacha: gachaImport,
        cosmetic: cosmeticImport
      }
    });
    const capturedByHandler = root.loadLazyRuntimeGroup;
    await Promise.all([capturedByHandler('gacha'), capturedByHandler('gacha')]);
    await capturedByHandler('gacha');

    expect(gachaImport).toHaveBeenCalledTimes(1);
    expect(gachaLoad).toHaveBeenCalledTimes(1);
    expect(cosmeticImport).not.toHaveBeenCalled();
    expect(cosmeticLoad).not.toHaveBeenCalled();
    expect(loader.isLoaded('gacha')).toBe(true);
    expect(root.LazyRuntimeLoaderModule.loadLazyRuntimeGroup).toBe(capturedByHandler);
  });

  test('a failed adapter returns to idle and the same captured handler can retry', async () => {
    jest.resetModules();
    const lazyRuntimeModule = require('../ui/bootstrap/lazy-runtime-loader');
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/vite-dist/index.vite.html'
    });
    const root: any = dom.window;
    root.LazyRuntimeLoaderModule = lazyRuntimeModule;
    let attempt = 0;
    const adapterLoad = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('first optional request failed');
      return true;
    });
    const loader = installOptionalFeatureLoader({
      root,
      document: root.document,
      featureImports: {
        leaderboard: async () => ({ loadOptionalFeature: adapterLoad })
      }
    });
    const capturedByHandler = root.loadLazyRuntimeGroup;

    await expect(capturedByHandler('leaderboard')).rejects.toThrow('first optional request failed');
    expect(loader.isLoaded('leaderboard')).toBe(false);
    await expect(capturedByHandler('leaderboard')).resolves.toBe(true);
    expect(adapterLoad).toHaveBeenCalledTimes(2);
    expect(loader.isLoaded('leaderboard')).toBe(true);
  });

  test('an ONNX adapter-installed Worker executor prevents the legacy ORT script load', async () => {
    jest.resetModules();
    const lazyRuntimeModule = require('../ui/bootstrap/lazy-runtime-loader');
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/vite-dist/index.vite.html'
    });
    const root: any = dom.window;
    root.LazyRuntimeLoaderModule = lazyRuntimeModule;
    const adapterLoad = jest.fn(async () => {
      root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__ = { runSession: jest.fn() };
      return true;
    });
    const loadScript = jest.fn(async () => undefined);
    const loader = installOptionalFeatureLoader({
      root,
      document: root.document,
      loadScript,
      featureImports: {
        onnx: async () => ({ loadOptionalFeature: adapterLoad })
      }
    });

    await expect(root.loadLazyRuntimeGroup('onnx')).resolves.toBe(true);
    expect(adapterLoad).toHaveBeenCalledTimes(1);
    expect(loadScript).not.toHaveBeenCalled();
    expect(loader.isLoaded('onnx')).toBe(true);
  });

  test('exposes an idempotent main-thread ONNX fallback that reloads model owners', async () => {
    jest.resetModules();
    const lazyRuntimeModule = require('../ui/bootstrap/lazy-runtime-loader');
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      url: 'https://example.test/vite-dist/index.vite.html'
    });
    const root: any = dom.window;
    const configureOthelloRuntime = jest.fn();
    const configurePolicyRuntime = jest.fn();
    root.LazyRuntimeLoaderModule = lazyRuntimeModule;
    root.require = jest.fn((moduleKey: string) => {
      if (moduleKey === 'game/ai/othello-onnx-runtime') return { configure: configureOthelloRuntime };
      if (moduleKey === 'game/ai/policy-onnx-runtime') return { configure: configurePolicyRuntime };
      throw new Error(`unexpected module: ${moduleKey}`);
    });
    root.initPolicyOnnxModel = jest.fn(async () => undefined);
    root.initOthelloOnnxModel = jest.fn(async () => undefined);
    const loadScript = jest.fn(async (src: string) => {
      if (src.includes('ort.min.js')) root.ort = { Tensor: function Tensor() {} };
    });
    installOptionalFeatureLoader({
      root,
      document: root.document,
      loadScript,
      featureImports: {
        onnx: async () => ({
          loadOptionalFeature: async () => {
            root.__CARD_REVERSI_ONNX_WORKER_EXECUTOR__ = { runSession: jest.fn() };
            return true;
          }
        })
      }
    });
    await root.loadLazyRuntimeGroup('onnx');
    expect(loadScript).not.toHaveBeenCalled();

    const first = root.LazyRuntimeLoaderModule.activateMainThreadOnnxFallback();
    const second = root.LazyRuntimeLoaderModule.activateMainThreadOnnxFallback();

    expect(first).toBe(second);
    await expect(first).resolves.toBe(true);
    expect(loadScript).toHaveBeenCalledTimes(1);
    expect(root.initPolicyOnnxModel).toHaveBeenCalledTimes(1);
    expect(root.initOthelloOnnxModel).toHaveBeenCalledTimes(1);
    expect(configureOthelloRuntime).toHaveBeenCalledWith({
      inferenceExecutor: null,
      ortApi: root.ort
    });
    expect(configurePolicyRuntime).toHaveBeenCalledWith({
      inferenceExecutor: null,
      ortApi: root.ort
    });
  });
});
