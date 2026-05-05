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
    id: 'default',
    label: '既定背景',
    note: '初期所持',
    imagePath: 'assets/images/background/default.png'
  }),
  Object.freeze({
    id: 'observation-desk',
    label: '観測の机',
    note: '初期所持',
    imagePath: 'assets/images/background/観測の机.png'
  })
]);

function resolveCosmeticCatalogSharedModule(): CosmeticCatalogSharedModule | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { CosmeticCatalogSharedModule?: CosmeticCatalogSharedModule }).CosmeticCatalogSharedModule) {
      return (globalThis as unknown as Window & { CosmeticCatalogSharedModule?: CosmeticCatalogSharedModule }).CosmeticCatalogSharedModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try { return _require('../cosmetics/catalog-shared'); } catch (e) { /* ignore */ }
  }
  return null;
}

const sharedModule = resolveCosmeticCatalogSharedModule();
if (!sharedModule || typeof sharedModule.createOwnedCosmeticCatalogApi !== 'function') {
  throw new Error('[background-skin/catalog] missing CosmeticCatalogSharedModule');
}

const catalogApi = sharedModule.createOwnedCosmeticCatalogApi({
  kind: 'background_skin',
  baseItems: BASE_BACKGROUND_SKINS,
  defaultId: BASE_BACKGROUND_SKINS[0].id,
  listOwnedMethodName: 'listOwnedBackgroundSkinIds',
  isOwnedMethodName: 'isBackgroundSkinOwned'
});

const BACKGROUND_SKINS = catalogApi.ALL_ITEMS;
const DEFAULT_BACKGROUND_SKIN_ID = catalogApi.DEFAULT_ID;

function normalizeCatalogBackgroundSkinId(value: unknown, rootRef: Window): string {
  return catalogApi.normalizeCatalogItemId(value, rootRef);
}

function getAllBackgroundSkins(rootRef: Window, options?: unknown): BackgroundSkinItem[] {
  return catalogApi.getAllItems(rootRef, options);
}

function listOwnedBackgroundSkinIds(rootRef: Window): string[] {
  return catalogApi.listOwnedIds(rootRef);
}

function isBackgroundSkinOwned(rootRef: Window, skinId: string): boolean {
  return catalogApi.isOwned(rootRef, skinId);
}

function getOwnedBackgroundSkins(rootRef: Window): BackgroundSkinItem[] {
  return catalogApi.getOwnedItems(rootRef);
}

function normalizeBackgroundSkinId(value: unknown, rootRef: Window, options?: unknown): string {
  return catalogApi.normalizeSelectedId(value, rootRef, options);
}

function getBackgroundSkinDefinition(skinId: string, rootRef: Window, options?: unknown): BackgroundSkinItem | null {
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
