interface StageRefs {
    stage: HTMLElement;
    skipBtn: HTMLElement | null;
    headline: Element | null;
    subtitle: Element | null;
    hero: Element | null;
    heroRarity: Element | null;
    heroImage: Element | null;
    heroFallback: Element | null;
    heroKind: Element | null;
    heroName: Element | null;
    heroStatus: Element | null;
    grid: Element | null;
}
declare function ensureGachaRevealStage(docRef: Document, overlay: HTMLElement): StageRefs | null;
declare function populateHero(refs: StageRefs, pull: any, newlyUnlockedIdSet: Set<string>): void;
declare function populateGrid(refs: StageRefs, pulls: any[], newlyUnlockedIdSet: Set<string>, spotlightPull: any): void;
declare function resetStageVisualState(stage: HTMLElement, isTenPull: boolean): void;
declare function hideStage(stage: HTMLElement): void;
declare const GachaRevealStage: {
    ensureGachaRevealStage: typeof ensureGachaRevealStage;
    populateHero: typeof populateHero;
    populateGrid: typeof populateGrid;
    resetStageVisualState: typeof resetStageVisualState;
    hideStage: typeof hideStage;
};
export = GachaRevealStage;
//# sourceMappingURL=gacha-reveal-stage.d.ts.map