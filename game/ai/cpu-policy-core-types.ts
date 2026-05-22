export type CpuPolicyCardId = string;

export interface CpuPolicyMove {
    row: number;
    col: number;
    flips?: unknown[];
    [key: string]: unknown;
}

export interface CpuPolicyCardDefinition {
    id?: string;
    type?: string;
    cardType?: string;
    cost?: number;
    [key: string]: unknown;
}

export interface CpuPolicyCardSelection {
    cardId: CpuPolicyCardId;
    cardDef: CpuPolicyCardDefinition | null;
}

export interface CpuPolicyCardScore extends CpuPolicyCardSelection {
    cardType?: string;
    cardCost?: number;
    score: number;
    [key: string]: unknown;
}

export type CpuPolicyCardCostResolver = (cardId: CpuPolicyCardId) => number;
export type CpuPolicyCardDefinitionResolver = (cardId: CpuPolicyCardId) => CpuPolicyCardDefinition | null | undefined;
export type CpuPolicyRandomSource = { random: () => number };
export type CpuPolicyAiMoveSelector = (
    candidateMoves: CpuPolicyMove[],
    level?: number,
    rng?: CpuPolicyRandomSource,
    options?: Record<string, unknown>
) => CpuPolicyMove | null | undefined;

export interface CpuPolicyCardContext {
    [key: string]: unknown;
}

export interface CpuPolicyMoveOptions {
    [key: string]: unknown;
}

export interface CpuPolicyCoreApi {
    chooseHandDestroyTargetForCycle(
        handCardIds: CpuPolicyCardId[],
        usableCardIds: CpuPolicyCardId[],
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef: CpuPolicyCardDefinitionResolver,
        context?: CpuPolicyCardContext
    ): CpuPolicyCardScore | null;
    chooseCardWithRiskProfile(
        usableCardIds: CpuPolicyCardId[],
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef: CpuPolicyCardDefinitionResolver,
        context?: CpuPolicyCardContext
    ): CpuPolicyCardScore | null;
    chooseHighestCostCard(
        usableCardIds: CpuPolicyCardId[],
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef?: CpuPolicyCardDefinitionResolver
    ): CpuPolicyCardSelection | null;
    chooseLowestRetentionCard(
        handCardIds: CpuPolicyCardId[],
        getCardCost: CpuPolicyCardCostResolver,
        getCardDef: CpuPolicyCardDefinitionResolver,
        context?: CpuPolicyCardContext
    ): CpuPolicyCardScore | null;
    chooseSellCardTargetByRetention: CpuPolicyCoreApi['chooseLowestRetentionCard'];
    chooseMoveByLookahead(candidateMoves: CpuPolicyMove[], options?: CpuPolicyMoveOptions): CpuPolicyMove | null;
    chooseMove(
        candidateMoves: CpuPolicyMove[],
        level?: number,
        rng?: CpuPolicyRandomSource,
        selectMoveWithAi?: CpuPolicyAiMoveSelector,
        options?: CpuPolicyMoveOptions
    ): CpuPolicyMove | null;
    computeLegalMoveMetrics(move: CpuPolicyMove, level?: number, boardOrRows?: unknown, colsMaybe?: unknown): Record<string, unknown>;
    getMovePlanProfileForCardType(cardType: string): Record<string, unknown> | null;
    isChargeRampCardType(cardType: string): boolean;
    isCornerHoldCardType(cardType: string): boolean;
    isCornerRecoveryCardType(cardType: string): boolean;
    hasBaseScoreBonusForCardType(cardType: string): boolean;
    hasMovePlanProfileForCardType(cardType: string): boolean;
    hasUsageStyleForCardType(cardType: string): boolean;
    scoreCardRetentionForSell(cardId: CpuPolicyCardId, getCardCost: CpuPolicyCardCostResolver, getCardDef: CpuPolicyCardDefinitionResolver, context?: CpuPolicyCardContext): CpuPolicyCardScore;
    scoreCardRetentionPriority(cardId: CpuPolicyCardId, getCardCost: CpuPolicyCardCostResolver, getCardDef: CpuPolicyCardDefinitionResolver, context?: CpuPolicyCardContext): CpuPolicyCardScore;
    scoreCardUseDecision(cardId: CpuPolicyCardId, getCardCost: CpuPolicyCardCostResolver, getCardDef: CpuPolicyCardDefinitionResolver, context?: CpuPolicyCardContext): CpuPolicyCardScore;
    scoreMoveForCornerEdgePlan(move: CpuPolicyMove, context?: CpuPolicyMoveOptions): number;
    scoreMoveHeuristic(move: CpuPolicyMove, context?: CpuPolicyMoveOptions): number;
}
