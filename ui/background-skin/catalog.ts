/**
 * @file catalog.ts
 * @description Background skin catalog
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface BackgroundSkinItem {
  id: string;
  label: string;
  note: string;
  imagePath: string;
}

interface OwnedCosmeticCatalogApi {
  ALL_ITEMS: BackgroundSkinItem[];
  DEFAULT_ID: string;
  normalizeCatalogItemId: (value: unknown, rootRef: Window) => string;
  getAllItems: (rootRef: Window, options?: unknown) => BackgroundSkinItem[];
  listOwnedIds: (rootRef: Window) => string[];
  isOwned: (rootRef: Window, skinId: string) => boolean;
  getOwnedItems: (rootRef: Window) => BackgroundSkinItem[];
  normalizeSelectedId: (value: unknown, rootRef: Window, options?: unknown) => string;
  getDefinition: (skinId: string, rootRef: Window, options?: unknown) => BackgroundSkinItem | null;
}

interface CosmeticCatalogSharedModule {
  createOwnedCosmeticCatalogApi: (config: {
    kind: string;
    baseItems: readonly BackgroundSkinItem[];
    defaultId: string;
    listOwnedMethodName: string;
    isOwnedMethodName: string;
  }) => OwnedCosmeticCatalogApi;
}

const BASE_BACKGROUND_SKINS: readonly BackgroundSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'default-25',
    label: '既定',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト25.webp'
  })
]);

function requireCosmeticCatalogSharedModuleOrNull(): CosmeticCatalogSharedModule | null {
  if (typeof _require !== 'function') return null;
  try {
    return _require('../cosmetics/catalog-shared');
  } catch (e) {
    /* ignore */
  }
  return null;
}

interface CustomSkinStorageModule {
  getCustomSkinDefinitions?: (rootRef: Window, kind?: string) => BackgroundSkinItem[];
}

function resolveCosmeticCatalogSharedModule(): CosmeticCatalogSharedModule | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { CosmeticCatalogSharedModule?: CosmeticCatalogSharedModule }).CosmeticCatalogSharedModule) {
      return (globalThis as unknown as Window & { CosmeticCatalogSharedModule?: CosmeticCatalogSharedModule }).CosmeticCatalogSharedModule ?? null;
    }
  } catch (e) { /* ignore */ }
  return requireCosmeticCatalogSharedModuleOrNull();
}

const sharedModule = resolveCosmeticCatalogSharedModule();
if (!sharedModule || typeof sharedModule.createOwnedCosmeticCatalogApi !== 'function') {
  throw new Error('[background-skin/catalog] missing CosmeticCatalogSharedModule');
}

const catalogApi = sharedModule.createOwnedCosmeticCatalogApi({
  kind: 'background_skin',
  baseItems: BASE_BACKGROUND_SKINS,
  defaultId: 'default-25',
  listOwnedMethodName: 'listOwnedBackgroundSkinIds',
  isOwnedMethodName: 'isBackgroundSkinOwned'
});

const BACKGROUND_SKINS = catalogApi.ALL_ITEMS;
const DEFAULT_BACKGROUND_SKIN_ID = catalogApi.DEFAULT_ID;

function resolveCustomSkinStorageModule(rootRef: Window): CustomSkinStorageModule | null {
  try {
    const ctx = rootRef as Window & { CustomSkinStorageModule?: CustomSkinStorageModule };
    if (ctx && ctx.CustomSkinStorageModule) return ctx.CustomSkinStorageModule;
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule) {
      return (globalThis as unknown as { CustomSkinStorageModule?: CustomSkinStorageModule }).CustomSkinStorageModule ?? null;
    }
  } catch (e) { /* ignore */ }
  try {
    return _require('../custom-skin/storage');
  } catch (e) { /* ignore */ }
  return null;
}

function getCustomBackgroundSkins(rootRef: Window): BackgroundSkinItem[] {
  const storage = resolveCustomSkinStorageModule(rootRef);
  if (!storage || typeof storage.getCustomSkinDefinitions !== 'function') return [];
  return storage.getCustomSkinDefinitions(rootRef, 'background')
    .filter((item): item is BackgroundSkinItem => !!item && String(item.imagePath || '').trim() !== '')
    .map((item) => ({ ...item }));
}

function normalizeCatalogBackgroundSkinId(value: unknown, rootRef: Window): string {
  return catalogApi.normalizeCatalogItemId(value, rootRef);
}

function getAllBackgroundSkins(rootRef: Window, options?: unknown): BackgroundSkinItem[] {
  return catalogApi.getAllItems(rootRef, options).concat(getCustomBackgroundSkins(rootRef));
}

function listOwnedBackgroundSkinIds(rootRef: Window): string[] {
  return catalogApi.listOwnedIds(rootRef).concat(getCustomBackgroundSkins(rootRef).map((item) => item.id));
}

function isBackgroundSkinOwned(rootRef: Window, skinId: string): boolean {
  if (getCustomBackgroundSkins(rootRef).some((item) => item.id === String(skinId || '').trim())) return true;
  return catalogApi.isOwned(rootRef, skinId);
}

function getOwnedBackgroundSkins(rootRef: Window): BackgroundSkinItem[] {
  return getAllBackgroundSkins(rootRef).filter((item) => isBackgroundSkinOwned(rootRef, item.id));
}

function normalizeBackgroundSkinId(value: unknown, rootRef: Window, options?: unknown): string {
  const normalized = normalizeCatalogBackgroundSkinId(value, rootRef);
  if (getCustomBackgroundSkins(rootRef).some((item) => item.id === normalized)) return normalized;
  return catalogApi.normalizeSelectedId(value, rootRef, options);
}

function getBackgroundSkinDefinition(skinId: string, rootRef: Window, options?: unknown): BackgroundSkinItem | null {
  const normalized = normalizeCatalogBackgroundSkinId(skinId, rootRef);
  const custom = getCustomBackgroundSkins(rootRef).find((item) => item.id === normalized);
  if (custom) return { ...custom };
  return catalogApi.getDefinition(skinId, rootRef, options);
}

export = {
  BASE_BACKGROUND_SKINS,
  BACKGROUND_SKINS,
  DEFAULT_BACKGROUND_SKIN_ID,
  normalizeCatalogBackgroundSkinId,
  getAllBackgroundSkins,
  listOwnedBackgroundSkinIds,
  isBackgroundSkinOwned,
  getOwnedBackgroundSkins,
  normalizeBackgroundSkinId,
  getBackgroundSkinDefinition
};
