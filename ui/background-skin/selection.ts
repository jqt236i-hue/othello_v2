/**
 * @file selection.ts
 * @description Background skin selection management
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BackgroundSkinDefinition {
  id: string;
  label: string;
  note?: string;
  imagePath?: string;
  cssBackground?: string;
}

interface BackgroundSkinCatalogModule {
  DEFAULT_BACKGROUND_SKIN_ID?: string;
  normalizeBackgroundSkinId?: (value: string | null, rootRef: Window) => string;
  getBackgroundSkinDefinition?: (skinId: string, rootRef: Window) => BackgroundSkinDefinition | null;
}

const BACKGROUND_SKIN_STORAGE_KEY = 'reversi.backgroundSkin';
const LEGACY_BACKGROUND_SKIN_STORAGE_KEY = 'othello.backgroundSkin';

function resolveCatalogModule(rootRef: Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }): BackgroundSkinCatalogModule | null {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.BackgroundSkinCatalogModule) return ctx.BackgroundSkinCatalogModule;
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

function canUseStorage(rootRef: Window): boolean {
  try { return !!(rootRef && rootRef.localStorage); } catch (e) { return false; }
}

function readStoredBackgroundSkinId(rootRef: Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }): string {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BACKGROUND_SKIN_ID) || 'default').trim() || 'default';
  if (!canUseStorage(rootRef)) return fallbackId;
  try {
    if (catalogModule && typeof catalogModule.normalizeBackgroundSkinId === 'function') {
      return catalogModule.normalizeBackgroundSkinId(
        rootRef.localStorage.getItem(BACKGROUND_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_BACKGROUND_SKIN_STORAGE_KEY),
        rootRef
      );
    }
    return String(rootRef.localStorage.getItem(BACKGROUND_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_BACKGROUND_SKIN_STORAGE_KEY) || '').trim() || fallbackId;
  } catch (e) {
    return fallbackId;
  }
}

function writeStoredBackgroundSkinId(rootRef: Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }, skinId: string): boolean {
  if (!canUseStorage(rootRef)) return false;
  const catalogModule = resolveCatalogModule(rootRef);
  const definition = catalogModule && typeof catalogModule.getBackgroundSkinDefinition === 'function'
    ? catalogModule.getBackgroundSkinDefinition(skinId, rootRef)
    : { id: 'default' };
  try {
    if (definition) {
      rootRef.localStorage.setItem(BACKGROUND_SKIN_STORAGE_KEY, definition.id);
      rootRef.localStorage.setItem(LEGACY_BACKGROUND_SKIN_STORAGE_KEY, definition.id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export = {
  BACKGROUND_SKIN_STORAGE_KEY,
  LEGACY_BACKGROUND_SKIN_STORAGE_KEY,
  readStoredBackgroundSkinId,
  writeStoredBackgroundSkinId
};
