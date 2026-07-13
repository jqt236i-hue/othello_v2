import type { OptionalFeatureContext, OptionalFeatureGroup } from './features/feature-registry';

type RuntimeRoot = Window & Record<string, any>;
type FeatureAdapter = { loadOptionalFeature: (context: OptionalFeatureContext) => Promise<boolean> };

const FEATURE_IMPORTS: Record<OptionalFeatureGroup, () => Promise<FeatureAdapter>> = {
  gacha: () => import('./features/gacha'),
  cosmetic: () => import('./features/cosmetic'),
  leaderboard: () => import('./features/leaderboard'),
  commentary: () => import('./features/commentary'),
  cpu: () => import('./features/cpu'),
  onnx: () => import('./features/onnx')
};

export interface InstallOptionalFeatureLoaderOptions {
  root?: RuntimeRoot;
  document?: Document;
  featureImports?: Partial<Record<OptionalFeatureGroup, () => Promise<FeatureAdapter>>>;
  loadScript?: OptionalFeatureContext['loadScript'];
}

export function installOptionalFeatureLoader(options: InstallOptionalFeatureLoaderOptions = {}): any {
  const rootRef = options.root || window as RuntimeRoot;
  const documentRef = options.document || document;
  if (rootRef.__CARD_REVERSI_VITE_OPTIONAL_LOADER__) {
    return rootRef.__CARD_REVERSI_VITE_OPTIONAL_LOADER__;
  }
  const runtimeModule = rootRef.LazyRuntimeLoaderModule;
  if (!runtimeModule || typeof runtimeModule.createLazyRuntimeLoader !== 'function') {
    throw new Error('LazyRuntimeLoaderModule.createLazyRuntimeLoader is unavailable');
  }
  const imports = Object.assign({}, FEATURE_IMPORTS, options.featureImports || {});
  const loader = runtimeModule.createLazyRuntimeLoader({
    root: rootRef,
    document: documentRef,
    loadGroup: async (group: OptionalFeatureGroup) => {
      const importFeature = imports[group];
      if (typeof importFeature !== 'function') throw new Error(`missing Vite optional adapter: ${group}`);
      const adapter = await importFeature();
      if (!adapter || typeof adapter.loadOptionalFeature !== 'function') {
        throw new Error(`invalid Vite optional adapter: ${group}`);
      }
      return adapter.loadOptionalFeature({ root: rootRef, document: documentRef, loadScript: options.loadScript });
    }
  });
  const facade = Object.assign({}, runtimeModule, {
    loadLazyRuntimeGroup: loader.load,
    isLazyRuntimeGroupLoaded: loader.isLoaded,
    getLazyRuntimeGroupError: loader.getLastError
  });
  rootRef.LazyRuntimeLoaderModule = facade;
  rootRef.loadLazyRuntimeGroup = loader.load;
  rootRef.__CARD_REVERSI_VITE_OPTIONAL_LOADER__ = loader;
  rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze(Object.assign(
    {},
    rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ || {},
    { featureLevelDynamicImports: true }
  ));
  return loader;
}
