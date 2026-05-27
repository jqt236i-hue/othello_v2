import type {
    CpuPolicyBoard,
    CpuPolicyBoardBonusResolver,
    CpuPolicyLegalMoveMetrics,
    CpuPolicyMove,
    CpuPolicyMoveOptions,
    CpuPolicyRandomSource,
    CpuPolicyAiMoveSelector
} from './cpu-policy-core-types';

type CpuPolicyMoveSelectionDeps = {
    isFiniteNumber?: (value: unknown) => boolean;
    resolveBoardGeometry?: (boardOrRows?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => { maxR: number; maxC: number };
    scoreMoveHeuristic?: (move: CpuPolicyMove, level?: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => number;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function fallbackResolveBoardGeometry(): { maxR: number; maxC: number } {
    return { maxR: 7, maxC: 7 };
}

export function createCpuPolicyMoveSelection(deps?: CpuPolicyMoveSelectionDeps) {
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const resolveBoardGeometry = typeof deps?.resolveBoardGeometry === 'function' ? deps.resolveBoardGeometry : fallbackResolveBoardGeometry;
    const scoreMoveHeuristic = typeof deps?.scoreMoveHeuristic === 'function' ? deps.scoreMoveHeuristic : (() => 0);

    function computeLegalMoveMetrics(legalMoves: CpuPolicyMove[], getBoardBonus?: CpuPolicyBoardBonusResolver): CpuPolicyLegalMoveMetrics {
        const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
        let maxLegalFlips = 0;
        let totalLegalFlips = 0;
        let maxLegalGain = 0;
        let maxLegalBoardBonus = 0;
        for (const move of safeLegalMoves) {
            if (!move) continue;
            const flips = Array.isArray(move.flips) ? move.flips.length : 0;
            totalLegalFlips += flips;
            if (flips > maxLegalFlips) maxLegalFlips = flips;
            const rawBonus = (typeof getBoardBonus === 'function' && Number.isInteger(move.row) && Number.isInteger(move.col))
                ? Number(getBoardBonus(move.row, move.col, move) || 0)
                : 0;
            const bonus = Number.isFinite(rawBonus) && rawBonus > 0 ? rawBonus : 0;
            if (bonus > maxLegalBoardBonus) maxLegalBoardBonus = bonus;
            const gain = flips + bonus;
            if (gain > maxLegalGain) maxLegalGain = gain;
        }
        return {
            maxLegalFlips,
            avgLegalFlips: safeLegalMoves.length > 0 ? (totalLegalFlips / safeLegalMoves.length) : 0,
            maxLegalGain,
            maxLegalBoardBonus
        };
    }

    function rankMoves(candidateMoves: CpuPolicyMove[], level = 1, options?: CpuPolicyMoveOptions | null): CpuPolicyMove[] {
        const opts = options || {};
        const useHeuristic = !!opts.enableHeuristic;
        const scoreMove = typeof opts.scoreMove === 'function' ? opts.scoreMove : null;
        const board = Array.isArray(opts.board) ? opts.board : null;
        const geom = resolveBoardGeometry(board);
        const tieMaxR = geom.maxR >= 0 ? geom.maxR : 7;
        const tieMaxC = geom.maxC >= 0 ? geom.maxC : 7;
        if (!useHeuristic && !scoreMove) return candidateMoves.slice();

        const scored = candidateMoves.map((move, idx) => {
            const learnedScore = scoreMove ? (scoreMove(move) || 0) : 0;
            const heuristicScore = useHeuristic ? scoreMoveHeuristic(move, level, board) : 0;
            const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
            const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
            const tie = (tieMaxR - row) * 0.001 + (tieMaxC - col) * 0.0001 + (candidateMoves.length - idx) * 0.00001;
            return { move, score: learnedScore + heuristicScore + tie };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.map((s) => s.move);
    }

    function chooseMove(
        candidateMoves: CpuPolicyMove[],
        level = 1,
        rng?: CpuPolicyRandomSource | null,
        selectMoveWithAi?: CpuPolicyAiMoveSelector | null,
        options?: CpuPolicyMoveOptions | null
    ): CpuPolicyMove | null {
        if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
        const safeRng = rng && typeof rng.random === 'function' ? rng : { random: () => 0.5 };
        const rankedMoves = rankMoves(candidateMoves, level, options);

        if (typeof selectMoveWithAi === 'function') {
            try {
                const move = selectMoveWithAi(rankedMoves, level);
                if (move) return move;
            } catch (e) {
                // fallback below
            }
        }

        if (options && options.enableHeuristic) return rankedMoves[0];
        return rankedMoves[Math.floor(safeRng.random() * rankedMoves.length)];
    }

    return {
        computeLegalMoveMetrics,
        rankMoves,
        chooseMove
    };
}
