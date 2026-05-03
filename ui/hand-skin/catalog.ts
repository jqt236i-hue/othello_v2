/**
 * @file catalog.ts
 * @description Hand skin catalog
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface HandSkinItem {
  id: string;
  label: string;
  note: string;
  imagePath: string;
}

interface OwnedCosmeticCatalogApi {
  ALL_ITEMS: HandSkinItem[];
  DEFAULT_ID: string;
  normalizeCatalogItemId: (value: unknown, rootRef: Window) => string;
  getAllItems: (rootRef: Window, options?: unknown) => HandSkinItem[];
  listOwnedIds: (rootRef: Window) => string[];
  isOwned: (rootRef: Window, skinId: string) => boolean;
  getOwnedItems: (rootRef: Window) => HandSkinItem[];
  normalizeSelectedId: (value: unknown, rootRef: Window, options?: unknown) => string;
  getDefinition: (skinId: string, rootRef: Window, options?: unknown) => HandSkinItem | null;
}

interface CosmeticCatalogSharedModule {
  createOwnedCosmeticCatalogApi: (config: {
    kind: string;
    baseItems: readonly HandSkinItem[];
    defaultId: string;
    includePreviewImagePath?: boolean;
    listOwnedMethodName: string;
    isOwnedMethodName: string;
  }) => OwnedCosmeticCatalogApi;
}

const BASE_HAND_SKINS: readonly HandSkinItem[] = Object.freeze([
  Object.freeze({
    id: 'default',
    label: '勇者の手',
    note: '初期所持',
    imagePath: 'assets/images/hand-skin/勇者の手.png'
  })
]);

function resolveCosmeticCatalogSharedModule(): CosmeticCatalogSharedModule | null {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as Window & { CosmeticCatalogSharedModule?: CosmeticCatalogSharedModule }).CosmeticCatalogSharedModule) {
      return (globalThis as unknown as Window & { CosmeticCatalogSharedModule?: CosmeticCatalogSharedModule }).CosmeticCatalogSharedModule ?? null;
    }
  } catch (e) { /* ignore */ }
  if (typeof _require === 'function') {
    try {
      return _require('../cosmetics/catalog-shared') ?? null;
    } catch (e) { /* ignore */ }
  }
  return null;
}

const sharedModule = resolveCosmeticCatalogSharedModule();
if (!sharedModule || typeof sharedModule.createOwnedCosmeticCatalogApi !== 'function') {
  throw new Error('[hand-skin/catalog] missing CosmeticCatalogSharedModule');
}

const catalogApi = sharedModule.createOwnedCosmeticCatalogApi({
  kind: 'hand_skin',
  baseItems: BASE_HAND_SKINS,
  defaultId: BASE_HAND_SKINS[0].id,
  includePreviewImagePath: false,
  listOwnedMethodName: 'listOwnedHandSkinIds',
  isOwnedMethodName: 'isHandSkinOwned'
});

const HAND_SKINS = catalogApi.ALL_ITEMS;
const DEFAULT_HAND_SKIN_ID = catalogApi.DEFAULT_ID;

function normalizeCatalogHandSkinId(value: unknown, rootRef: Window): string {
  return catalogApi.normalizeCatalogItemId(value, rootRef);
}

function getAllHandSkins(rootRef: Window, options?: unknown): HandSkinItem[] {
  return catalogApi.getAllItems(rootRef, options);
}

function listOwnedHandSkinIds(rootRef: Window): string[] {
  return catalogApi.listOwnedIds(rootRef);
}

function isHandSkinOwned(rootRef: Window, skinId: string): boolean {
  return catalogApi.isOwned(rootRef, skinId);
}

function getOwnedHandSkins(rootRef: Window): HandSkinItem[] {
  return catalogApi.getOwnedItems(rootRef);
}

function normalizeHandSkinId(value: unknown, rootRef: Window, options?: unknown): string {
  return catalogApi.normalizeSelectedId(value, rootRef, options);
}

function getHandSkinDefinition(skinId: string, rootRef: Window, options?: unknown): HandSkinItem | null {
  return catalogApi.getDefinition(skinId, rootRef, options);
}

export = {
  BASE_HAND_SKINS,
  HAND_SKINS,
  DEFAULT_HAND_SKIN_ID,
  normalizeCatalogHandSkinId,
  getAllHandSkins,
  listOwnedHandSkinIds,
  isHandSkinOwned,
  getOwnedHandSkins,
  normalizeHandSkinId,
  getHandSkinDefinition
};
