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
const BACKGROUND_SKIN_STORAGE_VERSION_KEY = 'reversi.backgroundSkin.version';
const BACKGROUND_SKIN_STORAGE_VERSION = '2';
const FALLBACK_BACKGROUND_SKIN_ID = 'default-25';
const LEGACY_DEFAULT_BACKGROUND_SKIN_ID = 'default';

function requireBackgroundSkinCatalogModuleOrNull(): BackgroundSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }): BackgroundSkinCatalogModule | null {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.BackgroundSkinCatalogModule) return ctx.BackgroundSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }).BackgroundSkinCatalogModule) {
      return (globalThis as unknown as Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }).BackgroundSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireBackgroundSkinCatalogModuleOrNull();
}

function canUseStorage(rootRef: Window): boolean {
  try { return !!(rootRef && rootRef.localStorage); } catch (e) { return false; }
}

function hasCurrentStorageVersion(rootRef: Window): boolean {
  try {
    return rootRef.localStorage.getItem(BACKGROUND_SKIN_STORAGE_VERSION_KEY) === BACKGROUND_SKIN_STORAGE_VERSION;
  } catch (e) {
    return false;
  }
}

function writeStorageVersion(rootRef: Window): void {
  try {
    rootRef.localStorage.setItem(BACKGROUND_SKIN_STORAGE_VERSION_KEY, BACKGROUND_SKIN_STORAGE_VERSION);
  } catch (e) { /* ignore */ }
}

function migrateLegacyDefaultBackgroundSkinId(rootRef: Window, storedValue: string | null, fallbackId: string): string | null {
  const normalized = String(storedValue || '').trim();
  if (normalized !== LEGACY_DEFAULT_BACKGROUND_SKIN_ID || hasCurrentStorageVersion(rootRef)) {
    return storedValue;
  }
  try {
    rootRef.localStorage.setItem(BACKGROUND_SKIN_STORAGE_KEY, fallbackId);
    rootRef.localStorage.setItem(LEGACY_BACKGROUND_SKIN_STORAGE_KEY, fallbackId);
    writeStorageVersion(rootRef);
  } catch (e) { /* ignore */ }
  return fallbackId;
}

function readStoredBackgroundSkinId(rootRef: Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }): string {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BACKGROUND_SKIN_ID) || FALLBACK_BACKGROUND_SKIN_ID).trim() || FALLBACK_BACKGROUND_SKIN_ID;
  if (!canUseStorage(rootRef)) return fallbackId;
  try {
    const storedValue = rootRef.localStorage.getItem(BACKGROUND_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_BACKGROUND_SKIN_STORAGE_KEY);
    const migratedValue = migrateLegacyDefaultBackgroundSkinId(rootRef, storedValue, fallbackId);
    if (catalogModule && typeof catalogModule.normalizeBackgroundSkinId === 'function') {
      return catalogModule.normalizeBackgroundSkinId(migratedValue, rootRef);
    }
    return String(migratedValue || '').trim() || fallbackId;
  } catch (e) {
    return fallbackId;
  }
}

function writeStoredBackgroundSkinId(rootRef: Window & { BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule }, skinId: string): boolean {
  if (!canUseStorage(rootRef)) return false;
  const catalogModule = resolveCatalogModule(rootRef);
  const definition = catalogModule && typeof catalogModule.getBackgroundSkinDefinition === 'function'
    ? catalogModule.getBackgroundSkinDefinition(skinId, rootRef)
    : { id: FALLBACK_BACKGROUND_SKIN_ID };
  try {
    if (definition) {
      rootRef.localStorage.setItem(BACKGROUND_SKIN_STORAGE_KEY, definition.id);
      rootRef.localStorage.setItem(LEGACY_BACKGROUND_SKIN_STORAGE_KEY, definition.id);
      writeStorageVersion(rootRef);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export = {
  BACKGROUND_SKIN_STORAGE_KEY,
  LEGACY_BACKGROUND_SKIN_STORAGE_KEY,
  BACKGROUND_SKIN_STORAGE_VERSION_KEY,
  readStoredBackgroundSkinId,
  writeStoredBackgroundSkinId
};
