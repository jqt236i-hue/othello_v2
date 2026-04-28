interface Draft {
    ruleSetId: string;
    countsById: Record<string, number>;
    totalCount: number;
}
declare function createEmptyDraft(ruleSetId?: string): Draft;
declare function normalizeDraft(draft?: any): Draft;
declare function cloneDraft(draft?: any): Draft;
declare function createDraftFromStoryDeckSpec(deckSpec: any): Draft;
declare function setRuleSetId(draft: any, ruleSetId: string): Draft;
declare function getSelectedCount(draft: any, cardId: string): number;
declare function canAddCardToDraft(draft: any, cardId: string): boolean;
declare function addCardToDraft(draft: any, cardId: string): Draft;
declare function removeCardFromDraft(draft: any, cardId: string): Draft;
declare function clearCardFromDraft(draft: any, cardId: string): Draft;
declare function clearDraft(draft: any): Draft;
declare function createExpandedCardIdsFromDraft(draft: any): string[];
declare function createStoryDeckSpecFromDraft(draft: any): any;
declare function getDraftSummary(draft: any): any;
declare function listSelectedCards(draft: any): any[];
declare const StoryDeckLabState: {
    createEmptyDraft: typeof createEmptyDraft;
    normalizeDraft: typeof normalizeDraft;
    cloneDraft: typeof cloneDraft;
    createDraftFromStoryDeckSpec: typeof createDraftFromStoryDeckSpec;
    setRuleSetId: typeof setRuleSetId;
    getSelectedCount: typeof getSelectedCount;
    canAddCardToDraft: typeof canAddCardToDraft;
    addCardToDraft: typeof addCardToDraft;
    removeCardFromDraft: typeof removeCardFromDraft;
    clearCardFromDraft: typeof clearCardFromDraft;
    clearDraft: typeof clearDraft;
    createExpandedCardIdsFromDraft: typeof createExpandedCardIdsFromDraft;
    createStoryDeckSpecFromDraft: typeof createStoryDeckSpecFromDraft;
    getDraftSummary: typeof getDraftSummary;
    listSelectedCards: typeof listSelectedCards;
};
export = StoryDeckLabState;
//# sourceMappingURL=story-deck-lab-state.d.ts.map