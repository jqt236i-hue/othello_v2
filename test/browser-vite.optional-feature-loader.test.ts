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
});
