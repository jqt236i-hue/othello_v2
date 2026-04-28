/**
 * @file gacha-item-visuals.ts
 * @description Gacha item visual rendering utilities
 */
interface GachaItem {
    kind?: string;
    previewImagePath?: string;
    imagePath?: string;
}
declare function normalizeItemKind(item: GachaItem | null | undefined): string;
declare function getItemKindLabel(item: GachaItem | null | undefined): string;
declare function getItemPreviewPath(item: GachaItem | null | undefined): string;
declare function createSoundFallbackTile(docRef: Document, className: string): HTMLElement;
declare function applyItemPreviewState(item: GachaItem, imageEl: HTMLImageElement | null | undefined, fallbackEl: HTMLElement | null | undefined): void;
declare const _default: {
    normalizeItemKind: typeof normalizeItemKind;
    getItemKindLabel: typeof getItemKindLabel;
    getItemPreviewPath: typeof getItemPreviewPath;
    createSoundFallbackTile: typeof createSoundFallbackTile;
    applyItemPreviewState: typeof applyItemPreviewState;
};
export = _default;
//# sourceMappingURL=gacha-item-visuals.d.ts.map