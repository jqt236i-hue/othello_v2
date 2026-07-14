'use strict';

type LazyRuntimeGroup = 'cpu' | 'onnx' | 'gacha' | 'commentary' | 'cosmetic' | 'leaderboard';
type LoadScriptFn = (src: string) => Promise<unknown>;

interface LazyRuntimeLoaderOptions {
  root?: any;
  document?: Document | null;
  optionalRegistrySrc?: string;
  onnxRuntimeSrc?: string;
  loadScript?: LoadScriptFn;
  loadGroup?: (group: LazyRuntimeGroup) => Promise<unknown>;
  shouldLoadMainThreadOnnxRuntime?: () => boolean;
}

interface LazyRuntimeLoader {
  load: (group: LazyRuntimeGroup | string) => Promise<boolean>;
  activateMainThreadOnnxFallback: () => Promise<boolean>;
  isLoaded: (group: LazyRuntimeGroup | string) => boolean;
  getLastError: (group: LazyRuntimeGroup | string) => unknown;
}

const DEFAULT_OPTIONAL_REGISTRY_SRC = 'public/module-registry.optional.js';
const DEFAULT_ONNX_RUNTIME_SRC = 'node_modules/onnxruntime-web/dist/ort.min.js';
const ONNX_RUNTIME_MODULE_KEYS = [
  'game/ai/othello-onnx-runtime',
  'game/ai/policy-onnx-runtime'
] as const;

let defaultLoader: LazyRuntimeLoader | null = null;

function normalizeGroup(group: LazyRuntimeGroup | string): LazyRuntimeGroup {
  const normalized = String(group || '').trim().toLowerCase();
  if (normalized === 'onnx') return 'onnx';
  if (normalized === 'gacha') return 'gacha';
  if (normalized === 'commentary') return 'commentary';
  if (normalized === 'cosmetic') return 'cosmetic';
  if (normalized === 'leaderboard') return 'leaderboard';
  if (normalized === 'cpu') return 'cpu';
  throw new Error(`unknown lazy runtime group: ${normalized || '(empty)'}`);
}

