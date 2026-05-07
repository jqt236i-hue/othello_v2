/**
 * @file selection.ts
 * @description Hand skin selection management
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface HandSkinDefinition {
  id: string;
  label: string;
  note?: string;
  imagePath?: string;
}

interface HandSkinCatalogModule {
  DEFAULT_HAND_SKIN_ID?: string;
  normalizeHandSkinId?: (value: string | null, rootRef: Window) => string;
  getHandSkinDefinition?: (skinId: string, rootRef: Window) => HandSkinDefinition | null;
}

const HAND_SKIN_STORAGE_KEY = 'othello.handSkin';

function resolveCatalogModule(rootRef: Window & { HandSkinCatalogModule?: HandSkinCatalogModule }): HandSkinCatalogModule | null {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.HandSkinCatalogModule) return ctx.HandSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { HandSkinCatalogModule?: HandSkinCatalogModule }).HandSkinCatalogModule) {
      return (globalThis as unknown as Window & { HandSkinCatalogModule?: HandSkinCatalogModule }).HandSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('./catalog') ?? null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

function canUseStorage(rootRef: Window): boolean {
  try {
    return !!(rootRef && rootRef.localStorage);
  } catch (e) {
    return false;
  }
}

function readStoredHandSkinId(rootRef: Window & { HandSkinCatalogModule?: HandSkinCatalogModule }): string {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_HAND_SKIN_ID) || 'default').trim() || 'default';
  if (!canUseStorage(rootRef)) return fallbackId;
  try {
    if (catalogModule && typeof catalogModule.normalizeHandSkinId === 'function') {
      return catalogModule.normalizeHandSkinId(rootRef.localStorage.getItem(HAND_SKIN_STORAGE_KEY), rootRef);
    }
    return String(rootRef.localStorage.getItem(HAND_SKIN_STORAGE_KEY) || '').trim() || fallbackId;
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[hand-skin] failed to read storage', e);
    }
    return fallbackId;
  }
}

function writeStoredHandSkinId(rootRef: Window & { HandSkinCatalogModule?: HandSkinCatalogModule }, skinId: string): boolean {
  if (!canUseStorage(rootRef)) return false;
  const catalogModule = resolveCatalogModule(rootRef);
  const definition = catalogModule && typeof catalogModule.getHandSkinDefinition === 'function'
    ? catalogModule.getHandSkinDefinition(skinId, rootRef)
    : { id: 'default' };
  try {
    if (definition) {
      rootRef.localStorage.setItem(HAND_SKIN_STORAGE_KEY, definition.id);
    }
    return true;
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[hand-skin] failed to write storage', e);
    }
    return false;
  }
}

export = {
  HAND_SKIN_STORAGE_KEY,
  readStoredHandSkinId,
  writeStoredHandSkinId
};
