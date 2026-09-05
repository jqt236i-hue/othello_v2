import type { CpuPolicyBoard, CpuPolicyMove } from './cpu-policy-core-types';

type CpuPolicyBonusConsumedMap = Record<string, boolean | number>;

type CpuPolicyLookaheadRootSearchDeps = {
    getMoveChargeGain?: (move: CpuPolicyMove | null | undefined, boardBonusByCell: Record<string, number> | null | undefined, consumedMap: CpuPolicyBonusConsumedMap | null | undefined) => number;
    getBoardBonusAtCell?: (
        boardBonusByCell: Record<string, number> | null | undefined,
        consumedMap: CpuPolicyBonusConsumedMap | null | undefined,
        row: number,
        col: number
    ) => number;
    consumeBonusCell?: (consumedMap: CpuPolicyBonusConsumedMap | null | undefined, row: number, col: number) => CpuPolicyBonusConsumedMap;
    applyMoveToBoard?: (board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number) => CpuPolicyBoard;
    normalizePriorScore?: (score: unknown) => number;
};

type CpuPolicyRootNegamax = (
    boardNode: CpuPolicyBoard,
    currentPlayer: number,
    depthLeft: number,
    alpha: number,
    beta: number,
    passed: boolean,
    consumedMap: CpuPolicyBonusConsumedMap
) => number;

type CpuPolicyLookaheadRootSearchInput = {
    orderedRootBase: CpuPolicyMove[];
    depth: number;
    endgameMode: boolean;
    board: CpuPolicyBoard;
    playerValue: number;
    boardBonusByCell: Record<string, number> | null;
    baseConsumedMap: CpuPolicyBonusConsumedMap;
    priorFn: ((move: CpuPolicyMove) => number) | null;
    priorWeight: number;
    searchWeight: number;
    negamax: CpuPolicyRootNegamax;
    shouldStop: () => boolean;
};

function fallbackNormalizePriorScore(score: unknown): number {
    return Number(score) || 0;
}

export function createCpuPolicyLookaheadRootSearch(deps?: CpuPolicyLookaheadRootSearchDeps) {
    const getMoveChargeGain = typeof deps?.getMoveChargeGain === 'function' ? deps.getMoveChargeGain : (() => 0);
    const getBoardBonusAtCell = typeof deps?.getBoardBonusAtCell === 'function' ? deps.getBoardBonusAtCell : (() => 0);
    const consumeBonusCell = typeof deps?.consumeBonusCell === 'function'
        ? deps.consumeBonusCell
        : ((consumedMap: CpuPolicyBonusConsumedMap | null | undefined) => (consumedMap || Object.create(null)) as CpuPolicyBonusConsumedMap);
    const applyMoveToBoard = typeof deps?.applyMoveToBoard === 'function' ? deps.applyMoveToBoard : ((board: any) => board);
    const normalizePriorScore = typeof deps?.normalizePriorScore === 'function' ? deps.normalizePriorScore : fallbackNormalizePriorScore;

    function sameMove(a: CpuPolicyMove | null | undefined, b: CpuPolicyMove | null | undefined): boolean {
        return !!a && !!b && Number(a.row) === Number(b.row) && Number(a.col) === Number(b.col);
    }

    function reorderRootMoves(moves: CpuPolicyMove[], firstMove: CpuPolicyMove | null): CpuPolicyMove[] {
        if (!firstMove || !Array.isArray(moves) || moves.length <= 1) return moves;
        const top: CpuPolicyMove[] = [];
        const rest: CpuPolicyMove[] = [];
        for (const mv of moves) {
            if (top.length === 0 && sameMove(mv, firstMove)) top.push(mv);
            else rest.push(mv);
        }
        return top.length > 0 ? top.concat(rest) : moves;
    }

    function buildIterativeDepthSchedule(depth: number): number[] {
        if (depth <= 8) return [4, 6, depth];
        if (depth <= 12) return [4, 6, 8, 10, depth];
        return [5, 7, 9, 11, 13, depth];
    }

    function searchRootAtDepth(depthToUse: number, rootMoves: CpuPolicyMove[], input: CpuPolicyLookaheadRootSearchInput): { move: CpuPolicyMove | null; score: number; completed: boolean } {
        let localBestMove: CpuPolicyMove | null = null;
        let localBestScore = Number.NEGATIVE_INFINITY;
        for (const move of rootMoves) {
            if (input.shouldStop()) return { move: localBestMove, score: localBestScore, completed: false };
            const immediate = getMoveChargeGain(move, input.boardBonusByCell, input.baseConsumedMap) * 85;
            const bonusAtCell = getBoardBonusAtCell(input.boardBonusByCell, input.baseConsumedMap, Number(move.row), Number(move.col));
            const nextConsumed = bonusAtCell > 0
                ? consumeBonusCell(input.baseConsumedMap, Number(move.row), Number(move.col))
                : input.baseConsumedMap;
            const nextBoard = applyMoveToBoard(input.board, move, input.playerValue);
            const childScore = -input.negamax(
                nextBoard,
                -input.playerValue,
                depthToUse - 1,
                Number.NEGATIVE_INFINITY,
                Number.POSITIVE_INFINITY,
                false,
                nextConsumed
            );
            // A budget-limited child is a partial estimate, not a comparable search result.
            if (input.shouldStop()) return { move: localBestMove, score: localBestScore, completed: false };
            const prior = input.priorFn ? (normalizePriorScore(input.priorFn(move)) * input.priorWeight) : 0;
            const total = ((childScore + immediate) * input.searchWeight) + prior;
            if (total > localBestScore) {
                localBestScore = total;
                localBestMove = move;
            } else if (total === localBestScore && localBestMove) {
                const bestRow = Number(localBestMove.row);
                const bestCol = Number(localBestMove.col);
                const row = Number(move.row);
                const col = Number(move.col);
                if (row < bestRow || (row === bestRow && col < bestCol)) {
                    localBestMove = move;
                }
            }
        }
        return {
            move: localBestMove,
            score: localBestScore,
            completed: true
        };
    }

    function runLookaheadRootSearch(input: CpuPolicyLookaheadRootSearchInput): { bestMove: CpuPolicyMove | null; bestScore: number; rootMoves: CpuPolicyMove[] } {
        let bestMove: CpuPolicyMove | null = input.orderedRootBase[0] || null;
        let bestScore = Number.NEGATIVE_INFINITY;
        let rootMoves = input.orderedRootBase;

        if (!input.endgameMode && input.depth >= 6) {
            const schedule = buildIterativeDepthSchedule(input.depth);
            const seen = new Set<number>();
            for (const d of schedule) {
                const depthStep = Math.max(2, Math.min(input.depth, Math.floor(d)));
                if (seen.has(depthStep)) continue;
                seen.add(depthStep);
                const out = searchRootAtDepth(depthStep, rootMoves, input);
                if (out.completed && out.move) {
                    bestMove = out.move;
                    bestScore = out.score;
                    rootMoves = reorderRootMoves(rootMoves, out.move);
                }
                if (input.shouldStop()) break;
            }
        } else {
            const out = searchRootAtDepth(input.depth, rootMoves, input);
            if (out.completed) {
                bestMove = out.move;
                bestScore = out.score;
            }
        }

        return { bestMove, bestScore, rootMoves };
    }

    return {
        sameMove,
        reorderRootMoves,
        buildIterativeDepthSchedule,
        searchRootAtDepth,
        runLookaheadRootSearch
    };
}
