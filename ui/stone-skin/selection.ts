/**
 * @file selection.ts
 * @description Normal stone skin selection management
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface StoneSkinDefinition {
  id: string;
}

interface StoneSkinCatalogModule {
  DEFAULT_STONE_SKIN_ID?: string;
  normalizeStoneSkinId?: (value: string | null, rootRef?: Window) => string;
  getStoneSkinDefinition?: (skinId: string, rootRef?: Window) => StoneSkinDefinition | null;
}

const STONE_SKIN_STORAGE_KEY = 'reversi.stoneSkin';
const LEGACY_STONE_SKIN_STORAGE_KEY = 'othello.stoneSkin';

function requireStoneSkinCatalogModuleOrNull(): StoneSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }): StoneSkinCatalogModule | null {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.StoneSkinCatalogModule) return ctx.StoneSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule) {
      return (globalThis as unknown as Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }).StoneSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireStoneSkinCatalogModuleOrNull();
}

function canUseStorage(rootRef: Window): boolean {
  try { return !!(rootRef && rootRef.localStorage); } catch (e) { return false; }
}

function readStoredStoneSkinId(rootRef: Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }): string {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_STONE_SKIN_ID) || 'default').trim() || 'default';
  if (!canUseStorage(rootRef)) return fallbackId;
  try {
    const storedValue = rootRef.localStorage.getItem(STONE_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_STONE_SKIN_STORAGE_KEY);
    if (catalogModule && typeof catalogModule.normalizeStoneSkinId === 'function') {
      return catalogModule.normalizeStoneSkinId(storedValue, rootRef);
    }
    return String(storedValue || '').trim() || fallbackId;
  } catch (e) {
    return fallbackId;
  }
}

function writeStoredStoneSkinId(rootRef: Window & { StoneSkinCatalogModule?: StoneSkinCatalogModule }, skinId: string): boolean {
  if (!canUseStorage(rootRef)) return false;
  const catalogModule = resolveCatalogModule(rootRef);
  const definition = catalogModule && typeof catalogModule.getStoneSkinDefinition === 'function'
    ? catalogModule.getStoneSkinDefinition(skinId, rootRef)
    : { id: 'default' };
  try {
    if (definition) {
      rootRef.localStorage.setItem(STONE_SKIN_STORAGE_KEY, definition.id);
      rootRef.localStorage.setItem(LEGACY_STONE_SKIN_STORAGE_KEY, definition.id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export = {
  STONE_SKIN_STORAGE_KEY,
  LEGACY_STONE_SKIN_STORAGE_KEY,
  readStoredStoneSkinId,
  writeStoredStoneSkinId
};
