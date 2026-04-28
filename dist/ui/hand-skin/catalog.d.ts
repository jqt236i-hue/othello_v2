/**
 * @file catalog.ts
 * @description Hand skin catalog
 */
interface HandSkinItem {
    id: string;
    label: string;
    note: string;
    imagePath: string;
}
declare function normalizeCatalogHandSkinId(value: unknown, rootRef: Window): string;
declare function getAllHandSkins(rootRef: Window, options?: unknown): HandSkinItem[];
declare function listOwnedHandSkinIds(rootRef: Window): string[];
declare function isHandSkinOwned(rootRef: Window, skinId: string): boolean;
declare function getOwnedHandSkins(rootRef: Window): HandSkinItem[];
declare function normalizeHandSkinId(value: unknown, rootRef: Window, options?: unknown): string;
declare function getHandSkinDefinition(skinId: string, rootRef: Window, options?: unknown): HandSkinItem | null;
declare const _default: {
    BASE_HAND_SKINS: readonly HandSkinItem[];
    HAND_SKINS: HandSkinItem[];
    DEFAULT_HAND_SKIN_ID: string;
    normalizeCatalogHandSkinId: typeof normalizeCatalogHandSkinId;
    getAllHandSkins: typeof getAllHandSkins;
    listOwnedHandSkinIds: typeof listOwnedHandSkinIds;
    isHandSkinOwned: typeof isHandSkinOwned;
    getOwnedHandSkins: typeof getOwnedHandSkins;
    normalizeHandSkinId: typeof normalizeHandSkinId;
    getHandSkinDefinition: typeof getHandSkinDefinition;
};
export = _default;
//# sourceMappingURL=catalog.d.ts.map