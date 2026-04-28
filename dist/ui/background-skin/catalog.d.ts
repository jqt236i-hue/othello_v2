/**
 * @file catalog.ts
 * @description Background skin catalog
 */
interface BackgroundSkinItem {
    id: string;
    label: string;
    note: string;
    imagePath: string;
}
declare function normalizeCatalogBackgroundSkinId(value: unknown, rootRef: Window): string;
declare function getAllBackgroundSkins(rootRef: Window, options?: unknown): BackgroundSkinItem[];
declare function listOwnedBackgroundSkinIds(rootRef: Window): string[];
declare function isBackgroundSkinOwned(rootRef: Window, skinId: string): boolean;
declare function getOwnedBackgroundSkins(rootRef: Window): BackgroundSkinItem[];
declare function normalizeBackgroundSkinId(value: unknown, rootRef: Window, options?: unknown): string;
declare function getBackgroundSkinDefinition(skinId: string, rootRef: Window, options?: unknown): BackgroundSkinItem | null;
declare const _default: {
    BASE_BACKGROUND_SKINS: readonly BackgroundSkinItem[];
    BACKGROUND_SKINS: BackgroundSkinItem[];
    DEFAULT_BACKGROUND_SKIN_ID: string;
    normalizeCatalogBackgroundSkinId: typeof normalizeCatalogBackgroundSkinId;
    getAllBackgroundSkins: typeof getAllBackgroundSkins;
    listOwnedBackgroundSkinIds: typeof listOwnedBackgroundSkinIds;
    isBackgroundSkinOwned: typeof isBackgroundSkinOwned;
    getOwnedBackgroundSkins: typeof getOwnedBackgroundSkins;
    normalizeBackgroundSkinId: typeof normalizeBackgroundSkinId;
    getBackgroundSkinDefinition: typeof getBackgroundSkinDefinition;
};
export = _default;
//# sourceMappingURL=catalog.d.ts.map