/**
 * @file hand-skin.ts
 * @description Hand skin UI handler
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface HandSkinItem {
  id: string;
  label: string;
  note: string;
  imagePath: string;
}

interface HandSkinCatalogModule {
  BASE_HAND_SKINS: HandSkinItem[];
  HAND_SKINS: HandSkinItem[];
  DEFAULT_HAND_SKIN_ID: string;
  getAllHandSkins: (rootRef: Window, options?: unknown) => HandSkinItem[];
  normalizeHandSkinId: (value: unknown, rootRef: Window, options?: unknown) => string;
  getHandSkinDefinition: (skinId: string, rootRef: Window, options?: unknown) => HandSkinItem | null;
}

interface HandSkinSelectionModule {
  HAND_SKIN_STORAGE_KEY: string;
  readStoredHandSkinId: (rootRef: Window) => string;
}

interface HandSkinRuntimeModule {
  applyHandSkin: (handImageEl: HTMLImageElement, skinId: string, rootRef: Window) => unknown;
  resolveHandAnimationContext: (rootRef: Window, preferredSkinId: string, options?: unknown) => unknown;
  resolveHandVisualOptions: (rootRef: Window, ownerKey: string, options?: unknown) => unknown;
  syncDisplayedHandSkin: (rootRef: Window, preferredSkinId: string, handImageEl: HTMLImageElement, options?: unknown) => unknown;
}

interface HandSkinControllerModule {
  setupHandSkinControls: (options: Record<string, unknown>) => unknown;
}

function resolveCatalogModule(): HandSkinCatalogModule | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { HandSkinCatalogModule?: HandSkinCatalogModule }).HandSkinCatalogModule) {
      return (globalThis as unknown as Window & { HandSkinCatalogModule?: HandSkinCatalogModule }).HandSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../hand-skin/catalog.js') ?? null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveSelectionModule(): HandSkinSelectionModule | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { HandSkinSelectionModule?: HandSkinSelectionModule }).HandSkinSelectionModule) {
      return (globalThis as unknown as Window & { HandSkinSelectionModule?: HandSkinSelectionModule }).HandSkinSelectionModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../hand-skin/selection.js') ?? null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveRuntimeModule(): HandSkinRuntimeModule | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { HandSkinRuntimeModule?: HandSkinRuntimeModule }).HandSkinRuntimeModule) {
      return (globalThis as unknown as Window & { HandSkinRuntimeModule?: HandSkinRuntimeModule }).HandSkinRuntimeModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../hand-skin/runtime.js') ?? null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveControllerModule(): HandSkinControllerModule | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { HandSkinControllerModule?: HandSkinControllerModule }).HandSkinControllerModule) {
      return (globalThis as unknown as Window & { HandSkinControllerModule?: HandSkinControllerModule }).HandSkinControllerModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../hand-skin/controller.js') ?? null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveLazyRuntimeGroupLoader(options: Record<string, unknown> | undefined, rootRef: any): any {
  if (options && typeof options.loadLazyRuntimeGroup === 'function') {
    return options.loadLazyRuntimeGroup;
  }
  try {
    if (rootRef && typeof rootRef.loadLazyRuntimeGroup === 'function') {
      return rootRef.loadLazyRuntimeGroup.bind(rootRef);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).loadLazyRuntimeGroup === 'function') {
      return (globalThis as any).loadLazyRuntimeGroup;
    }
  } catch (e) { /* ignore */ }
  try {
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as any).LazyRuntimeLoaderModule &&
      typeof (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup === 'function'
    ) {
      return (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      const moduleRef = _require('../bootstrap/lazy-runtime-loader');
      if (moduleRef && typeof moduleRef.loadLazyRuntimeGroup === 'function') {
        return moduleRef.loadLazyRuntimeGroup;
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveRootRef(options: Record<string, unknown>): any {
  if (options && options.root) return options.root;
  if (typeof window !== 'undefined') return window;
  if (typeof globalThis !== 'undefined') return globalThis;
  return null;
}

function resolveDocument(rootRef: any, options: Record<string, unknown>): Document | null {
  if (options && options.document) return options.document as Document;
  if (rootRef && rootRef.document) return rootRef.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function createLazyHandSkinControls(options: Record<string, unknown>, rootRef: any, docRef: Document, loadLazyRuntimeGroup: any): any {
  const button = (options.button as HTMLElement) || docRef.getElementById('handSkinBtn');
  if (!button || typeof button.addEventListener !== 'function') return null;

  let delegate: any = null;
  let loading: Promise<any> | null = null;

  const ensureDelegate = (): Promise<any> => {
    if (delegate) return Promise.resolve(delegate);
    if (!loading) {
      loading = Promise.resolve(loadLazyRuntimeGroup('cosmetic')).then(() => {
        const controllerModule = resolveControllerModule();
        if (!controllerModule || typeof controllerModule.setupHandSkinControls !== 'function') {
          throw new Error('hand skin controller is unavailable after lazy runtime load');
        }
        delegate = controllerModule.setupHandSkinControls(Object.assign({}, options, {
          root: rootRef,
          document: docRef,
          lazyRuntimeGroupLoaded: true
        }));
        if (!delegate) {
          throw new Error('hand skin controls are unavailable after lazy runtime load');
        }
        return delegate;
      }).finally(() => {
        if (!delegate) loading = null;
      });
    }
    return loading;
  };

  const onOpenClick = function (event: Event) {
    if (event && typeof (event as any).preventDefault === 'function') (event as any).preventDefault();
    void ensureDelegate().then((api) => {
      try {
        button.removeEventListener('click', onOpenClick);
      } catch (e) { /* ignore */ }
      if (api && typeof api.openPanel === 'function') api.openPanel();
    }).catch((error) => {
      try {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[hand-skin] lazy runtime load failed', error && error.message ? error.message : error);
        }
      } catch (e) { /* ignore */ }
    });
  };

  button.addEventListener('click', onOpenClick);

  return {
    closePanel: function () {
      if (delegate && typeof delegate.closePanel === 'function') return delegate.closePanel();
      return undefined;
    },
    openPanel: function () {
      return ensureDelegate().then((api) => api && typeof api.openPanel === 'function' ? api.openPanel() : undefined);
    },
    refreshOptions: function (preferredSkinId?: unknown) {
      if (delegate && typeof delegate.refreshOptions === 'function') return delegate.refreshOptions(preferredSkinId);
      return undefined;
    },
    getSelectedSkinId: function () {
      return delegate && typeof delegate.getSelectedSkinId === 'function' ? delegate.getSelectedSkinId() : 'default';
    },
    syncDisplayedSkin: function () {
      return delegate && typeof delegate.syncDisplayedSkin === 'function' ? delegate.syncDisplayedSkin() : null;
    },
    selectSkin: function (skinId: unknown) {
      return ensureDelegate().then((api) => api && typeof api.selectSkin === 'function' ? api.selectSkin(skinId) : null);
    },
    selectAppearanceTab: function (tabKey: string) {
      return ensureDelegate().then((api) => api && typeof api.selectAppearanceTab === 'function' ? api.selectAppearanceTab(tabKey) : 'hand');
    },
    copyCurrentAppearanceCode: function () {
      if (delegate && typeof delegate.copyCurrentAppearanceCode === 'function') return delegate.copyCurrentAppearanceCode();
      return ensureDelegate().then((api) => api && typeof api.copyCurrentAppearanceCode === 'function' ? api.copyCurrentAppearanceCode() : null);
    },
    loadAppearancePresetCode: function () {
      return ensureDelegate().then((api) => api && typeof api.loadAppearancePresetCode === 'function' ? api.loadAppearancePresetCode() : null);
    },
    getHandAnimationPreferences: function () {
      if (delegate && typeof delegate.getHandAnimationPreferences === 'function') return delegate.getHandAnimationPreferences();
      return { draw: true, place: true };
    }
  };
}

const handSkinExports = {
  get BASE_HAND_SKINS() {
    const catalogModule = resolveCatalogModule();
    return catalogModule ? catalogModule.BASE_HAND_SKINS : [];
  },
  get HAND_SKINS() {
    const catalogModule = resolveCatalogModule();
    return catalogModule ? catalogModule.HAND_SKINS : [];
  },
  get DEFAULT_HAND_SKIN_ID() {
    const catalogModule = resolveCatalogModule();
    return catalogModule ? catalogModule.DEFAULT_HAND_SKIN_ID : 'default';
  },
  get HAND_SKIN_STORAGE_KEY() {
    const selectionModule = resolveSelectionModule();
    return selectionModule ? selectionModule.HAND_SKIN_STORAGE_KEY : '';
  },
  getAllHandSkins: function (rootRef: Window, options?: unknown) {
    const catalogModule = resolveCatalogModule();
    return catalogModule ? catalogModule.getAllHandSkins(rootRef, options) : [];
  },
  applyHandSkin: function (handImageEl: HTMLImageElement, skinId: string, rootRef: Window) {
    const runtimeModule = resolveRuntimeModule();
    return runtimeModule ? runtimeModule.applyHandSkin(handImageEl, skinId, rootRef) : null;
  },
  resolveHandAnimationContext: function (rootRef: Window, preferredSkinId: string, options?: unknown) {
    const runtimeModule = resolveRuntimeModule();
    return runtimeModule ? runtimeModule.resolveHandAnimationContext(rootRef, preferredSkinId, options) : null;
  },
  resolveHandVisualOptions: function (rootRef: Window, ownerKey: string, options?: unknown) {
    const runtimeModule = resolveRuntimeModule();
    return runtimeModule ? runtimeModule.resolveHandVisualOptions(rootRef, ownerKey, options) : null;
  },
  syncDisplayedHandSkin: function (rootRef: Window, preferredSkinId: string, handImageEl: HTMLImageElement, options?: unknown) {
    const runtimeModule = resolveRuntimeModule();
    return runtimeModule ? runtimeModule.syncDisplayedHandSkin(rootRef, preferredSkinId, handImageEl, options) : null;
  },
  normalizeHandSkinId: function (value: unknown, rootRef: Window, options?: unknown) {
    const catalogModule = resolveCatalogModule();
    return catalogModule ? catalogModule.normalizeHandSkinId(value, rootRef, options) : 'default';
  },
  readStoredHandSkinId: function (rootRef: Window) {
    const selectionModule = resolveSelectionModule();
    return selectionModule ? selectionModule.readStoredHandSkinId(rootRef) : 'default';
  },
  setupHandSkinControls: function (options: Record<string, unknown>) {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootRef = resolveRootRef(opts);
    const docRef = resolveDocument(rootRef, opts);
    const controllerModule = resolveControllerModule();
    if (controllerModule && typeof controllerModule.setupHandSkinControls === 'function') {
      return controllerModule.setupHandSkinControls(Object.assign({}, opts, { root: rootRef, document: docRef }));
    }
    if (!docRef || opts.lazyRuntimeGroupLoaded === true) return null;
    const loadLazyRuntimeGroup = resolveLazyRuntimeGroupLoader(opts, rootRef);
    return typeof loadLazyRuntimeGroup === 'function'
      ? createLazyHandSkinControls(opts, rootRef, docRef, loadLazyRuntimeGroup)
      : null;
  }
};

if (typeof window !== 'undefined') {
  (window as Window & { HandSkinUiModule?: typeof handSkinExports }).HandSkinUiModule = handSkinExports;
  (window as Window & { setupHandSkinControls?: typeof handSkinExports.setupHandSkinControls }).setupHandSkinControls = handSkinExports.setupHandSkinControls;
  (window as Window & { syncDisplayedHandSkin?: typeof handSkinExports.syncDisplayedHandSkin }).syncDisplayedHandSkin = handSkinExports.syncDisplayedHandSkin;
  (window as Window & { resolveHandAnimationContext?: typeof handSkinExports.resolveHandAnimationContext }).resolveHandAnimationContext = handSkinExports.resolveHandAnimationContext;
  (window as Window & { resolveHandVisualOptions?: typeof handSkinExports.resolveHandVisualOptions }).resolveHandVisualOptions = handSkinExports.resolveHandVisualOptions;
}

export = handSkinExports;
