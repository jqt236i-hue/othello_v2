import type {
    CpuPolicyBoard,
    CpuPolicyCardContext,
    CpuPolicyMove,
    CpuPolicyPlacementFeatures,
    CpuPolicyPosition
} from './cpu-policy-core-types';

type CpuPolicyMovePlanProfile = Record<string, string | number>;

interface CpuPolicyEdgeRunSummary extends Record<string, unknown> {
    chainStrength?: number;
    longestRun?: number;
    completeLineCount?: number;
    loneDiscCount?: number;
}

type CpuPolicyMovePlanScoringDeps = {
    asRecord?: (value: unknown) => Record<string, unknown>;
    isFiniteNumber?: (value: unknown) => boolean;
    scoreMoveHeuristic?: (move: CpuPolicyMove, level?: number, board?: CpuPolicyBoard | null) => number;
    isCorner?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isEdge?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isXSquare?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isCSquare?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    adjacentCornerFor?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => CpuPolicyPosition | null;
    getBoardCellValueSafe?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => unknown;
    inBoard?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => boolean;
    isPseudoCornerXSquare?: (board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number) => boolean;
    getBoardBonusAtCell?: (
        boardBonusByCell: Record<string, number> | null | undefined,
        consumedByCell: Record<string, boolean> | Record<string, boolean | number> | null | undefined,
        row: number,
        col: number
    ) => number;
    applyMoveToBoard?: (board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number) => CpuPolicyBoard;
    getLegalMovesBasic?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyMove[];
    getMovePlanProfileForCardType?: (cardType: unknown) => CpuPolicyMovePlanProfile | null;
    countCornerMovesFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    countCornersFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    countEdgesFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    summarizeEdgeRunsFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyEdgeRunSummary;
    countFrontierDiscsFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    countAnchoredEdgeDiscsFromCorners?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    computePlacementStabilityProxy?: (board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number) => number;
    countAdjacentCellsByValue?: (board: CpuPolicyBoard | null | undefined, row: number, col: number, value: number) => number;
    countAdjacentLoneEdgeDiscsFor?: (board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number) => number;
    countXsAndCsFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => { x: number; c: number };
    countBoardDiscsForPlayer?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => { empties: number };
    evaluatePlacementCandidate?: (move: CpuPolicyMove, context?: CpuPolicyCardContext) => CpuPolicyPlacementFeatures | null | undefined;
};

function fallbackAsRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function fallbackEdgeRunSummary(): CpuPolicyEdgeRunSummary {
    return {};
}

function fallbackRiskCounts(): { x: number; c: number } {
    return { x: 0, c: 0 };
}

function resolveMovePlanProfile(
    deps: { asRecord: (value: unknown) => Record<string, unknown>; getMovePlanProfileForCardType: (cardType: unknown) => CpuPolicyMovePlanProfile | null; },
    context: CpuPolicyCardContext | Record<string, unknown> | null | undefined
): CpuPolicyMovePlanProfile | null {
    const ctx = deps.asRecord(context);
    if (ctx.movePlanProfile && typeof ctx.movePlanProfile === 'object') {
        return ctx.movePlanProfile as CpuPolicyMovePlanProfile;
    }
    if (String(ctx.pendingType || '').trim()) {
        return deps.getMovePlanProfileForCardType(String(ctx.pendingType || '').trim());
    }
    if (String(ctx.cardType || '').trim()) {
        return deps.getMovePlanProfileForCardType(String(ctx.cardType || '').trim());
    }
    return null;
}

