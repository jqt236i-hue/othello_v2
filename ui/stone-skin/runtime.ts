/**
 * @file runtime.ts
 * @description Normal stone skin runtime application
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface StoneSkinDefinition {
  id: string;
  blackImagePath: string;
  whiteImagePath: string;
}

interface StoneSkinCatalogModule {
  DEFAULT_STONE_SKIN_ID?: string;
  normalizeStoneSkinId?: (value: string | null | undefined, rootRef?: Window) => string;
  getStoneSkinDefinition?: (skinId: string, rootRef?: Window) => StoneSkinDefinition | null;
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

function requireStoneSkinCatalogModuleOrNull(): StoneSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window | null | undefined): StoneSkinCatalogModule | null {
  const ctx = resolveRootRef(rootRef);
  if (ctx && (ctx as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule) {
    return (ctx as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule ?? null;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule) {
      return (globalThis as unknown as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireStoneSkinCatalogModuleOrNull();
}

function cssUrl(path: string): string {
  return 'url("' + String(path || '').replace(/"/g, '\\"') + '")';
}

function applyStoneSkin(rootRef: Window | null | undefined, skinId: string): StoneSkinDefinition | null {
  const ctx = resolveRootRef(rootRef);
  const docRef = resolveDocument(ctx);
  const catalogModule = resolveCatalogModule(ctx);
  const definition = catalogModule && typeof catalogModule.getStoneSkinDefinition === 'function'
    ? catalogModule.getStoneSkinDefinition(skinId, ctx as Window)
    : null;
  if (!docRef || !definition || !docRef.documentElement) return null;
  const rootEl = docRef.documentElement;
  rootEl.setAttribute('data-stone-skin-id', definition.id);
  rootEl.style.setProperty('--normal-stone-black-image', cssUrl(definition.blackImagePath));
  rootEl.style.setProperty('--normal-stone-white-image', cssUrl(definition.whiteImagePath));
  return definition;
}

function syncDisplayedStoneSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): StoneSkinDefinition | null {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_STONE_SKIN_ID) || 'default').trim() || 'default';
  const normalized = catalogModule && typeof catalogModule.normalizeStoneSkinId === 'function'
    ? catalogModule.normalizeStoneSkinId(preferredSkinId, rootRef as Window)
    : fallbackId;
  return applyStoneSkin(rootRef, normalized);
}

export = {
  resolveRootRef,
  resolveDocument,
  applyStoneSkin,
  syncDisplayedStoneSkin
};
