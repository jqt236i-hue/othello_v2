/**
 * @file selection.ts
 * @description Background skin selection management
 */
interface BackgroundSkinDefinition {
    id: string;
    label: string;
    note?: string;
    imagePath?: string;
    cssBackground?: string;
}
interface BackgroundSkinCatalogModule {
    DEFAULT_BACKGROUND_SKIN_ID?: string;
    normalizeBackgroundSkinId?: (value: string | null, rootRef: Window) => string;
    getBackgroundSkinDefinition?: (skinId: string, rootRef: Window) => BackgroundSkinDefinition | null;
}
declare function readStoredBackgroundSkinId(rootRef: Window & {
    BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule;
}): string;
declare function writeStoredBackgroundSkinId(rootRef: Window & {
    BackgroundSkinCatalogModule?: BackgroundSkinCatalogModule;
}, skinId: string): boolean;
declare const _default: {
    BACKGROUND_SKIN_STORAGE_KEY: string;
    readStoredBackgroundSkinId: typeof readStoredBackgroundSkinId;
    writeStoredBackgroundSkinId: typeof writeStoredBackgroundSkinId;
};
export = _default;
//# sourceMappingURL=selection.d.ts.map