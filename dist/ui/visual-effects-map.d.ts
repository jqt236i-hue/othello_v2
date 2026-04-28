declare function getEffectKeyForPendingType(pendingType: string): string | null;
declare function getEffectKeyForSpecialType(type: string): string | null;
declare function normalizeOwnerValue(owner: any): number;
declare function getStoneVisualPathsForEffectKey(effectKey: string): string[];
declare function preloadStoneVisualEffectKeys(effectKeys: string | string[]): {
    started: string[];
    skipped: string[];
};
declare function applyTrapStoneFallbackVisual(discElement: HTMLElement, owner: any): Promise<boolean>;
declare function clearStoneVisualEffectState(discElement: HTMLElement, options?: any): void;
declare function applyStoneVisualEffect(discElement: HTMLElement, effectKey: string, options?: any): Promise<boolean>;
declare function removeStoneVisualEffect(discElement: HTMLElement, effectKey: string): void;
declare function getSupportedEffectKeys(): string[];
declare const VisualEffectsMap: {
    UI_STONE_VISUAL_EFFECTS: any;
    PENDING_TYPE_TO_EFFECT_KEY: any;
    getEffectKeyForPendingType: typeof getEffectKeyForPendingType;
    SPECIAL_TYPE_TO_EFFECT_KEY: any;
    getEffectKeyForSpecialType: typeof getEffectKeyForSpecialType;
    getStoneVisualPathsForEffectKey: typeof getStoneVisualPathsForEffectKey;
    preloadStoneVisualEffectKeys: typeof preloadStoneVisualEffectKeys;
    normalizeOwnerValue: typeof normalizeOwnerValue;
    applyTrapStoneFallbackVisual: typeof applyTrapStoneFallbackVisual;
    clearStoneVisualEffectState: typeof clearStoneVisualEffectState;
    applyStoneVisualEffect: typeof applyStoneVisualEffect;
    removeStoneVisualEffect: typeof removeStoneVisualEffect;
    getSupportedEffectKeys: typeof getSupportedEffectKeys;
};
export = VisualEffectsMap;
//# sourceMappingURL=visual-effects-map.d.ts.map