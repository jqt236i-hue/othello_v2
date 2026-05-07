/**
 * @file runtime.ts
 * @description Background skin runtime application
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BackgroundSkinDefinition {
  id: string;
  cssBackground?: string;
  imagePath?: string;
}

interface BackgroundSkinCatalogModule {
  DEFAULT_BACKGROUND_SKIN_ID?: string;
  normalizeBackgroundSkinId?: (value: string | null | undefined, rootRef: Window) => string;
  getBackgroundSkinDefinition?: (skinId: string, rootRef: Window) => BackgroundSkinDefinition | null;
}

function resolveRootRef(rootRef: Window | null | undefined): Window | null {
  if (rootRef && typeof rootRef === 'object') return rootRef;
  try {
    if (typeof globalThis !== 'undefined' && globalThis) return globalThis as unknown as Window;
  } catch (e) { /* ignore */ }
  return null;
}

function resolveDocument(rootRef: Window | null | undefined): Document | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && ctx.document) return ctx.document;
  if (typeof document !== 'undefined') return document;
  return null;
}

function resolveCatalogModule(rootRef: Window | null | undefined): BackgroundSkinCatalogModule | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && (ctx as Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }).BackgroundSkinCatalogModule) {
    return (ctx as Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }).BackgroundSkinCatalogModule ?? null;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }).BackgroundSkinCatalogModule) {
      return (globalThis as unknown as Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }).BackgroundSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try { return _require('./catalog') ?? null; } catch (e) { /* ignore */ }
  }
  return null;
}

function applyBackgroundSkin(rootRef: Window | null | undefined, skinId: string): BackgroundSkinDefinition | null {
  const ctx = resolveRootRef(rootRef);
  const docRef = resolveDocument(ctx);
  const catalogModule = resolveCatalogModule(ctx);
  const definition = catalogModule && typeof catalogModule.getBackgroundSkinDefinition === 'function'
    ? catalogModule.getBackgroundSkinDefinition(skinId, ctx as Window)
    : null;
  if (!docRef || !definition) return null;
  const body = docRef.body;
  const rootEl = docRef.documentElement;
  if (body) {
    body.setAttribute('data-background-skin-id', definition.id);
    if (definition.cssBackground) {
      body.style.setProperty('--selected-background-skin', definition.cssBackground);
      body.style.backgroundImage = 'var(--selected-background-skin)';
      body.style.backgroundPosition = 'center center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundSize = 'auto';
    } else if (definition.imagePath) {
      body.style.setProperty('--selected-background-skin', 'url("' + definition.imagePath + '")');
      body.style.backgroundImage = 'var(--selected-background-skin)';
      body.style.backgroundPosition = 'center center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundSize = 'auto';
    } else {
      body.style.removeProperty('--selected-background-skin');
      body.style.removeProperty('background-image');
      body.style.removeProperty('background-position');
      body.style.removeProperty('background-repeat');
      body.style.removeProperty('background-size');
    }
  }
  if (rootEl) rootEl.setAttribute('data-background-skin-id', definition.id);
  return definition;
}

function syncDisplayedBackgroundSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): BackgroundSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BACKGROUND_SKIN_ID) || 'default').trim() || 'default';
  const normalized = catalogModule && typeof catalogModule.normalizeBackgroundSkinId === 'function'
    ? catalogModule.normalizeBackgroundSkinId(preferredSkinId, rootRef as Window)
    : fallbackId;
  return applyBackgroundSkin(rootRef, normalized);
}

export = {
  resolveRootRef,
  resolveDocument,
  applyBackgroundSkin,
  syncDisplayedBackgroundSkin
};
