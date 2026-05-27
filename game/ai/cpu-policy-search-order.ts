import type { CpuPolicyBoard, CpuPolicyMove } from './cpu-policy-core-types';

type CpuPolicySearchMoveParams = {
    level?: number;
    board?: CpuPolicyBoard | null;
    playerValue?: number;
    boardBonusByCell?: Record<string, number> | null;
    boardBonusConsumedByCell?: Record<string, boolean | number> | null;
    rootPriorScoreFn?: ((move: CpuPolicyMove) => number) | null;
    priorWeight?: number;
    branchLimit?: number | null;
};

type CpuPolicySearchOrderDeps = {
    isFiniteNumber?: (value: unknown) => boolean;
    resolveBoardGeometry?: (boardOrRows: CpuPolicyBoard | number | null, colsMaybe?: number | null) => { maxR: number; maxC: number };
    scoreMoveForCornerEdgePlan?: (move: CpuPolicyMove, context?: Record<string, unknown>) => number;
    scoreMoveHeuristic?: (move: CpuPolicyMove, level?: number, boardOrRows?: CpuPolicyBoard | number | null, colsMaybe?: number | null) => number;
    getMoveChargeGain?: (move: CpuPolicyMove | null | undefined, boardBonusByCell: Record<string, number> | null | undefined, consumedMap: Record<string, boolean | number> | null | undefined) => number;
    normalizePriorScore?: (score: unknown) => number;
    inBoard?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => boolean;
    applyMoveToBoard?: (board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number) => CpuPolicyBoard;
    getLegalMovesBasic?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyMove[];
    countCornerMovesFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    countFrontierDiscsFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function fallbackResolveBoardGeometry(boardOrRows: CpuPolicyBoard | number | null): { maxR: number; maxC: number } {
    if (Array.isArray(boardOrRows) && boardOrRows.length > 0) {
        return {
            maxR: boardOrRows.length - 1,
            maxC: Array.isArray(boardOrRows[0]) ? (boardOrRows[0].length - 1) : boardOrRows.length - 1
        };
    }
    return { maxR: -1, maxC: -1 };
}

export function createCpuPolicySearchOrder(deps?: CpuPolicySearchOrderDeps) {
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const resolveBoardGeometry = typeof deps?.resolveBoardGeometry === 'function' ? deps.resolveBoardGeometry : fallbackResolveBoardGeometry;
    const scoreMoveForCornerEdgePlan = typeof deps?.scoreMoveForCornerEdgePlan === 'function' ? deps.scoreMoveForCornerEdgePlan : (() => 0);
    const scoreMoveHeuristic = typeof deps?.scoreMoveHeuristic === 'function' ? deps.scoreMoveHeuristic : (() => 0);
    const getMoveChargeGain = typeof deps?.getMoveChargeGain === 'function' ? deps.getMoveChargeGain : (() => 0);
    const normalizePriorScore = typeof deps?.normalizePriorScore === 'function' ? deps.normalizePriorScore : ((score: unknown) => Number(score) || 0);
    const inBoard = typeof deps?.inBoard === 'function' ? deps.inBoard : (() => false);
    const applyMoveToBoard = typeof deps?.applyMoveToBoard === 'function' ? deps.applyMoveToBoard : ((board: any) => board);
    const getLegalMovesBasic = typeof deps?.getLegalMovesBasic === 'function' ? deps.getLegalMovesBasic : (() => []);
    const countCornerMovesFor = typeof deps?.countCornerMovesFor === 'function' ? deps.countCornerMovesFor : (() => 0);
    const countFrontierDiscsFor = typeof deps?.countFrontierDiscsFor === 'function' ? deps.countFrontierDiscsFor : (() => 0);

    function buildSearchMoveOrder(moves: CpuPolicyMove[], params: CpuPolicySearchMoveParams): CpuPolicyMove[] {
        const p = params || {};
        const level = isFiniteNumber(p.level) ? Number(p.level) : 6;
        const board = Array.isArray(p.board) ? p.board : [];
        const playerValue = isFiniteNumber(p.playerValue) ? (Number(p.playerValue) >= 0 ? 1 : -1) : 1;
        const boardBonusByCell: Record<string, number> | null = p.boardBonusByCell && typeof p.boardBonusByCell === 'object'
            ? p.boardBonusByCell as Record<string, number>
            : null;
        const consumedMap = p.boardBonusConsumedByCell && typeof p.boardBonusConsumedByCell === 'object'
            ? p.boardBonusConsumedByCell
            : Object.create(null);
        const priorFn = typeof p.rootPriorScoreFn === 'function' ? p.rootPriorScoreFn : null;
        const priorWeight = Number.isFinite(p.priorWeight) ? Number(p.priorWeight) : 120;
        const branchLimit = isFiniteNumber(p.branchLimit) ? Math.max(2, Math.floor(Number(p.branchLimit))) : null;
        const geom = resolveBoardGeometry(board);
        const tieMaxR = geom.maxR >= 0 ? geom.maxR : 7;
        const tieMaxC = geom.maxC >= 0 ? geom.maxC : 7;

        const scored = (Array.isArray(moves) ? moves : []).map((move, idx) => {
            let planScore = 0;
            try {
                planScore = Number(scoreMoveForCornerEdgePlan(move, {
                    level,
                    board,
                    playerValue,
                    boardBonusByCell,
                    boardBonusConsumedByCell: consumedMap
                }) || 0);
            } catch (e) {
                planScore = Number(scoreMoveHeuristic(move, level, board) || 0);
            }
            const chargeGain = getMoveChargeGain(move, boardBonusByCell, consumedMap);
            const gainScore = chargeGain * 95;
            const priorScore = priorFn ? (normalizePriorScore(priorFn(move)) * priorWeight) : 0;
            let tacticalPreviewScore = 0;
            if (level >= 6 && board && inBoard(board, Number(move && move.row), Number(move && move.col))) {
                try {
                    const after = applyMoveToBoard(board, move, playerValue);
                    const oppMovesAfter = getLegalMovesBasic(after, -playerValue);
                    const oppCornerMovesAfter = countCornerMovesFor(after, -playerValue);
                    const ownCornerMovesAfter = countCornerMovesFor(after, playerValue);
                    const ownFrontierAfter = countFrontierDiscsFor(after, playerValue);
                    const oppFrontierAfter = countFrontierDiscsFor(after, -playerValue);
                    tacticalPreviewScore += Math.max(-2200, (16 - oppMovesAfter.length) * 145);
                    const oppCornerPenalty = level >= 6 ? 9800 : 6200;
                    tacticalPreviewScore -= oppCornerMovesAfter * oppCornerPenalty;
                    tacticalPreviewScore += ownCornerMovesAfter * 1800;
                    tacticalPreviewScore += Math.max(-1800, Math.min(1800, (oppFrontierAfter - ownFrontierAfter) * 75));
                } catch (e) {
                    tacticalPreviewScore += 0;
                }
            }
            const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
            const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
            const tie = (tieMaxR - row) * 0.001 + (tieMaxC - col) * 0.0001 + ((moves.length - idx) * 0.00001);
            return {
                move,
                score: planScore + gainScore + priorScore + tacticalPreviewScore + tie
            };
        });

        scored.sort((a, b) => b.score - a.score);
        const ordered = scored.map((one) => one.move);
        return branchLimit ? ordered.slice(0, branchLimit) : ordered;
    }

    return {
        buildSearchMoveOrder
    };
}
