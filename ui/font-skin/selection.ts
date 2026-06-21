/**
 * @file selection.ts
 * @description Font skin selection management
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface FontSkinDefinition {
  id: string;
}

interface FontSkinCatalogModule {
  DEFAULT_FONT_SKIN_ID?: string;
  normalizeFontSkinId?: (value: string | null, rootRef: Window) => string;
  getFontSkinDefinition?: (skinId: string, rootRef: Window) => FontSkinDefinition | null;
}

const FONT_SKIN_STORAGE_KEY = 'reversi.fontSkin';
const LEGACY_FONT_SKIN_STORAGE_KEY = 'othello.fontSkin';

function requireFontSkinCatalogModuleOrNull(): FontSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window & { FontSkinCatalogModule?: FontSkinCatalogModule }): FontSkinCatalogModule | null {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.FontSkinCatalogModule) return ctx.FontSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { FontSkinCatalogModule?: FontSkinCatalogModule }).FontSkinCatalogModule) {
      return (globalThis as unknown as Window & { FontSkinCatalogModule?: FontSkinCatalogModule }).FontSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireFontSkinCatalogModuleOrNull();
}

function canUseStorage(rootRef: Window): boolean {
  try { return !!(rootRef && rootRef.localStorage); } catch (e) { return false; }
}

function readStoredFontSkinId(rootRef: Window & { FontSkinCatalogModule?: FontSkinCatalogModule }): string {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_FONT_SKIN_ID) || 'shippori-mincho').trim() || 'shippori-mincho';
  if (!canUseStorage(rootRef)) return fallbackId;
  try {
    if (catalogModule && typeof catalogModule.normalizeFontSkinId === 'function') {
      return catalogModule.normalizeFontSkinId(
        rootRef.localStorage.getItem(FONT_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_FONT_SKIN_STORAGE_KEY),
        rootRef
      );
    }
    return String(rootRef.localStorage.getItem(FONT_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_FONT_SKIN_STORAGE_KEY) || '').trim() || fallbackId;
  } catch (e) {
    return fallbackId;
  }
}

function writeStoredFontSkinId(rootRef: Window & { FontSkinCatalogModule?: FontSkinCatalogModule }, skinId: string): boolean {
  if (!canUseStorage(rootRef)) return false;
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_FONT_SKIN_ID) || 'shippori-mincho').trim() || 'shippori-mincho';
  const definition = catalogModule && typeof catalogModule.getFontSkinDefinition === 'function'
    ? catalogModule.getFontSkinDefinition(skinId, rootRef)
    : { id: fallbackId };
  try {
    if (definition) {
      rootRef.localStorage.setItem(FONT_SKIN_STORAGE_KEY, definition.id);
      rootRef.localStorage.setItem(LEGACY_FONT_SKIN_STORAGE_KEY, definition.id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export = {
  FONT_SKIN_STORAGE_KEY,
  LEGACY_FONT_SKIN_STORAGE_KEY,
  readStoredFontSkinId,
  writeStoredFontSkinId
};
