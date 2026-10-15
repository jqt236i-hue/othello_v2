/** Storage boundary for the selected hand mat. */
declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
type CatalogModule = typeof import('./catalog');

const HAND_MAT_SKIN_STORAGE_KEY = 'reversi.handMatSkin';
const LEGACY_HAND_MAT_SKIN_STORAGE_KEY = 'othello.handMatSkin';

function resolveCatalogModule(rootRef: any): CatalogModule | null {
  if (rootRef && rootRef.HandMatSkinCatalogModule) return rootRef.HandMatSkinCatalogModule;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).HandMatSkinCatalogModule) {
      return (globalThis as any).HandMatSkinCatalogModule;
    }
  } catch (e) { /* ignore */ }
  try { return _require('./catalog'); } catch (e) { return null; }
}

function readStoredHandMatSkinId(rootRef: any): string {
  const catalog = resolveCatalogModule(rootRef);
  const fallback = catalog ? catalog.DEFAULT_HAND_MAT_SKIN_ID : 'midnight-bookcloth';
  try {
    const storage = rootRef && rootRef.localStorage;
    if (!storage || !catalog) return fallback;
    return catalog.normalizeHandMatSkinId(
      storage.getItem(HAND_MAT_SKIN_STORAGE_KEY) || storage.getItem(LEGACY_HAND_MAT_SKIN_STORAGE_KEY),
      rootRef
    );
  } catch (e) { return fallback; }
}

function writeStoredHandMatSkinId(rootRef: any, skinId: unknown): boolean {
  const catalog = resolveCatalogModule(rootRef);
  const normalized = catalog ? catalog.normalizeHandMatSkinId(skinId, rootRef) : 'midnight-bookcloth';
  try {
    const storage = rootRef && rootRef.localStorage;
    if (!storage) return false;
    storage.setItem(HAND_MAT_SKIN_STORAGE_KEY, normalized);
    storage.setItem(LEGACY_HAND_MAT_SKIN_STORAGE_KEY, normalized);
    return true;
  } catch (e) { return false; }
}

export = {
  HAND_MAT_SKIN_STORAGE_KEY,
  LEGACY_HAND_MAT_SKIN_STORAGE_KEY,
  readStoredHandMatSkinId,
  writeStoredHandMatSkinId
};
