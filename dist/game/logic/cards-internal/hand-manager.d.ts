/**
 * @file hand-manager.ts
 * @description Card hand management shared between Browser and Headless.
 */
interface Context {
    constants?: any;
    helpers?: any;
    modules?: any;
}
interface HandResult {
    cardId?: string;
    cardCopyId?: number;
    handIndex?: number;
    discardIndex?: number;
    destroyedCards?: string[];
    destroyedCopyIds?: number[];
}
interface DestroyResult {
    applied: boolean;
    reason?: string;
    destroyedCardId?: string;
    destroyedCardCopyId?: number;
}
declare function ensureCardCopyState(cardState: any): any;
declare function getHandCopyIdAt(cardState: any, playerKey: string, handIndex: number): number | null;
declare function getHandCopyIds(cardState: any, playerKey: string): number[];
declare function isCardCopyIdRevealedToViewer(cardState: any, viewerKey: string, cardCopyId: number): boolean;
declare function revealCurrentHandToViewer(cardState: any, viewerKey: string, ownerKey: string): number[];
declare function addCardToHand(cardState: any, playerKey: string, cardId: string, context: Context, opts?: any): HandResult | null;
declare function addCardToDiscard(cardState: any, cardId: string, cardCopyId: number): HandResult;
declare function removeHandCardAt(cardState: any, playerKey: string, handIndex: number): HandResult | null;
declare function clearHandToDiscard(cardState: any, playerKey: string): HandResult;
declare function moveDiscardCardToHandByCardId(cardState: any, playerKey: string, cardId: string, context: Context, opts?: any): HandResult | null;
declare function dealInitialHands(cardState: any, prng: any, context: Context): void;
declare function commitDraw(cardState: any, playerKey: string, prng: any, context: Context): string | null;
declare function getCardDef(cardId: string, context: Context): any;
declare function getCardType(cardId: string, context: Context): string | null;
declare function getCardDisplayName(cardId: string, context: Context): string;
declare function getCardCodeName(displayName: string, context: Context): string | null;
declare function getCardCost(cardId: string, context: Context): number;
declare function canUseCard(cardState: any, playerKey: string, cardId: string, context: Context, opts?: any): boolean;
declare function ensureHandDestroyFlags(cardState: any): void;
declare function destroyHandCard(cardState: any, playerKey: string, cardId: string, opts: any, context: Context): DestroyResult;
declare function getUsableCardIds(cardState: any, gameState: any, playerKey: string, context: Context, opts?: any): string[];
declare function hasUsableCard(cardState: any, gameState: any, playerKey: string, context: Context): boolean;
declare const _default: {
    dealInitialHands: typeof dealInitialHands;
    commitDraw: typeof commitDraw;
    getCardDef: typeof getCardDef;
    getCardType: typeof getCardType;
    getCardDisplayName: typeof getCardDisplayName;
    getCardCodeName: typeof getCardCodeName;
    getCardCost: typeof getCardCost;
    canUseCard: typeof canUseCard;
    ensureHandDestroyFlags: typeof ensureHandDestroyFlags;
    ensureCardCopyState: typeof ensureCardCopyState;
    getHandCopyIdAt: typeof getHandCopyIdAt;
    getHandCopyIds: typeof getHandCopyIds;
    isCardCopyIdRevealedToViewer: typeof isCardCopyIdRevealedToViewer;
    revealCurrentHandToViewer: typeof revealCurrentHandToViewer;
    addCardToHand: typeof addCardToHand;
    addCardToDiscard: typeof addCardToDiscard;
    removeHandCardAt: typeof removeHandCardAt;
    clearHandToDiscard: typeof clearHandToDiscard;
    moveDiscardCardToHandByCardId: typeof moveDiscardCardToHandByCardId;
    destroyHandCard: typeof destroyHandCard;
    getUsableCardIds: typeof getUsableCardIds;
    hasUsableCard: typeof hasUsableCard;
};
export = _default;
//# sourceMappingURL=hand-manager.d.ts.map