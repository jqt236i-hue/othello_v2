interface Draft {
    countsById: Record<string, number>;
    totalCount: number;
}
declare function createEmptyDraft(): Draft;
declare function cloneDraft(draft?: any): Draft;
declare function createDraftFromDeckSpec(deckSpec: any): Draft;
declare function getSelectedCount(draft: any, cardId: string): number;
declare function canAddCardToDraft(draft: any, cardId: string): boolean;
declare function addCardToDraft(draft: any, cardId: string): Draft;
declare function removeCardFromDraft(draft: any, cardId: string): Draft;
declare function clearCardFromDraft(draft: any, cardId: string): Draft;
declare function advanceCardSelection(draft: any, cardId: string): Draft;
declare function createExpandedCardIdsFromDraft(draft: any): string[];
declare function createDeckSpecFromDraft(draft: any): any;
declare function getDraftSummary(draft: any): any;
declare function listSelectedCards(draft: any): any[];
declare const DeckBuilderState: {
    createEmptyDraft: typeof createEmptyDraft;
    cloneDraft: typeof cloneDraft;
    createDraftFromDeckSpec: typeof createDraftFromDeckSpec;
    getSelectedCount: typeof getSelectedCount;
    canAddCardToDraft: typeof canAddCardToDraft;
    addCardToDraft: typeof addCardToDraft;
    removeCardFromDraft: typeof removeCardFromDraft;
    clearCardFromDraft: typeof clearCardFromDraft;
    advanceCardSelection: typeof advanceCardSelection;
    createExpandedCardIdsFromDraft: typeof createExpandedCardIdsFromDraft;
    createDeckSpecFromDraft: typeof createDeckSpecFromDraft;
    getDraftSummary: typeof getDraftSummary;
    listSelectedCards: typeof listSelectedCards;
};
export = DeckBuilderState;
//# sourceMappingURL=deck-builder-state.d.ts.map