export function createCpuPolicyMovePlanScoring(deps?: CpuPolicyMovePlanScoringDeps) {
    const asRecord = typeof deps?.asRecord === 'function' ? deps.asRecord : fallbackAsRecord;
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const scoreMoveHeuristic = typeof deps?.scoreMoveHeuristic === 'function' ? deps.scoreMoveHeuristic : (() => 0);
    const isCorner = typeof deps?.isCorner === 'function' ? deps.isCorner : (() => false);
    const isEdge = typeof deps?.isEdge === 'function' ? deps.isEdge : (() => false);
    const isXSquare = typeof deps?.isXSquare === 'function' ? deps.isXSquare : (() => false);
    const isCSquare = typeof deps?.isCSquare === 'function' ? deps.isCSquare : (() => false);
    const adjacentCornerFor = typeof deps?.adjacentCornerFor === 'function' ? deps.adjacentCornerFor : (() => null);
    const getBoardCellValueSafe = typeof deps?.getBoardCellValueSafe === 'function' ? deps.getBoardCellValueSafe : (() => 0);
    const inBoard = typeof deps?.inBoard === 'function' ? deps.inBoard : (() => true);
    const isPseudoCornerXSquare = typeof deps?.isPseudoCornerXSquare === 'function' ? deps.isPseudoCornerXSquare : (() => false);
    const getBoardBonusAtCell = typeof deps?.getBoardBonusAtCell === 'function' ? deps.getBoardBonusAtCell : (() => 0);
    const applyMoveToBoard = typeof deps?.applyMoveToBoard === 'function' ? deps.applyMoveToBoard : ((board: any) => board);
    const getLegalMovesBasic = typeof deps?.getLegalMovesBasic === 'function' ? deps.getLegalMovesBasic : (() => []);
    const getMovePlanProfileForCardType = typeof deps?.getMovePlanProfileForCardType === 'function'
        ? deps.getMovePlanProfileForCardType
        : (() => null);
    const countCornerMovesFor = typeof deps?.countCornerMovesFor === 'function' ? deps.countCornerMovesFor : (() => 0);
    const countCornersFor = typeof deps?.countCornersFor === 'function' ? deps.countCornersFor : (() => 0);
    const countEdgesFor = typeof deps?.countEdgesFor === 'function' ? deps.countEdgesFor : (() => 0);
    const summarizeEdgeRunsFor = typeof deps?.summarizeEdgeRunsFor === 'function' ? deps.summarizeEdgeRunsFor : fallbackEdgeRunSummary;
    const countFrontierDiscsFor = typeof deps?.countFrontierDiscsFor === 'function' ? deps.countFrontierDiscsFor : (() => 0);
    const countAnchoredEdgeDiscsFromCorners = typeof deps?.countAnchoredEdgeDiscsFromCorners === 'function'
        ? deps.countAnchoredEdgeDiscsFromCorners
        : (() => 0);
    const computePlacementStabilityProxy = typeof deps?.computePlacementStabilityProxy === 'function'
        ? deps.computePlacementStabilityProxy
        : (() => 0);
    const countAdjacentCellsByValue = typeof deps?.countAdjacentCellsByValue === 'function' ? deps.countAdjacentCellsByValue : (() => 0);
    const countAdjacentLoneEdgeDiscsFor = typeof deps?.countAdjacentLoneEdgeDiscsFor === 'function'
        ? deps.countAdjacentLoneEdgeDiscsFor
        : (() => 0);
    const countXsAndCsFor = typeof deps?.countXsAndCsFor === 'function' ? deps.countXsAndCsFor : fallbackRiskCounts;
    const countBoardDiscsForPlayer = typeof deps?.countBoardDiscsForPlayer === 'function'
        ? deps.countBoardDiscsForPlayer
        : (() => ({ empties: 0 }));
    const evaluatePlacementCandidate = typeof deps?.evaluatePlacementCandidate === 'function'
        ? deps.evaluatePlacementCandidate
        : (() => null);

    function evaluateImmediateCornerDonation(
        board: CpuPolicyBoard | null | undefined,
        move: CpuPolicyMove | null | undefined,
        playerValue: number
    ): { oppCornerMoves: number; donatesCornerNow: boolean } {
        if (!board || typeof board !== 'object' || !move) {
            return {
                oppCornerMoves: 0,
                donatesCornerNow: false
            };
        }
        const row = Number(move.row);
        const col = Number(move.col);
        if (!Number.isInteger(row) || !Number.isInteger(col) || !inBoard(board, row, col)) {
            return {
                oppCornerMoves: 0,
                donatesCornerNow: false
            };
        }
        const after = applyMoveToBoard(board, move, playerValue);
        const oppCornerMoves = countCornerMovesFor(after, -playerValue);
        return {
            oppCornerMoves,
            donatesCornerNow: oppCornerMoves > 0
        };
    }

    function scoreMoveForCornerEdgePlan(move: CpuPolicyMove, context?: CpuPolicyCardContext): number {
        const ctx = asRecord(context);
        const level = isFiniteNumber(ctx.level) ? Math.max(1, Math.floor(Number(ctx.level))) : 1;
        const whiteLv6Mode = level >= 6 && Number(ctx.playerValue) < 0;
        const row = isFiniteNumber(move && move.row) ? Number(move.row) : -1;
        const col = isFiniteNumber(move && move.col) ? Number(move.col) : -1;
        if (row < 0 || col < 0) return -999999;
        const board = ctx.board && typeof ctx.board === 'object' ? ctx.board as CpuPolicyBoard : null;

        let score = scoreMoveHeuristic(move, level, board);
        if (isCorner(row, col, board)) score += 32000;
        if (!isCorner(row, col, board) && isEdge(row, col, board)) score += 5200;
        const playerValue = isFiniteNumber(ctx.playerValue)
            ? (Number(ctx.playerValue) >= 0 ? 1 : -1)
            : 1;
        const ownMovesBefore = getLegalMovesBasic(board, playerValue);
        const ownDiscsBefore = isFiniteNumber(ctx.ownDiscs)
            ? Math.max(0, Math.floor(Number(ctx.ownDiscs)))
            : null;
        const lowMobilityBefore = ownMovesBefore.length <= 2;
        const lowDiscEmergency = ownDiscsBefore != null && ownDiscsBefore <= 8;
        const criticalLowDiscEmergency = ownDiscsBefore != null && ownDiscsBefore <= 4;
        const xSquare = isXSquare(row, col, board);
        const cSquare = !xSquare && isCSquare(row, col, board);

        const adjacentCorner = adjacentCornerFor(row, col, board);
        if (adjacentCorner && board && inBoard(board, adjacentCorner.row, adjacentCorner.col)) {
            const cornerVal = getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col);
            const cornerEmpty = cornerVal === 0;
            if (cornerEmpty && xSquare) score -= 12000;
            if (cornerEmpty && cSquare) score -= 9000;
            if (cornerVal === playerValue && xSquare) {
                score += isPseudoCornerXSquare(board, row, col, playerValue) ? 2400 : 1800;
            }
            if (cornerVal === playerValue && cSquare) score += 800;
        }

        const bonusValue = getBoardBonusAtCell(
            asRecord(ctx.boardBonusByCell) as Record<string, number>,
            asRecord(ctx.boardBonusConsumedByCell) as Record<string, boolean>,
            row,
            col
        );
        if (bonusValue > 0) {
            const bonusWeight = whiteLv6Mode ? 200 : 220;
            score += bonusValue * bonusWeight;
            if (whiteLv6Mode && !isCorner(row, col, board) && !isEdge(row, col, board)) {
                score += bonusValue * 36;
            }
            const reserveRecoveryCardCostGap = isFiniteNumber(ctx.reserveRecoveryCardCostGap)
                ? Number(ctx.reserveRecoveryCardCostGap)
                : 0;
            if (reserveRecoveryCardCostGap > 0) {
                score += bonusValue * 80;
            }
        }

        if (!board || !inBoard(board, row, col)) return score;

        const after = applyMoveToBoard(board, move, playerValue);
        const oppMoves = getLegalMovesBasic(after, -playerValue);
        const ownMovesAfter = getLegalMovesBasic(after, playerValue);
        const ownCornerRepliesAfter = countCornerMovesFor(after, playerValue);
        const placementFeatures = evaluatePlacementCandidate(move, Object.assign({}, ctx, {
            board,
            playerValue,
            level
        }));
        const movePlanProfile = resolveMovePlanProfile({ asRecord, getMovePlanProfileForCardType }, ctx);
        let oppCornerMoves = 0;
        let oppEdgeMoves = 0;
        for (const one of oppMoves) {
            if (!one) continue;
            if (isCorner(one.row, one.col, after)) oppCornerMoves += 1;
            if (!isCorner(one.row, one.col, after) && isEdge(one.row, one.col, after)) oppEdgeMoves += 1;
        }

        if (!isCorner(row, col, board) && oppCornerMoves > 0) {
            const mitigation = ctx.reserveRecoveryCardReady === true ? 0.55 : 1;
            const cornerPunishBase = level >= 6 ? 25000 : 14500;
            score -= Math.round(oppCornerMoves * cornerPunishBase * mitigation);
        }
        if (level >= 6 && !isCorner(row, col, board) && oppCornerMoves > 0 && ownCornerRepliesAfter <= 0) {
            const afterStat = countBoardDiscsForPlayer(after, playerValue);
            const emptiesAfter = Number.isFinite(afterStat.empties) ? Number(afterStat.empties) : 0;
            const phaseWeight = emptiesAfter >= 24 ? 1.2 : (emptiesAfter >= 14 ? 1.0 : 0.7);
            score -= Math.round(oppCornerMoves * 22000 * phaseWeight);
            if (whiteLv6Mode) {
                score -= Math.round(oppCornerMoves * 5000 * phaseWeight);
            }
        }
        if (
            whiteLv6Mode &&
            bonusValue > 0 &&
            !isCorner(row, col, board) &&
            oppCornerMoves > 0
        ) {
            score -= (4200 + (bonusValue * 380));
        }

        if (isCorner(row, col, board)) {
            score += 5000;
            if (ctx.hasCornerHoldCardReady === true) score += 2200;
        }
        if (whiteLv6Mode && !isCorner(row, col, board) && isEdge(row, col, board)) {
            score += 980;
        }
        if (whiteLv6Mode && !isCorner(row, col, board) && !isEdge(row, col, board) && bonusValue <= 0) {
            score -= 320;
        }

        score += Math.max(-2500, (14 - oppMoves.length) * 95);
        score += Math.max(-1800, -oppEdgeMoves * 130);

        if (whiteLv6Mode && criticalLowDiscEmergency) {
            if (ownMovesAfter.length <= 0) score -= 4200;
            else if (ownMovesAfter.length === 1) score -= 1800;
            else score += Math.min(1600, ownMovesAfter.length * 260);
            if (oppMoves.length <= 2) score += (3 - oppMoves.length) * 380;
        }

        const ownCornersAfter = countCornersFor(after, playerValue);
        const oppCornersAfter = countCornersFor(after, -playerValue);
        const ownCornersBefore = countCornersFor(board, playerValue);
        const oppCornersBefore = countCornersFor(board, -playerValue);
        const ownEdgesBefore = countEdgesFor(board, playerValue);
        const oppEdgesBefore = countEdgesFor(board, -playerValue);
        const ownEdgesAfter = countEdgesFor(after, playerValue);
        const oppEdgesAfter = countEdgesFor(after, -playerValue);
        const ownEdgeRunBefore = summarizeEdgeRunsFor(board, playerValue);
        const oppEdgeRunBefore = summarizeEdgeRunsFor(board, -playerValue);
        const ownEdgeRunAfter = summarizeEdgeRunsFor(after, playerValue);
        const oppEdgeRunAfter = summarizeEdgeRunsFor(after, -playerValue);
        const ownFrontierBefore = countFrontierDiscsFor(board, playerValue);
        const ownFrontierAfter = countFrontierDiscsFor(after, playerValue);
        const ownAnchoredEdgesBefore = countAnchoredEdgeDiscsFromCorners(board, playerValue);
        const ownAnchoredEdgesAfter = countAnchoredEdgeDiscsFromCorners(after, playerValue);
        const frontierDelta = ownFrontierAfter - ownFrontierBefore;
        const anchoredEdgeDelta = ownAnchoredEdgesAfter - ownAnchoredEdgesBefore;
        const stabilityProxy = computePlacementStabilityProxy(after, row, col, playerValue);
        const cornerLead = ownCornersAfter - oppCornersAfter;
        const edgeLeadBefore = ownEdgesBefore - oppEdgesBefore;
        const edgeLeadAfter = ownEdgesAfter - oppEdgesAfter;
        const edgeLeadDelta = edgeLeadAfter - edgeLeadBefore;
        const oppEdgeDelta = oppEdgesAfter - oppEdgesBefore;
        const ownEdgeChainDelta = Number(ownEdgeRunAfter.chainStrength || 0) - Number(ownEdgeRunBefore.chainStrength || 0);
        const oppEdgeChainDelta = Number(oppEdgeRunAfter.chainStrength || 0) - Number(oppEdgeRunBefore.chainStrength || 0);
        const ownLongestEdgeRunDelta = Number(ownEdgeRunAfter.longestRun || 0) - Number(ownEdgeRunBefore.longestRun || 0);
        const oppLongestEdgeRunDelta = Number(oppEdgeRunAfter.longestRun || 0) - Number(oppEdgeRunBefore.longestRun || 0);
        const ownCompleteEdgeLineDelta = Number(ownEdgeRunAfter.completeLineCount || 0) - Number(ownEdgeRunBefore.completeLineCount || 0);
        const oppCompleteEdgeLineDelta = Number(oppEdgeRunAfter.completeLineCount || 0) - Number(oppEdgeRunBefore.completeLineCount || 0);
        const ownLoneEdgeDiscDelta = Number(ownEdgeRunAfter.loneDiscCount || 0) - Number(ownEdgeRunBefore.loneDiscCount || 0);
        const adjacentLoneEnemyEdgeCount = countAdjacentLoneEdgeDiscsFor(board, row, col, -playerValue);

        if (level >= 6 && placementFeatures) {
            const ownSafeEdgeRunDelta = Number(placementFeatures.ownSafeEdgeRunDelta || 0);
            const ownAnchoredEdgeDelta = Number(placementFeatures.ownAnchoredEdgeDelta || 0);
            const opponentSafeEdgeRunDelta = Number(placementFeatures.opponentSafeEdgeRunDelta || 0);
            const ownEdgeGapDelta = Number(placementFeatures.ownEdgeGapDelta || 0);
            if (placementFeatures.cornerDonation) {
                score -= 19000 + (Math.max(0, placementFeatures.opponentCornerReplyCount || 0) * 6500);
            } else if (placementFeatures.opponentNextCorner && !isCorner(row, col, board)) {
                score -= 8500;
            }
            if (placementFeatures.isOpenCornerAdjacentRisk && !isCorner(row, col, board)) {
                score -= placementFeatures.isXSquare ? 5200 : 3200;
            }
            if (placementFeatures.extendsOwnSafeEdge) {
                score += 1900 + (Math.max(0, ownSafeEdgeRunDelta) * 820) + (Math.max(0, ownAnchoredEdgeDelta) * 940);
            }
            if (placementFeatures.breaksOpponentEdgeRun) {
                score += 1550 + (Math.max(0, -opponentSafeEdgeRunDelta) * 620);
            }
            if (placementFeatures.allowsOpponentSafeEdgeRun) {
                score -= 2600
                    + (Math.max(0, placementFeatures.opponentSafeEdgeRunAllowedCount || 0) * 1250)
                    + (Math.max(0, opponentSafeEdgeRunDelta) * 760);
            }
            if (placementFeatures.createsOwnEdgeGap) {
                score -= 2400 + (Math.max(0, ownEdgeGapDelta) * 780);
            }
            if (placementFeatures.badLowMobilityRisk) {
                score -= 4300;
            }
        }

        score += cornerLead * 2800;

        if (
            level >= 6 &&
            cornerLead <= 0 &&
            (edgeLeadBefore <= -2 || lowMobilityBefore || lowDiscEmergency || (whiteLv6Mode && edgeLeadBefore <= -1))
        ) {
            const edgeRecoveryWeight = whiteLv6Mode ? 380 : 260;
            const oppEdgeRecoveryWeight = whiteLv6Mode ? 280 : 190;
            const oppEdgePenaltyWeight = whiteLv6Mode ? 320 : 220;
            if (edgeLeadDelta !== 0) score += edgeLeadDelta * edgeRecoveryWeight;
            if (oppEdgeDelta > 0) {
                score -= oppEdgeDelta * oppEdgePenaltyWeight;
            } else if (oppEdgeDelta < 0) {
                score += (-oppEdgeDelta) * oppEdgeRecoveryWeight;
            }
            if (edgeLeadBefore <= -2 && edgeLeadAfter > edgeLeadBefore) {
                const recoveredLead = edgeLeadAfter - edgeLeadBefore;
                score += Math.min(1600, recoveredLead * (whiteLv6Mode ? 220 : 160));
            }
            if (!isCorner(row, col, board) && !isEdge(row, col, board) && edgeLeadAfter < edgeLeadBefore) {
                score -= whiteLv6Mode ? 260 : 180;
            }
        }

        if (level >= 6) {
            if (ownEdgeChainDelta !== 0) {
                score += ownEdgeChainDelta * (whiteLv6Mode ? 260 : 220);
            }
            if (oppEdgeChainDelta > 0) {
                score -= oppEdgeChainDelta * (whiteLv6Mode ? 280 : 230);
            } else if (oppEdgeChainDelta < 0) {
                score += (-oppEdgeChainDelta) * (whiteLv6Mode ? 170 : 140);
            }
            if (ownLongestEdgeRunDelta > 0) {
                score += ownLongestEdgeRunDelta * (whiteLv6Mode ? 960 : 760);
            }
            if (oppLongestEdgeRunDelta > 0) {
                score -= oppLongestEdgeRunDelta * (whiteLv6Mode ? 1280 : 980);
            } else if (oppLongestEdgeRunDelta < 0) {
                score += (-oppLongestEdgeRunDelta) * (whiteLv6Mode ? 540 : 420);
            }
            if (ownCompleteEdgeLineDelta > 0) {
                score += ownCompleteEdgeLineDelta * (whiteLv6Mode ? 5200 : 4200);
            }
            if (oppCompleteEdgeLineDelta > 0) {
                score -= oppCompleteEdgeLineDelta * (whiteLv6Mode ? 5600 : 4500);
            }
            if (ownLoneEdgeDiscDelta < 0) {
                score += (-ownLoneEdgeDiscDelta) * (whiteLv6Mode ? 360 : 260);
            } else if (!isCorner(row, col, board) && isEdge(row, col, board) && ownLoneEdgeDiscDelta > 0) {
                score -= ownLoneEdgeDiscDelta * (whiteLv6Mode ? 760 : 520);
            }
        }

        if (level >= 6 && !isCorner(row, col, board) && isEdge(row, col, board) && adjacentLoneEnemyEdgeCount > 0) {
            let loneEnemyPenalty = adjacentLoneEnemyEdgeCount * (whiteLv6Mode ? 3400 : 2600);
            if (ownEdgeChainDelta <= 0) {
                loneEnemyPenalty += adjacentLoneEnemyEdgeCount * (whiteLv6Mode ? 1700 : 1200);
            }
            if (oppEdgeChainDelta > 0 || oppLongestEdgeRunDelta > 0) {
                loneEnemyPenalty += adjacentLoneEnemyEdgeCount * (whiteLv6Mode ? 2200 : 1600);
            }
            if (ownCompleteEdgeLineDelta > 0 || ownLongestEdgeRunDelta >= 2) {
                loneEnemyPenalty = Math.round(loneEnemyPenalty * 0.42);
            }
            score -= loneEnemyPenalty;
        }

        if (level >= 6 && cornerLead > 0) {
            score += edgeLeadAfter * 460;
            if (!isCorner(row, col, board) && isEdge(row, col, board)) {
                score += 900 * cornerLead;
                if (ownEdgesAfter > ownEdgesBefore) score += 550;
            } else if (!isCorner(row, col, board) && !isEdge(row, col, board)) {
                score -= 320 * cornerLead;
            }

            if (oppMoves.length <= 4) {
                score += (5 - oppMoves.length) * 780;
            } else {
                score += Math.max(-1200, (10 - oppMoves.length) * 160);
            }
        }

        if (level >= 6 && (lowMobilityBefore || lowDiscEmergency)) {
            const survivalWeight = criticalLowDiscEmergency ? 1.4 : (lowMobilityBefore ? 1.18 : 1.0);
            if (ownMovesAfter.length <= 0) {
                score -= Math.round(5200 * survivalWeight);
            } else if (ownMovesAfter.length === 1) {
                score -= Math.round(2100 * survivalWeight);
            } else {
                score += Math.round(Math.min(2600, (ownMovesAfter.length - 1) * 520) * survivalWeight);
            }

            if (!isCorner(row, col, board) && isEdge(row, col, board)) {
                score += Math.round(1500 * survivalWeight);
                if (ownEdgesAfter > ownEdgesBefore) score += Math.round(880 * survivalWeight);
            } else if (!isCorner(row, col, board) && !isEdge(row, col, board)) {
                score -= Math.round(620 * survivalWeight);
            }

            if (oppMoves.length <= 2) score += Math.round((3 - oppMoves.length) * 620 * survivalWeight);
            if (lowMobilityBefore && ownMovesAfter.length < ownMovesBefore.length) {
                score -= Math.round((ownMovesBefore.length - ownMovesAfter.length) * 1800 * survivalWeight);
            }
        }

        if (level >= 6 && !isCorner(row, col, board)) {
            if (isEdge(row, col, board)) {
                score += 1500;
                if (oppMoves.length <= 4) score += 620;
            } else {
                score -= 520;
                if (oppMoves.length <= 4) score -= 460;
            }
        }

        const cornerLeadBefore = ownCornersBefore - oppCornersBefore;
        if (level >= 6 && cornerLeadBefore <= 0 && cornerLead > 0) {
            if (!isCorner(row, col, board) && isEdge(row, col, board)) score += 1800;
            if (!isCorner(row, col, board) && !isEdge(row, col, board)) score -= 950;
        }

        if (ctx.preferEdgeRetention === true && !isCorner(row, col, board) && isEdge(row, col, board)) {
            score += 700;
        }
        if (ctx.preferEdgeRetention === true && !isCorner(row, col, board) && !isEdge(row, col, board)) {
            score -= 280;
        }

        if (level >= 6) {
            const boundedStability = Math.max(-5, Math.min(6, stabilityProxy));
            score += Math.round(boundedStability * (whiteLv6Mode ? 210 : 170));
            if (!isCorner(row, col, board) && isEdge(row, col, board)) {
                score += anchoredEdgeDelta * (whiteLv6Mode ? 560 : 420);
                if (
                    anchoredEdgeDelta <= 0 &&
                    stabilityProxy <= 0.5 &&
                    cornerLead <= 0 &&
                    !lowMobilityBefore &&
                    !lowDiscEmergency
                ) {
                    score -= whiteLv6Mode ? 9800 : 7600;
                }
            } else if (!isCorner(row, col, board) && !isEdge(row, col, board) && anchoredEdgeDelta > 0) {
                score += anchoredEdgeDelta * (whiteLv6Mode ? 240 : 180);
            }
            if (!isCorner(row, col, board) && frontierDelta > 0) {
                score -= frontierDelta * (whiteLv6Mode ? 170 : 120);
            }
        }

        if (
            level >= 6 &&
            Number.isFinite(ctx.reserveRecoveryCardCostGap) &&
            Number(ctx.reserveRecoveryCardCostGap) > 0
        ) {
            const recoveryGap = Math.min(4, Math.max(0, Number(ctx.reserveRecoveryCardCostGap)));
            if (bonusValue > 0) score += Math.round(bonusValue * 110 * recoveryGap);
            if (!isCorner(row, col, board) && isEdge(row, col, board)) score += Math.round(280 * recoveryGap);
            if (
                !isCorner(row, col, board) &&
                !isEdge(row, col, board) &&
                bonusValue <= 0 &&
                ownMovesAfter.length <= ownMovesBefore.length
            ) {
                score -= Math.round(240 * recoveryGap);
            }
        }

        if (movePlanProfile && Number(movePlanProfile.placementWeight) > 0) {
            const flipCount = Array.isArray(move.flips) ? move.flips.length : 0;
            const oppMovesBefore = getLegalMovesBasic(board, -playerValue);
            const ownAdjAfter = countAdjacentCellsByValue(after, row, col, playerValue);
            const oppAdjBefore = countAdjacentCellsByValue(board, row, col, -playerValue);
            const emptyAdjBefore = countAdjacentCellsByValue(board, row, col, 0);
            const ownRiskBefore = countXsAndCsFor(board, playerValue);
            const ownRiskAfter = countXsAndCsFor(after, playerValue);
            const ownMobilityDelta = ownMovesAfter.length - ownMovesBefore.length;
            const oppMobilityPressure = oppMovesBefore.length - oppMoves.length;
            const profileScale = 0.32 + (Number(movePlanProfile.placementWeight) * 0.14);

            let profileScore = 0;
            if (isCorner(row, col, board)) profileScore += Number(movePlanProfile.cornerBias || 0) * 2500;
            else if (isEdge(row, col, board)) profileScore += Number(movePlanProfile.edgeBias || 0) * 1250;
            else profileScore += Number(movePlanProfile.innerBias || 0) * 900;

            profileScore += bonusValue * Number(movePlanProfile.bonusBias || 0) * 180;
            profileScore += flipCount * Number(movePlanProfile.flipBias || 0) * 240;
            profileScore += ownMobilityDelta * Number(movePlanProfile.mobilityBias || 0) * 165;
            profileScore += oppMobilityPressure * Math.max(0, Number(movePlanProfile.mobilityBias || 0)) * 95;
            profileScore += emptyAdjBefore * Number(movePlanProfile.emptyAdjBias || 0) * 145;
            profileScore += ownAdjAfter * Number(movePlanProfile.ownAdjBias || 0) * 155;
            profileScore += oppAdjBefore * Number(movePlanProfile.oppAdjBias || 0) * 155;
            profileScore -= Math.max(0, frontierDelta) * Number(movePlanProfile.frontierPenalty || 0) * 180;
            profileScore += Math.max(-5, Math.min(6, stabilityProxy)) * Number(movePlanProfile.stabilityBias || 0) * 175;
            profileScore += anchoredEdgeDelta * Math.max(0, Number(movePlanProfile.stabilityBias || 0)) * 220;
            profileScore -= Math.max(0, ownRiskAfter.x - ownRiskBefore.x) * Number(movePlanProfile.xPenalty || 0) * 900;
            profileScore -= Math.max(0, ownRiskAfter.c - ownRiskBefore.c) * Number(movePlanProfile.cPenalty || 0) * 520;

            if (isXSquare(row, col, board)) profileScore -= Number(movePlanProfile.xPenalty || 0) * 1200;
            if (isCSquare(row, col, board)) profileScore -= Number(movePlanProfile.cPenalty || 0) * 720;

            if (
                String(ctx.pendingType || '') === 'LAST_RESORT' &&
                Number.isFinite(ctx.pendingPlacementsRemaining) &&
                Number(ctx.pendingPlacementsRemaining) >= 2 &&
                !isCorner(row, col, board) &&
                !isEdge(row, col, board)
            ) {
                profileScore -= 900;
            }

            if (
                Number(movePlanProfile.stabilityBias || 0) >= 2 &&
                !isCorner(row, col, board) &&
                !isEdge(row, col, board) &&
                oppCornerMoves > 0
            ) {
                profileScore -= 1800;
            }

            score += Math.round(profileScore * profileScale);
        }

        return score;
    }

    return {
        evaluateImmediateCornerDonation,
        scoreMoveForCornerEdgePlan
    };
}