function resolveRoot(options?: LazyRuntimeLoaderOptions): any {
  if (options && options.root) return options.root;
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function resolveDocument(rootRef: any, options?: LazyRuntimeLoaderOptions): Document | null {
  if (options && options.document) return options.document;
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function appendVersionFromStartupRegistry(src: string, docRef: Document | null): string {
  if (!docRef || src.indexOf('?') >= 0 || !/^public\/module-registry\.optional(?:\.[a-z-]+)?\.js$/.test(src)) return src;
  try {
    const startup = docRef.querySelector('script[src*="public/module-registry.js"]') as HTMLScriptElement | null;
    if (!startup || !startup.src) return src;
    const url = new URL(startup.src, 'https://example.invalid/');
    const version = url.searchParams.get('v');
    return version ? `${src}?v=${encodeURIComponent(version)}` : src;
  } catch (e) {
    return src;
  }
}

function loadScriptElement(src: string, docRef: Document | null): Promise<boolean> {
  if (!docRef || !docRef.createElement) {
    return Promise.reject(new Error(`document is unavailable for lazy script load: ${src}`));
  }
  return new Promise((resolve, reject) => {
    try {
      const existing = Array.from(docRef.getElementsByTagName('script')).find((script) => {
        const attr = script.getAttribute('src') || '';
        return attr === src || attr.split('?')[0] === src.split('?')[0];
      }) as HTMLScriptElement | undefined;
      if (existing && existing.getAttribute('data-lazy-runtime-loaded') === 'true') {
        resolve(true);
        return;
      }
      const script = existing || docRef.createElement('script');
      script.async = false;
      script.setAttribute('data-lazy-runtime-src', src);
      const cleanup = () => {
        script.onload = null;
        script.onerror = null;
      };
      script.onload = () => {
        script.setAttribute('data-lazy-runtime-loaded', 'true');
        cleanup();
        resolve(true);
      };
      script.onerror = () => {
        cleanup();
        if (script.getAttribute('data-lazy-runtime-src') && script.parentNode) {
          script.parentNode.removeChild(script);
        }
        reject(new Error(`failed to load lazy runtime script: ${src}`));
      };
      if (!existing) {
        script.src = src;
        (docRef.head || docRef.documentElement || docRef.body).appendChild(script);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function createLazyRuntimeLoader(options?: LazyRuntimeLoaderOptions): LazyRuntimeLoader {
  const opts = (options && typeof options === 'object') ? options : {};
  const rootRef = resolveRoot(opts);
  const docRef = resolveDocument(rootRef, opts);
  const loadedGroups = new Set<LazyRuntimeGroup>();
  const loadingGroups = new Map<LazyRuntimeGroup, Promise<boolean>>();
  const lastErrors = new Map<LazyRuntimeGroup, unknown>();
  let optionalRegistryLoad: Promise<unknown> | null = null;
  let onnxRuntimeLoad: Promise<unknown> | null = null;
  let mainThreadOnnxFallbackLoad: Promise<boolean> | null = null;
  let aggregateOptionalBootEntriesRestored = false;
  const restoredGroups = new Set<LazyRuntimeGroup>();

  const loadScript: LoadScriptFn = typeof opts.loadScript === 'function'
    ? opts.loadScript
    : (src: string) => loadScriptElement(src, docRef);

  const optionalRegistrySrc = appendVersionFromStartupRegistry(
    opts.optionalRegistrySrc || DEFAULT_OPTIONAL_REGISTRY_SRC,
    docRef
  );
  const onnxRuntimeSrc = opts.onnxRuntimeSrc || DEFAULT_ONNX_RUNTIME_SRC;

  const restoreOptionalBootEntries = (group?: LazyRuntimeGroup) => {
    if (group ? restoredGroups.has(group) : aggregateOptionalBootEntriesRestored) return;
    try {
      const restore = rootRef && rootRef.__restoreCardReversiOptionalBootEntries;
      if (typeof restore === 'function') restore(group);
    } catch (e) { /* ignore */ }
    if (group) restoredGroups.add(group);
    else aggregateOptionalBootEntriesRestored = true;
  };

  const ensureOptionalRegistry = (): Promise<unknown> => {
    if (!optionalRegistryLoad) {
      optionalRegistryLoad = Promise.resolve(loadScript(optionalRegistrySrc)).catch((error) => {
        optionalRegistryLoad = null;
        throw error;
      });
    }
    return optionalRegistryLoad;
  };

  const ensureOnnxRuntime = (): Promise<unknown> => {
    if (!onnxRuntimeLoad) {
      onnxRuntimeLoad = Promise.resolve(loadScript(onnxRuntimeSrc)).catch((error) => {
        onnxRuntimeLoad = null;
        throw error;
      });
    }
    return onnxRuntimeLoad;
  };

  const injectOnnxRuntimeApi = (detachWorkerExecutor = false) => {
    const ortApi = rootRef && rootRef.ort;
    if (!ortApi || typeof ortApi.Tensor !== 'function') {
      throw new Error('onnxruntime-web loaded without exposing window.ort');
    }
    if (!rootRef || typeof rootRef.require !== 'function') {
      throw new Error('CommonJS compatibility runtime is unavailable for ONNX injection');
    }
    for (const moduleKey of ONNX_RUNTIME_MODULE_KEYS) {
      const runtime = rootRef.require(moduleKey);
      if (!runtime || typeof runtime.configure !== 'function') {
        throw new Error(`ONNX runtime module is unavailable: ${moduleKey}`);
      }
      runtime.configure(detachWorkerExecutor
        ? { inferenceExecutor: null, ortApi }
        : { ortApi });
    }
  };

  const activateMainThreadOnnxFallback = (): Promise<boolean> => {
    if (mainThreadOnnxFallbackLoad) return mainThreadOnnxFallbackLoad;
    const next = (async () => {
      await ensureOnnxRuntime();
      injectOnnxRuntimeApi(true);
      return true;
    })();
    mainThreadOnnxFallbackLoad = next;
    next.catch(() => {
      if (mainThreadOnnxFallbackLoad === next) mainThreadOnnxFallbackLoad = null;
    });
    return next;
  };

  const load = (groupInput: LazyRuntimeGroup | string): Promise<boolean> => {
    let group: LazyRuntimeGroup;
    try {
      group = normalizeGroup(groupInput);
    } catch (error) {
      return Promise.reject(error);
    }
    if (loadedGroups.has(group)) return Promise.resolve(true);
    const inFlight = loadingGroups.get(group);
    if (inFlight) return inFlight;
    const next = (async () => {
      if (typeof opts.loadGroup === 'function') {
        await opts.loadGroup(group);
      } else {
        await ensureOptionalRegistry();
        restoreOptionalBootEntries();
      }
      if (group === 'onnx') {
        const shouldLoadMainThread = typeof opts.shouldLoadMainThreadOnnxRuntime === 'function'
          ? opts.shouldLoadMainThreadOnnxRuntime() !== false
          : true;
        if (shouldLoadMainThread) {
          await ensureOnnxRuntime();
          injectOnnxRuntimeApi();
        }
      }
      loadedGroups.add(group);
      lastErrors.delete(group);
      return true;
    })();
    loadingGroups.set(group, next);
    next.then(() => {
      loadingGroups.delete(group);
    }, (error) => {
      loadingGroups.delete(group);
      lastErrors.set(group, error);
    });
    return next;
  };

  return {
    load,
    activateMainThreadOnnxFallback,
    isLoaded(groupInput: LazyRuntimeGroup | string): boolean {
      try {
        return loadedGroups.has(normalizeGroup(groupInput));
      } catch (e) {
        return false;
      }
    },
    getLastError(groupInput: LazyRuntimeGroup | string): unknown {
      try {
        return lastErrors.get(normalizeGroup(groupInput));
      } catch (e) {
        return e;
      }
    }
  };
}

function getDefaultLazyRuntimeLoader(): LazyRuntimeLoader {
  if (!defaultLoader) defaultLoader = createLazyRuntimeLoader();
  return defaultLoader;
}

function loadLazyRuntimeGroup(group: LazyRuntimeGroup | string): Promise<boolean> {
  return getDefaultLazyRuntimeLoader().load(group);
}

function isLazyRuntimeGroupLoaded(group: LazyRuntimeGroup | string): boolean {
  return getDefaultLazyRuntimeLoader().isLoaded(group);
}

const LazyRuntimeLoaderModule = {
  createLazyRuntimeLoader,
  getDefaultLazyRuntimeLoader,
  loadLazyRuntimeGroup,
  isLazyRuntimeGroupLoaded
};

try {
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).LazyRuntimeLoaderModule = LazyRuntimeLoaderModule;
    (globalThis as any).loadLazyRuntimeGroup = loadLazyRuntimeGroup;
  }
  if (typeof window !== 'undefined') {
    (window as any).LazyRuntimeLoaderModule = LazyRuntimeLoaderModule;
    (window as any).loadLazyRuntimeGroup = loadLazyRuntimeGroup;
  }
} catch (e) { /* ignore */ }

export = LazyRuntimeLoaderModule;
