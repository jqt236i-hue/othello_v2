import type { CpuPolicyCardContext } from './cpu-policy-core-types';

type CpuPolicyDecisionContextDeps = {
    asRecord?: (value: unknown) => Record<string, unknown>;
    isFiniteNumber?: (value: unknown) => boolean;
    countBoardDiscsForPlayer?: (board: unknown, playerValue: number) => { own: number; opp: number; empties: number };
    countBoardEdgeDiscsForPlayer?: (board: unknown, playerValue: number) => { ownEdges: number; oppEdges: number };
    countPlayableCells?: (board: unknown) => number;
    estimateOwnOppDiscs?: (discDiff: number, empties: number | null, totalCells: number) => { own: number; opp: number };
};

function fallbackAsRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

const MOVEMENT_CORNER_SWING_CARD_TYPES = [
    'BUOYANCY_WILL',
    'GRAVITY_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL',
    'SUPER_ATTRACTION_WILL'
];

export function createCpuPolicyDecisionContext(deps?: CpuPolicyDecisionContextDeps) {
    const asRecord = typeof deps?.asRecord === 'function' ? deps.asRecord : fallbackAsRecord;
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const countBoardDiscsForPlayer = typeof deps?.countBoardDiscsForPlayer === 'function'
        ? deps.countBoardDiscsForPlayer
        : (() => ({ own: 0, opp: 0, empties: 0 }));
    const countBoardEdgeDiscsForPlayer = typeof deps?.countBoardEdgeDiscsForPlayer === 'function'
        ? deps.countBoardEdgeDiscsForPlayer
        : (() => ({ ownEdges: 0, oppEdges: 0 }));
    const countPlayableCells = typeof deps?.countPlayableCells === 'function'
        ? deps.countPlayableCells
        : null;
    const estimateOwnOppDiscs = typeof deps?.estimateOwnOppDiscs === 'function'
        ? deps.estimateOwnOppDiscs
        : ((discDiff: number, empties: number | null, totalCells: number) => {
            const emptyCount = Number.isFinite(Number(empties)) ? Number(empties) : 0;
            const occupied = Math.max(0, totalCells - emptyCount);
            const own = Math.max(0, Math.round((occupied + discDiff) / 2));
            const opp = Math.max(0, occupied - own);
            return { own, opp };
        });

    function normalizeMovementCornerSwingTargetCounts(ctx: Record<string, unknown>): Record<string, number> {
        const rawCounts = asRecord(ctx.movementCornerSwingTargetCounts);
        const hasRawCounts = !!(
            ctx.movementCornerSwingTargetCounts &&
            typeof ctx.movementCornerSwingTargetCounts === 'object'
        );
        const fallback = isFiniteNumber(ctx.movementCornerSwingTargetCount)
            ? Math.max(0, Math.floor(Number(ctx.movementCornerSwingTargetCount)))
            : 0;
        const counts: Record<string, number> = {};
        for (const cardType of MOVEMENT_CORNER_SWING_CARD_TYPES) {
            const rawValue = rawCounts[cardType];
            counts[cardType] = hasRawCounts
                ? (isFiniteNumber(rawValue) ? Math.max(0, Math.floor(Number(rawValue))) : 0)
                : fallback;
        }
        return counts;
    }

    function getMaxMovementCornerSwingTargetCount(counts: Record<string, number>): number {
        let max = 0;
        for (const cardType of MOVEMENT_CORNER_SWING_CARD_TYPES) {
            const value = Number(counts[cardType]);
            if (Number.isFinite(value) && value > max) max = Math.floor(value);
        }
        return max;
    }

    function buildCardDecisionContext(context: CpuPolicyCardContext | null | undefined) {
        const ctx = asRecord(context);
        const level = isFiniteNumber(ctx.level) ? Math.max(1, Math.floor(Number(ctx.level))) : 1;
        const playerValue = isFiniteNumber(ctx.playerValue)
            ? (Number(ctx.playerValue) >= 0 ? 1 : -1)
            : 1;
        const legalMovesCount = isFiniteNumber(ctx.legalMovesCount) ? Math.max(0, Math.floor(Number(ctx.legalMovesCount))) : 0;

        let discDiff = isFiniteNumber(ctx.discDiff) ? Number(ctx.discDiff) : 0;
        let empties: number | null = isFiniteNumber(ctx.empties) ? Math.max(0, Math.floor(Number(ctx.empties))) : null;
        let ownDiscs: number | null = isFiniteNumber(ctx.ownDiscs) ? Math.max(0, Math.floor(Number(ctx.ownDiscs))) : null;
        let oppDiscs: number | null = isFiniteNumber(ctx.oppDiscs) ? Math.max(0, Math.floor(Number(ctx.oppDiscs))) : null;
        let ownEdges: number | null = isFiniteNumber(ctx.ownEdges) ? Math.max(0, Math.floor(Number(ctx.ownEdges))) : null;
        let oppEdges: number | null = isFiniteNumber(ctx.oppEdges) ? Math.max(0, Math.floor(Number(ctx.oppEdges))) : null;
        let totalCells = isFiniteNumber(ctx.totalCells) ? Math.max(1, Math.floor(Number(ctx.totalCells))) : 64;
        if (Array.isArray(ctx.board)) {
            let cells = 0;
            for (let r = 0; r < ctx.board.length; r++) {
                const row = Array.isArray(ctx.board[r]) ? ctx.board[r] : [];
                cells += row.length;
            }
            if (countPlayableCells) {
                const topologyCells = Number(countPlayableCells(ctx.board));
                if (Number.isFinite(topologyCells) && topologyCells > 0) cells = topologyCells;
            }
            if (cells > 0) totalCells = cells;
            const boardStat = countBoardDiscsForPlayer(ctx.board, playerValue);
            const edgeStat = countBoardEdgeDiscsForPlayer(ctx.board, playerValue);
            if (!isFiniteNumber(ctx.discDiff)) discDiff = boardStat.own - boardStat.opp;
            if (!isFiniteNumber(ctx.empties)) empties = boardStat.empties;
            if (!isFiniteNumber(ctx.ownDiscs)) ownDiscs = boardStat.own;
            if (!isFiniteNumber(ctx.oppDiscs)) oppDiscs = boardStat.opp;
            if (!isFiniteNumber(ctx.ownEdges)) ownEdges = edgeStat.ownEdges;
            if (!isFiniteNumber(ctx.oppEdges)) oppEdges = edgeStat.oppEdges;
        }
        if (!Number.isFinite(empties)) empties = 0;
        if (!Number.isFinite(ownDiscs) || !Number.isFinite(oppDiscs)) {
            const est = estimateOwnOppDiscs(discDiff, empties, totalCells);
            if (!Number.isFinite(ownDiscs)) ownDiscs = est.own;
            if (!Number.isFinite(oppDiscs)) oppDiscs = est.opp;
        }
        if (!Number.isFinite(ownEdges)) ownEdges = 0;
        if (!Number.isFinite(oppEdges)) oppEdges = 0;
        const normalizedEmpties = empties ?? 0;
        const normalizedOwnDiscs = ownDiscs ?? 0;
        const normalizedOppDiscs = oppDiscs ?? 0;
        const normalizedOwnEdges = ownEdges ?? 0;
        const normalizedOppEdges = oppEdges ?? 0;

        const ownCharge = isFiniteNumber(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
        const oppCharge = isFiniteNumber(ctx.oppCharge) ? Number(ctx.oppCharge) : 0;
        const oppHandSize = isFiniteNumber(ctx.oppHandSize) ? Math.max(0, Math.floor(Number(ctx.oppHandSize))) : 0;
        const handSize = isFiniteNumber(ctx.handSize) ? Math.max(0, Math.floor(Number(ctx.handSize))) : 0;
        const handCardIds = Array.isArray(ctx.handCardIds)
            ? ctx.handCardIds.map((id: unknown) => String(id || '').trim()).filter((id) => id.length > 0)
            : [];
        const deckRemaining = isFiniteNumber(ctx.deckRemaining)
            ? Math.max(0, Math.floor(Number(ctx.deckRemaining)))
            : null;
        const usableCardIds = Array.isArray(ctx.usableCardIds)
            ? ctx.usableCardIds.map((id: unknown) => String(id || '').trim()).filter((id) => id.length > 0)
            : [];
        const forceUseCard = !!ctx.forceUseCard || legalMovesCount <= 0;
        const ownCorners = isFiniteNumber(ctx.ownCorners) ? Number(ctx.ownCorners) : 0;
        const oppCorners = isFiniteNumber(ctx.oppCorners) ? Number(ctx.oppCorners) : 0;
        const swapEnemyNormalCornerTargetCount = Object.prototype.hasOwnProperty.call(ctx, 'swapEnemyNormalCornerTargetCount') && isFiniteNumber(ctx.swapEnemyNormalCornerTargetCount)
            ? Math.max(0, Math.floor(Number(ctx.swapEnemyNormalCornerTargetCount)))
            : 0;
        const hasBoardExpansionEnemyCornerTargetCount = Object.prototype.hasOwnProperty.call(ctx, 'boardExpansionEnemyCornerTargetCount');
        const hasBoardExpansionWillEnemyCornerTargetCount = Object.prototype.hasOwnProperty.call(ctx, 'boardExpansionWillEnemyCornerTargetCount');
        const hasBoardExpansionGodEnemyCornerTargetCount = Object.prototype.hasOwnProperty.call(ctx, 'boardExpansionGodEnemyCornerTargetCount');
        const hasAnySpecificBoardExpansionEnemyCornerTargetCount = hasBoardExpansionWillEnemyCornerTargetCount || hasBoardExpansionGodEnemyCornerTargetCount;
        const fallbackBoardExpansionEnemyCornerTargetCount = Math.max(0, Math.floor(oppCorners));
        const explicitBoardExpansionEnemyCornerTargetCount = hasBoardExpansionEnemyCornerTargetCount
            ? (isFiniteNumber(ctx.boardExpansionEnemyCornerTargetCount)
                ? Math.max(0, Math.floor(Number(ctx.boardExpansionEnemyCornerTargetCount)))
                : 0)
            : (hasAnySpecificBoardExpansionEnemyCornerTargetCount ? 0 : fallbackBoardExpansionEnemyCornerTargetCount);
        const boardExpansionWillEnemyCornerTargetCount = hasBoardExpansionWillEnemyCornerTargetCount
            ? (isFiniteNumber(ctx.boardExpansionWillEnemyCornerTargetCount)
                ? Math.max(0, Math.floor(Number(ctx.boardExpansionWillEnemyCornerTargetCount)))
                : 0)
            : explicitBoardExpansionEnemyCornerTargetCount;
        const boardExpansionGodEnemyCornerTargetCount = hasBoardExpansionGodEnemyCornerTargetCount
            ? (isFiniteNumber(ctx.boardExpansionGodEnemyCornerTargetCount)
                ? Math.max(0, Math.floor(Number(ctx.boardExpansionGodEnemyCornerTargetCount)))
                : 0)
            : explicitBoardExpansionEnemyCornerTargetCount;
        const boardExpansionEnemyCornerTargetCount = hasBoardExpansionEnemyCornerTargetCount
            ? explicitBoardExpansionEnemyCornerTargetCount
            : (hasAnySpecificBoardExpansionEnemyCornerTargetCount
                ? Math.max(boardExpansionWillEnemyCornerTargetCount, boardExpansionGodEnemyCornerTargetCount)
                : explicitBoardExpansionEnemyCornerTargetCount);
        const movementCornerSwingTargetCounts = normalizeMovementCornerSwingTargetCounts(ctx);
        const movementCornerSwingTargetCount = getMaxMovementCornerSwingTargetCount(movementCornerSwingTargetCounts);
        const hasCornerMoveNow = ctx.hasCornerMoveNow === true;
        const hasEdgeMoveNow = ctx.hasEdgeMoveNow === true;
        const cornerEmergency = ctx.cornerEmergency === true;
        const cornerHoldMode = ctx.cornerHoldMode === true;
        const recoveryCostGap = isFiniteNumber(ctx.recoveryCostGap) ? Math.max(0, Number(ctx.recoveryCostGap)) : 0;
        const highBonusMoveAvailable = ctx.highBonusMoveAvailable === true;
        const maxLegalFlips = isFiniteNumber(ctx.maxLegalFlips) ? Math.max(0, Math.floor(Number(ctx.maxLegalFlips))) : 0;
        const avgLegalFlips = isFiniteNumber(ctx.avgLegalFlips) ? Math.max(0, Number(ctx.avgLegalFlips)) : 0;
        const maxLegalGain = isFiniteNumber(ctx.maxLegalGain)
            ? Math.max(0, Number(ctx.maxLegalGain))
            : maxLegalFlips;
        const maxLegalBoardBonus = isFiniteNumber(ctx.maxLegalBoardBonus)
            ? Math.max(0, Number(ctx.maxLegalBoardBonus))
            : 0;
        const cloneSplitEligibleSourceCount = isFiniteNumber(ctx.cloneSplitEligibleSourceCount)
            ? Math.max(0, Math.floor(Number(ctx.cloneSplitEligibleSourceCount)))
            : null;
        const ownSpecialCount = isFiniteNumber(ctx.ownSpecialCount) ? Math.max(0, Math.floor(Number(ctx.ownSpecialCount))) : 0;
        const oppSpecialCount = isFiniteNumber(ctx.oppSpecialCount) ? Math.max(0, Math.floor(Number(ctx.oppSpecialCount))) : 0;
        const ownBombCount = isFiniteNumber(ctx.ownBombCount) ? Math.max(0, Math.floor(Number(ctx.ownBombCount))) : 0;
        const massFreezeOwnTargetCount = isFiniteNumber(ctx.massFreezeOwnTargetCount) ? Math.max(0, Math.floor(Number(ctx.massFreezeOwnTargetCount))) : 0;
        const massFreezeOpponentTargetCount = isFiniteNumber(ctx.massFreezeOpponentTargetCount) ? Math.max(0, Math.floor(Number(ctx.massFreezeOpponentTargetCount))) : 0;
        const temptHighValueTargetCount = isFiniteNumber(ctx.temptHighValueTargetCount) ? Math.max(0, Math.floor(Number(ctx.temptHighValueTargetCount))) : 0;
        const ownGuardCount = isFiniteNumber(ctx.ownGuardCount) ? Math.max(0, Math.floor(Number(ctx.ownGuardCount))) : 0;
        const oppGuardCount = isFiniteNumber(ctx.oppGuardCount) ? Math.max(0, Math.floor(Number(ctx.oppGuardCount))) : 0;
        const ownCornerResetCount = isFiniteNumber(ctx.ownCornerResetCount) ? Math.max(0, Math.floor(Number(ctx.ownCornerResetCount))) : 0;
        const oppCornerResetCount = isFiniteNumber(ctx.oppCornerResetCount) ? Math.max(0, Math.floor(Number(ctx.oppCornerResetCount))) : 0;
        const ownEdgeResetCount = isFiniteNumber(ctx.ownEdgeResetCount) ? Math.max(0, Math.floor(Number(ctx.ownEdgeResetCount))) : 0;
        const oppEdgeResetCount = isFiniteNumber(ctx.oppEdgeResetCount) ? Math.max(0, Math.floor(Number(ctx.oppEdgeResetCount))) : 0;
        const meteorBestCornerSwing = isFiniteNumber(ctx.meteorBestCornerSwing) ? Number(ctx.meteorBestCornerSwing) : 0;
        const meteorBestDestroyValue = isFiniteNumber(ctx.meteorBestDestroyValue) ? Number(ctx.meteorBestDestroyValue) : 0;
        const meteorHasCornerPromotion = ctx.meteorHasCornerPromotion === true;
        const meteorHasHighValueDestroy = ctx.meteorHasHighValueDestroy === true;
        let reserveChargeFloor = isFiniteNumber(ctx.reserveChargeFloor)
            ? Math.max(0, Math.floor(Number(ctx.reserveChargeFloor)))
            : (normalizedEmpties <= 12 ? 4 : (normalizedEmpties <= 30 ? 6 : 8));
        if (cornerEmergency) reserveChargeFloor = Math.max(2, reserveChargeFloor - 2);
        if (forceUseCard) reserveChargeFloor = 0;
        let minUseScore = Number.isFinite(ctx.minUseScore)
            ? Number(ctx.minUseScore)
            : (forceUseCard ? Number.NEGATIVE_INFINITY : (level >= 6 ? 18 : (level >= 4 ? 6 : -8)));
        const whiteLv6Mode = level >= 6 && playerValue < 0;
        const lowDiscEmergency = normalizedOwnDiscs <= Math.max(6, Math.floor(totalCells * 0.15));
        const criticalLowDiscEmergency = normalizedOwnDiscs <= 4;
        if (!forceUseCard) {
            if (handSize >= 5) minUseScore = Math.min(minUseScore, level >= 6 ? 4 : 0);
            else if (handSize >= 4) minUseScore = Math.min(minUseScore, level >= 6 ? 8 : 4);
            else if (handSize >= 3 && level >= 6) minUseScore = Math.min(minUseScore, 12);
            if (level >= 6 && ownCharge >= 24 && handSize >= 3) {
                minUseScore = Math.min(minUseScore, 10);
            }
            if (level >= 6 && ownCharge >= 36) {
                minUseScore = Math.min(minUseScore, 8);
            }
            if (level >= 6 && ctx.highBonusMoveAvailable === true && ownCharge >= 16) {
                minUseScore = Math.min(minUseScore, 9);
            }
            if (level >= 6 && legalMovesCount <= 2) {
                minUseScore = Math.min(minUseScore, 8);
            }
            if (whiteLv6Mode && (cornerEmergency || lowDiscEmergency || legalMovesCount <= 2)) {
                minUseScore = Math.min(minUseScore, 6);
            }
            if (whiteLv6Mode && criticalLowDiscEmergency) {
                minUseScore = Math.min(minUseScore, 2);
            }
            if (whiteLv6Mode && handSize >= 4) {
                minUseScore = Math.min(minUseScore, 6);
            }
            if (whiteLv6Mode && ownCharge >= 28 && handSize >= 3) {
                minUseScore = Math.min(minUseScore, 7);
            }
        }

        return {
            level,
            playerValue,
            legalMovesCount,
            discDiff,
            empties: normalizedEmpties,
            ownDiscs: normalizedOwnDiscs,
            oppDiscs: normalizedOppDiscs,
            ownEdges: normalizedOwnEdges,
            oppEdges: normalizedOppEdges,
            totalCells,
            ownCharge,
            oppCharge,
            oppHandSize,
            handSize,
            handCardIds,
            deckRemaining,
            usableCardIds,
            forceUseCard,
            minUseScore,
            ownCorners,
            oppCorners,
            swapEnemyNormalCornerTargetCount,
            boardExpansionEnemyCornerTargetCount,
            boardExpansionWillEnemyCornerTargetCount,
            boardExpansionGodEnemyCornerTargetCount,
            movementCornerSwingTargetCounts,
            movementCornerSwingTargetCount,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            cornerHoldMode,
            recoveryCostGap,
            reserveChargeFloor,
            highBonusMoveAvailable,
            maxLegalFlips,
            avgLegalFlips,
            maxLegalGain,
            maxLegalBoardBonus,
            cloneSplitEligibleSourceCount,
            ownSpecialCount,
            oppSpecialCount,
            ownBombCount,
            massFreezeOwnTargetCount,
            massFreezeOpponentTargetCount,
            temptHighValueTargetCount,
            ownGuardCount,
            oppGuardCount,
            ownCornerResetCount,
            oppCornerResetCount,
            ownEdgeResetCount,
            oppEdgeResetCount,
            meteorBestCornerSwing,
            meteorBestDestroyValue,
            meteorHasCornerPromotion,
            meteorHasHighValueDestroy,
            whiteLv6Mode,
            lowDiscEmergency,
            criticalLowDiscEmergency
        };
    }

    return {
        buildCardDecisionContext
    };
}
