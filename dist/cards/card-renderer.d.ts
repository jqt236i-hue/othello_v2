declare function getCardCostTier(cost: number): string;
declare function applyCardSpecialArtToFace(cardEl: any, cardDef: any, options: any): any;
declare function createCardFaceElement(cardId: any, options: any): HTMLDivElement;
declare function consumeChargeDeltaEventList(eventsSource: any, chargeDeltaHandler: any): boolean;
declare function consumeChargeDeltaEvents(cardState: any, chargeDeltaHandler: any): boolean;
declare function consumeTransientNetworkChargeDeltaEvents(chargeDeltaHandler: any): boolean;
declare function consumeChargeDeltaSourcesForRender(cardState: any, matchMode: any, chargeDeltaHandler: any): {
    consumedAuthoritativeQueue: boolean;
    consumedTransientQueue: boolean;
    allowRawFallback: boolean;
};
declare function drainVisibleChargeDeltaPopups(options: any): {
    consumedAuthoritativeQueue: boolean;
    consumedTransientQueue: boolean;
    consumedRawFallback: boolean;
};
declare function renderCardUI(): void;
declare const _default: {
    getCardCostTier: typeof getCardCostTier;
    applyCardSpecialArtToFace: typeof applyCardSpecialArtToFace;
    createCardFaceElement: typeof createCardFaceElement;
    consumeChargeDeltaEventList: typeof consumeChargeDeltaEventList;
    consumeChargeDeltaEvents: typeof consumeChargeDeltaEvents;
    consumeTransientNetworkChargeDeltaEvents: typeof consumeTransientNetworkChargeDeltaEvents;
    consumeChargeDeltaSourcesForRender: typeof consumeChargeDeltaSourcesForRender;
    drainVisibleChargeDeltaPopups: typeof drainVisibleChargeDeltaPopups;
    renderCardUI: typeof renderCardUI;
};
export = _default;
//# sourceMappingURL=card-renderer.d.ts.map