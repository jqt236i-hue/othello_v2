/**
 * @file runtime.ts
 * @description Background skin runtime application
 */
interface BackgroundSkinDefinition {
    id: string;
    cssBackground?: string;
    imagePath?: string;
}
declare function resolveRootRef(rootRef: Window | null | undefined): Window | null;
declare function resolveDocument(rootRef: Window | null | undefined): Document | null;
declare function applyBackgroundSkin(rootRef: Window | null | undefined, skinId: string): BackgroundSkinDefinition | null;
declare function syncDisplayedBackgroundSkin(rootRef: Window | null | undefined, preferredSkinId: string | null | undefined): BackgroundSkinDefinition | null;
declare const _default: {
    resolveRootRef: typeof resolveRootRef;
    resolveDocument: typeof resolveDocument;
    applyBackgroundSkin: typeof applyBackgroundSkin;
    syncDisplayedBackgroundSkin: typeof syncDisplayedBackgroundSkin;
};
export = _default;
//# sourceMappingURL=runtime.d.ts.map