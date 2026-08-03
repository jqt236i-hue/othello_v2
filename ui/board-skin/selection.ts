/**
 * @file selection.ts
 * @description Board surface skin selection management
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BoardSkinDefinition {
  id: string;
  label: string;
  note?: string;
  imagePath?: string;
}

interface BoardSkinCatalogModule {
  DEFAULT_BOARD_SKIN_ID?: string;
  DEFAULT_BOARD_FRAME_SKIN_ID?: string;
  normalizeBoardSkinId?: (value: string | null, rootRef: Window) => string;
  normalizeBoardFrameSkinId?: (value: string | null, rootRef: Window) => string;
  getBoardSkinDefinition?: (skinId: string, rootRef: Window) => BoardSkinDefinition | null;
  getBoardFrameSkinDefinition?: (skinId: string, rootRef: Window) => BoardSkinDefinition | null;
}

const BOARD_SKIN_STORAGE_KEY = 'reversi.boardSkin';
const LEGACY_BOARD_SKIN_STORAGE_KEY = 'othello.boardSkin';
const BOARD_FRAME_SKIN_STORAGE_KEY = 'reversi.boardFrameSkin';
const LEGACY_BOARD_FRAME_SKIN_STORAGE_KEY = 'othello.boardFrameSkin';
const FALLBACK_BOARD_SKIN_ID = 'bluegreen-felt';
const FALLBACK_BOARD_FRAME_SKIN_ID = 'submerged-wood';

function requireBoardSkinCatalogModuleOrNull(): BoardSkinCatalogModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('./catalog') ?? null;
  } catch (e) {
    /* ignore */
  }
  return null;
}

function resolveCatalogModule(rootRef: Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }): BoardSkinCatalogModule | null {
  const ctx = rootRef && typeof rootRef === 'object' ? rootRef : null;
  if (ctx && ctx.BoardSkinCatalogModule) return ctx.BoardSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }).BoardSkinCatalogModule) {
      return (globalThis as unknown as Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }).BoardSkinCatalogModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireBoardSkinCatalogModuleOrNull();
}

function canUseStorage(rootRef: Window): boolean {
  try { return !!(rootRef && rootRef.localStorage); } catch (e) { return false; }
}

function readStoredBoardSkinId(rootRef: Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }): string {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BOARD_SKIN_ID) || FALLBACK_BOARD_SKIN_ID).trim() || FALLBACK_BOARD_SKIN_ID;
  if (!canUseStorage(rootRef)) return fallbackId;
  try {
    const storedValue = rootRef.localStorage.getItem(BOARD_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_BOARD_SKIN_STORAGE_KEY);
    if (catalogModule && typeof catalogModule.normalizeBoardSkinId === 'function') {
      return catalogModule.normalizeBoardSkinId(storedValue, rootRef);
    }
    return String(storedValue || '').trim() || fallbackId;
  } catch (e) {
    return fallbackId;
  }
}

function writeStoredBoardSkinId(rootRef: Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }, skinId: string): boolean {
  if (!canUseStorage(rootRef)) return false;
  const catalogModule = resolveCatalogModule(rootRef);
  const definition = catalogModule && typeof catalogModule.getBoardSkinDefinition === 'function'
    ? catalogModule.getBoardSkinDefinition(skinId, rootRef)
    : { id: FALLBACK_BOARD_SKIN_ID };
  try {
    if (definition) {
      rootRef.localStorage.setItem(BOARD_SKIN_STORAGE_KEY, definition.id);
      rootRef.localStorage.setItem(LEGACY_BOARD_SKIN_STORAGE_KEY, definition.id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

function readStoredBoardFrameSkinId(rootRef: Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }): string {
  const catalogModule = resolveCatalogModule(rootRef);
  const fallbackId = String((catalogModule && catalogModule.DEFAULT_BOARD_FRAME_SKIN_ID) || FALLBACK_BOARD_FRAME_SKIN_ID).trim() || FALLBACK_BOARD_FRAME_SKIN_ID;
  if (!canUseStorage(rootRef)) return fallbackId;
  try {
    const storedValue = rootRef.localStorage.getItem(BOARD_FRAME_SKIN_STORAGE_KEY) || rootRef.localStorage.getItem(LEGACY_BOARD_FRAME_SKIN_STORAGE_KEY);
    if (catalogModule && typeof catalogModule.normalizeBoardFrameSkinId === 'function') {
      return catalogModule.normalizeBoardFrameSkinId(storedValue, rootRef);
    }
    return String(storedValue || '').trim() || fallbackId;
  } catch (e) {
    return fallbackId;
  }
}

function writeStoredBoardFrameSkinId(rootRef: Window & { BoardSkinCatalogModule?: BoardSkinCatalogModule }, skinId: string): boolean {
  if (!canUseStorage(rootRef)) return false;
  const catalogModule = resolveCatalogModule(rootRef);
  const definition = catalogModule && typeof catalogModule.getBoardFrameSkinDefinition === 'function'
    ? catalogModule.getBoardFrameSkinDefinition(skinId, rootRef)
    : { id: FALLBACK_BOARD_FRAME_SKIN_ID };
  try {
    if (definition) {
      rootRef.localStorage.setItem(BOARD_FRAME_SKIN_STORAGE_KEY, definition.id);
      rootRef.localStorage.setItem(LEGACY_BOARD_FRAME_SKIN_STORAGE_KEY, definition.id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export = {
  BOARD_SKIN_STORAGE_KEY,
  LEGACY_BOARD_SKIN_STORAGE_KEY,
  BOARD_FRAME_SKIN_STORAGE_KEY,
  LEGACY_BOARD_FRAME_SKIN_STORAGE_KEY,
  readStoredBoardSkinId,
  writeStoredBoardSkinId,
  readStoredBoardFrameSkinId,
  writeStoredBoardFrameSkinId
};
