/**
 * @file hand-skin.ts
 * @description Hand skin UI handler
 */
interface HandSkinItem {
    id: string;
    label: string;
    note: string;
    imagePath: string;
}
declare const handSkinExports: {
    BASE_HAND_SKINS: HandSkinItem[];
    HAND_SKINS: HandSkinItem[];
    DEFAULT_HAND_SKIN_ID: string;
    HAND_SKIN_STORAGE_KEY: string;
    getAllHandSkins: (rootRef: Window, options?: unknown) => HandSkinItem[];
    applyHandSkin: (handImageEl: HTMLImageElement, skinId: string, rootRef: Window) => unknown;
    resolveHandAnimationContext: (rootRef: Window, preferredSkinId: string, options?: unknown) => unknown;
    resolveHandVisualOptions: (rootRef: Window, ownerKey: string, options?: unknown) => unknown;
    syncDisplayedHandSkin: (rootRef: Window, preferredSkinId: string, handImageEl: HTMLImageElement, options?: unknown) => unknown;
    normalizeHandSkinId: (value: unknown, rootRef: Window, options?: unknown) => string;
    readStoredHandSkinId: (rootRef: Window) => string;
    setupHandSkinControls: (options: Record<string, unknown>) => unknown;
};
export = handSkinExports;
//# sourceMappingURL=hand-skin.d.ts.map