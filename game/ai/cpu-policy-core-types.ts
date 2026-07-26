import type {
    CpuCandidateScoringBatch,
    CpuCandidateScoringIdentity,
    CpuCandidateScoringRequest
} from './cpu-candidate-scoring';

export type CpuPolicyCardId = string;
export type CpuPolicyBoardCell = 1 | -1 | 0 | number | null | undefined;
export type CpuPolicyBoard = CpuPolicyBoardCell[][];

export interface CpuPolicyPosition {
    row: number;
    col: number;
}

export type CpuPolicyFlip = CpuPolicyPosition | readonly [number, number];

export interface CpuPolicyMove extends CpuPolicyPosition {
    row: number;
    col: number;
    flips?: CpuPolicyFlip[];
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

export interface CpuPolicyLegalMoveMetrics {
    maxLegalFlips: number;
    avgLegalFlips: number;
    maxLegalGain: number;
    maxLegalBoardBonus: number;
}

export type CpuPolicyBoardBonusResolver = (row: number, col: number, move: CpuPolicyMove) => number;

export type CpuPolicyPlacementSeat = 'corner' | 'edge' | 'inner' | 'c' | 'x';

export interface CpuPolicyPlacementFeatures {
    row: number;
    col: number;
    playerValue: number;
    seat: CpuPolicyPlacementSeat;
    isCorner: boolean;
    isEdge: boolean;
    isInner: boolean;
    isCSquare: boolean;
    isXSquare: boolean;
    isOpenCornerAdjacentRisk: boolean;
    cornerTaken: boolean;
    cornerDonation: boolean;
    opponentNextCorner: boolean;
    opponentCornerReplyCount: number;
    ownSafeEdgeRunBefore: number;
    ownSafeEdgeRunAfter: number;
    ownSafeEdgeRunDelta: number;
    ownAnchoredEdgeBefore: number;
    ownAnchoredEdgeAfter: number;
    ownAnchoredEdgeDelta: number;
    extendsOwnSafeEdge: boolean;
    opponentSafeEdgeRunBefore: number;
    opponentSafeEdgeRunAfter: number;
    opponentSafeEdgeRunDelta: number;
    opponentSafeEdgeRunAllowedCount: number;
    allowsOpponentSafeEdgeRun: boolean;
    breaksOpponentEdgeRun: boolean;
    ownEdgeGapBefore: number;
    ownEdgeGapAfter: number;
    ownEdgeGapDelta: number;
    createsOwnEdgeGap: boolean;
    boardBonus: number;
    flipCount: number;
    ownDiscCountAfter: number;
    ownLegalMovesAfter: number;
    hasCornerEscape: boolean;
    lowMobilityRisk: boolean;
    badLowMobilityRisk: boolean;
}

export interface CpuPolicyLookaheadSearchMeta {
    endgameMode: boolean;
    empties: number;
    depth: number;
    branchLimit: number | null;
    nodeBudget: number;
    timeBudgetMs: number | null;
    ownMoves: number;
    oppMoves: number;
    effectivePriorWeight: number;
    effectiveSearchWeight: number;
    parityOddRegionCount: number;
    parityEvenRegionCount: number;
    paritySignal: number;
    forcedPassSignal: number;
}

export interface CpuPolicyMoveOptions {
    board?: CpuPolicyBoard | null;
    enableHeuristic?: boolean;
    playerValue?: 1 | -1 | number;
    level?: number;
    depth?: number;
    maxBranch?: number | null;
    nodeBudget?: number;
    endgameNodeBudget?: number;
    timeBudgetMs?: number | null;
    endgameSolveEmpties?: number;
    disableEndgameSolve?: boolean;
    virtualTimePerNodeMs?: number | null;
    readNowMs?: (() => number) | null;
    boardBonusByCell?: Record<string, number> | null;
    boardBonusConsumedByCell?: Record<string, boolean> | null;
    priorWeight?: number;
    searchWeight?: number;
    scoreMove?: (move: CpuPolicyMove) => number;
    expectedCandidateScoringRequest?: CpuCandidateScoringRequest | null;
    candidateScoringBatch?: CpuCandidateScoringBatch | null;
    onSearchMeta?: (meta: CpuPolicyLookaheadSearchMeta) => void;
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
    applyMoveToBoard(
        board: CpuPolicyBoard | null | undefined,
        move: CpuPolicyMove | null | undefined,
        playerValue: number
    ): CpuPolicyBoard;
    computeLegalMoveMetrics(legalMoves: CpuPolicyMove[], getBoardBonus?: CpuPolicyBoardBonusResolver): CpuPolicyLegalMoveMetrics;
    createExpectedCandidateScoringRequest(
        candidateMoves: CpuPolicyMove[],
        level: number,
        board: CpuPolicyBoard | null,
        identity: CpuCandidateScoringIdentity | CpuCandidateScoringRequest | null
    ): CpuCandidateScoringRequest;
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
    evaluatePlacementCandidate(move: CpuPolicyMove, context?: CpuPolicyMoveOptions): CpuPolicyPlacementFeatures;
    scoreMoveForCornerEdgePlan(move: CpuPolicyMove, context?: CpuPolicyMoveOptions): number;
    scoreMoveHeuristic(move: CpuPolicyMove, level?: number, boardOrRows?: CpuPolicyBoard | number | null, colsMaybe?: number): number;
}
