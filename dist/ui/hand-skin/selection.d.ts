/**
 * @file selection.ts
 * @description Hand skin selection management
 */
interface HandSkinDefinition {
    id: string;
    label: string;
    note?: string;
    imagePath?: string;
}
interface HandSkinCatalogModule {
    DEFAULT_HAND_SKIN_ID?: string;
    normalizeHandSkinId?: (value: string | null, rootRef: Window) => string;
    getHandSkinDefinition?: (skinId: string, rootRef: Window) => HandSkinDefinition | null;
}
declare function readStoredHandSkinId(rootRef: Window & {
    HandSkinCatalogModule?: HandSkinCatalogModule;
}): string;
declare function writeStoredHandSkinId(rootRef: Window & {
    HandSkinCatalogModule?: HandSkinCatalogModule;
}, skinId: string): boolean;
declare const _default: {
    HAND_SKIN_STORAGE_KEY: string;
    readStoredHandSkinId: typeof readStoredHandSkinId;
    writeStoredHandSkinId: typeof writeStoredHandSkinId;
};
export = _default;
//# sourceMappingURL=selection.d.ts.map