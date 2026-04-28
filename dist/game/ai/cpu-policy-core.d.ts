export function chooseHandDestroyTargetForCycle(handCardIds: any, usableCardIds: any, getCardCost: any, getCardDef: any, context: any): {
    cardId: string;
    cardDef: any;
    cardType: any;
    score: number;
    reason: string;
} | null;
export function chooseCardWithRiskProfile(usableCardIds: any, getCardCost: any, getCardDef: any, context: any): {
    cardId: any;
    cardDef: any;
    score: number;
} | null;
export function chooseHighestCostCard(usableCardIds: any, getCardCost: any, getCardDef: any): {
    cardId: any;
    cardDef: any;
} | null;
export function chooseLowestRetentionCard(handCardIds: any, getCardCost: any, getCardDef: any, context: any): {
    cardId: any;
    cardDef: any;
    cardType: any;
    cardCost: number;
    score: number;
} | null;
export function chooseMoveByLookahead(candidateMoves: any, options: any): any;
export function chooseMove(candidateMoves: any, level: any, rng: any, selectMoveWithAi: any, options: any): any;
export function computeLegalMoveMetrics(legalMoves: any, getBoardBonus: any): {
    maxLegalFlips: number;
    avgLegalFlips: number;
    maxLegalGain: number;
    maxLegalBoardBonus: number;
};
export function getMovePlanProfileForCardType(cardType: any): any;
export function isChargeRampCardType(cardType: any): any;
export function isCornerHoldCardType(cardType: any): any;
export function isCornerRecoveryCardType(cardType: any): any;
export function hasBaseScoreBonusForCardType(cardType: any): boolean;
export function hasMovePlanProfileForCardType(cardType: any): boolean;
export function hasUsageStyleForCardType(cardType: any): boolean;
export function scoreCardRetentionPriority(cardId: any, getCardCost: any, getCardDef: any, context: any): {
    cardId: any;
    cardDef: any;
    cardType: any;
    cardCost: number;
    score: number;
};
export function scoreCardUseDecision(cardId: any, getCardCost: any, getCardDef: any, context: any): {
    cardId: any;
    cardDef: any;
    cardType: any;
    cardCost: any;
    score: number;
    shouldUse: boolean;
    minUseScore: number;
    reason: string;
} | {
    cardId: any;
    cardDef: any;
    cardType: any;
    cardCost: number;
    score: number;
    shouldUse: boolean;
    minUseScore: number;
};
export function scoreMoveForCornerEdgePlan(move: any, context: any): number;
export function scoreMoveHeuristic(move: any, level: any, boardOrRows: any, colsMaybe: any): number;
export { chooseLowestRetentionCard as chooseSellCardTargetByRetention, scoreCardRetentionPriority as scoreCardRetentionForSell };
//# sourceMappingURL=cpu-policy-core.d.ts.map