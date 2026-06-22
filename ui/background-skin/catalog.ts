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
    id: 'default-2',
    label: 'デフォルト2',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト2.png'
  }),
  Object.freeze({
    id: 'default-3',
    label: 'デフォルト3',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト3.png'
  }),
  Object.freeze({
    id: 'default-4',
    label: 'デフォルト4',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト4.png'
  }),
  Object.freeze({
    id: 'default-5',
    label: 'デフォルト5',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト5.png'
  }),
  Object.freeze({
    id: 'default-6',
    label: 'デフォルト6',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト6.png'
  }),
  Object.freeze({
    id: 'default-7',
    label: 'デフォルト7',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト7.png'
  }),
  Object.freeze({
    id: 'default-8',
    label: 'デフォルト8',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト8.png'
  }),
  Object.freeze({
    id: 'default-9',
    label: 'デフォルト9',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト9.png'
  }),
  Object.freeze({
    id: 'default-10',
    label: 'デフォルト10',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト10.png'
  }),
  Object.freeze({
    id: 'default-11',
    label: 'デフォルト11',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト11.png'
  }),
  Object.freeze({
    id: 'default-12',
    label: 'デフォルト12',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト12.png'
  }),
  Object.freeze({
    id: 'default-13',
    label: 'デフォルト13',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト13.png'
  }),
  Object.freeze({
    id: 'default-14',
    label: 'デフォルト14',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト14.png'
  }),
  Object.freeze({
    id: 'default-15',
    label: 'デフォルト15',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト15.png'
  }),
  Object.freeze({
    id: 'default-16',
    label: 'デフォルト16',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト16.png'
  }),
  Object.freeze({
    id: 'default-17',
    label: 'デフォルト17',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト17.png'
  }),
  Object.freeze({
    id: 'default-18',
    label: 'デフォルト18',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト18.png'
  }),
  Object.freeze({
    id: 'default-19',
    label: 'デフォルト19',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト19.png'
  }),
  Object.freeze({
    id: 'default-20',
    label: 'デフォルト20',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト20.png'
  }),
  Object.freeze({
    id: 'default-21',
    label: 'デフォルト21',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト21.png'
  }),
  Object.freeze({
    id: 'default-22',
    label: 'デフォルト22',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト22.png'
  }),
  Object.freeze({
    id: 'default-23',
    label: 'デフォルト23',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト23.png'
  }),
  Object.freeze({
    id: 'default-24',
    label: 'デフォルト24',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト24.png'
  }),
  Object.freeze({
    id: 'default-25',
    label: '既定',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト25.png'
  }),
  Object.freeze({
    id: 'default-26',
    label: 'デフォルト26',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト26.png'
  }),
  Object.freeze({
    id: 'default-27',
    label: 'デフォルト27',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト27.png'
  }),
  Object.freeze({
    id: 'default-28',
    label: 'デフォルト28',
    note: '初期所持',
    imagePath: 'assets/images/background/デフォルト28.png'
  }),
  Object.freeze({
    id: 'observation-desk',
    label: '観測の机',
    note: '初期所持',
    imagePath: 'assets/images/background-skin/観測の机.png'
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
