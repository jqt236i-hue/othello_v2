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
      return _require('../hand-skin/catalog') ?? null;
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
      return _require('../hand-skin/selection') ?? null;
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
      return _require('../hand-skin/runtime') ?? null;
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
      return _require('../hand-skin/controller') ?? null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

const catalogModule = resolveCatalogModule();
const selectionModule = resolveSelectionModule();
const runtimeModule = resolveRuntimeModule();
const controllerModule = resolveControllerModule();

const handSkinExports = {
  BASE_HAND_SKINS: catalogModule ? catalogModule.BASE_HAND_SKINS : [],
  HAND_SKINS: catalogModule ? catalogModule.HAND_SKINS : [],
  DEFAULT_HAND_SKIN_ID: catalogModule ? catalogModule.DEFAULT_HAND_SKIN_ID : 'default',
  HAND_SKIN_STORAGE_KEY: selectionModule ? selectionModule.HAND_SKIN_STORAGE_KEY : '',
  getAllHandSkins: function (rootRef: Window, options?: unknown) {
    return catalogModule ? catalogModule.getAllHandSkins(rootRef, options) : [];
  },
  applyHandSkin: function (handImageEl: HTMLImageElement, skinId: string, rootRef: Window) {
    return runtimeModule ? runtimeModule.applyHandSkin(handImageEl, skinId, rootRef) : null;
  },
  resolveHandAnimationContext: function (rootRef: Window, preferredSkinId: string, options?: unknown) {
    return runtimeModule ? runtimeModule.resolveHandAnimationContext(rootRef, preferredSkinId, options) : null;
  },
  resolveHandVisualOptions: function (rootRef: Window, ownerKey: string, options?: unknown) {
    return runtimeModule ? runtimeModule.resolveHandVisualOptions(rootRef, ownerKey, options) : null;
  },
  syncDisplayedHandSkin: function (rootRef: Window, preferredSkinId: string, handImageEl: HTMLImageElement, options?: unknown) {
    return runtimeModule ? runtimeModule.syncDisplayedHandSkin(rootRef, preferredSkinId, handImageEl, options) : null;
  },
  normalizeHandSkinId: function (value: unknown, rootRef: Window, options?: unknown) {
    return catalogModule ? catalogModule.normalizeHandSkinId(value, rootRef, options) : 'default';
  },
  readStoredHandSkinId: function (rootRef: Window) {
    return selectionModule ? selectionModule.readStoredHandSkinId(rootRef) : 'default';
  },
  setupHandSkinControls: function (options: Record<string, unknown>) {
    return controllerModule ? controllerModule.setupHandSkinControls(options) : null;
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
