'use strict';

type LazyRuntimeGroup = 'cpu' | 'onnx' | 'gacha' | 'commentary';
type LoadScriptFn = (src: string) => Promise<unknown>;

interface LazyRuntimeLoaderOptions {
  root?: any;
  document?: Document | null;
  optionalRegistrySrc?: string;
  onnxRuntimeSrc?: string;
  loadScript?: LoadScriptFn;
}

interface LazyRuntimeLoader {
  load: (group: LazyRuntimeGroup | string) => Promise<boolean>;
  isLoaded: (group: LazyRuntimeGroup | string) => boolean;
}

const DEFAULT_OPTIONAL_REGISTRY_SRC = 'public/module-registry.optional.js';
const DEFAULT_ONNX_RUNTIME_SRC = 'node_modules/onnxruntime-web/dist/ort.min.js';

let defaultLoader: LazyRuntimeLoader | null = null;

function normalizeGroup(group: LazyRuntimeGroup | string): LazyRuntimeGroup {
  const normalized = String(group || '').trim().toLowerCase();
  if (normalized === 'onnx') return 'onnx';
  if (normalized === 'gacha') return 'gacha';
  if (normalized === 'commentary') return 'commentary';
  return 'cpu';
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
  if (!docRef || src.indexOf('?') >= 0 || src !== DEFAULT_OPTIONAL_REGISTRY_SRC) return src;
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
  let optionalRegistryLoad: Promise<unknown> | null = null;
  let onnxRuntimeLoad: Promise<unknown> | null = null;

  const loadScript: LoadScriptFn = typeof opts.loadScript === 'function'
    ? opts.loadScript
    : (src: string) => loadScriptElement(src, docRef);

  const optionalRegistrySrc = appendVersionFromStartupRegistry(
    opts.optionalRegistrySrc || DEFAULT_OPTIONAL_REGISTRY_SRC,
    docRef
  );
  const onnxRuntimeSrc = opts.onnxRuntimeSrc || DEFAULT_ONNX_RUNTIME_SRC;

  const ensureOptionalRegistry = (): Promise<unknown> => {
    if (!optionalRegistryLoad) optionalRegistryLoad = Promise.resolve(loadScript(optionalRegistrySrc));
    return optionalRegistryLoad;
  };

  const ensureOnnxRuntime = (): Promise<unknown> => {
    if (!onnxRuntimeLoad) onnxRuntimeLoad = Promise.resolve(loadScript(onnxRuntimeSrc));
    return onnxRuntimeLoad;
  };

  const load = (groupInput: LazyRuntimeGroup | string): Promise<boolean> => {
    const group = normalizeGroup(groupInput);
    if (loadedGroups.has(group)) return Promise.resolve(true);
    const inFlight = loadingGroups.get(group);
    if (inFlight) return inFlight;
    const next = (async () => {
      await ensureOptionalRegistry();
      if (group === 'onnx') {
        await ensureOnnxRuntime();
      }
      loadedGroups.add(group);
      return true;
    })();
    loadingGroups.set(group, next);
    next.then(() => {
      loadingGroups.delete(group);
    }, () => {
      loadingGroups.delete(group);
    });
    return next;
  };

  return {
    load,
    isLoaded(groupInput: LazyRuntimeGroup | string): boolean {
      return loadedGroups.has(normalizeGroup(groupInput));
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
