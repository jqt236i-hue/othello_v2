import type { CpuPolicyBoard, CpuPolicyMove } from './cpu-policy-core-types';

type CpuPolicyLookaheadGuardsDeps = {
    isCorner?: (row: number, col: number, boardOrRows?: CpuPolicyBoard | number | null, colsMaybe?: number | null) => boolean;
    isEdge?: (row: number, col: number, boardOrRows?: CpuPolicyBoard | number | null, colsMaybe?: number | null) => boolean;
    countCornersFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    evaluateImmediateCornerDonation?: (board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number) => { oppCornerMoves: number; donatesCornerNow: boolean };
    evaluateMoveStabilityProfile?: (
        board: CpuPolicyBoard | null | undefined,
        move: CpuPolicyMove | null | undefined,
        playerValue: number,
        ownAnchoredEdgesBefore: number
    ) => { anchoredEdgeDelta: number; stabilityProxy: number };
    countAnchoredEdgeDiscsFromCorners?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    buildSearchMoveOrder?: (moves: CpuPolicyMove[], params: Record<string, unknown>) => CpuPolicyMove[];
};

type CpuPolicyLookaheadGuardInput = {
    bestMove: CpuPolicyMove | null;
    candidateMoves: CpuPolicyMove[];
    level: number;
    board: CpuPolicyBoard;
    playerValue: number;
    boardBonusByCell: Record<string, number> | null;
    baseConsumedMap: Record<string, boolean | number> | null | undefined;
    priorFn: ((move: CpuPolicyMove) => number) | null;
    priorWeight: number;
    rankedAllMoves?: CpuPolicyMove[];
};

export function createCpuPolicyLookaheadGuards(deps?: CpuPolicyLookaheadGuardsDeps) {
    const isCorner = typeof deps?.isCorner === 'function' ? deps.isCorner : (() => false);
    const isEdge = typeof deps?.isEdge === 'function' ? deps.isEdge : (() => false);
    const countCornersFor = typeof deps?.countCornersFor === 'function' ? deps.countCornersFor : (() => 0);
    const evaluateImmediateCornerDonation = typeof deps?.evaluateImmediateCornerDonation === 'function'
        ? deps.evaluateImmediateCornerDonation
        : (() => ({ oppCornerMoves: 0, donatesCornerNow: false }));
    const evaluateMoveStabilityProfile = typeof deps?.evaluateMoveStabilityProfile === 'function'
        ? deps.evaluateMoveStabilityProfile
        : (() => ({ anchoredEdgeDelta: 0, stabilityProxy: 0 }));
    const countAnchoredEdgeDiscsFromCorners = typeof deps?.countAnchoredEdgeDiscsFromCorners === 'function'
        ? deps.countAnchoredEdgeDiscsFromCorners
        : (() => 0);
    const buildSearchMoveOrder = typeof deps?.buildSearchMoveOrder === 'function'
        ? deps.buildSearchMoveOrder
        : ((moves: CpuPolicyMove[]) => moves);

    function sameMove(a: CpuPolicyMove | null | undefined, b: CpuPolicyMove | null | undefined): boolean {
        return !!a && !!b && Number(a.row) === Number(b.row) && Number(a.col) === Number(b.col);
    }

    function applyLookaheadHardGuards(input: CpuPolicyLookaheadGuardInput): CpuPolicyMove | null {
        const bestMove = input && input.bestMove ? input.bestMove : null;
        if (!bestMove) return bestMove;
        if (!Number.isFinite(input.level) || input.level < 6) return bestMove;
        const board = input.board && typeof input.board === 'object' ? input.board : [];
        const playerValue = Number(input.playerValue) >= 0 ? 1 : -1;
        const rankedAllMoves = Array.isArray(input.rankedAllMoves)
            ? input.rankedAllMoves
            : buildSearchMoveOrder(input.candidateMoves, {
                level: input.level,
                board,
                playerValue,
                boardBonusByCell: input.boardBonusByCell,
                boardBonusConsumedByCell: input.baseConsumedMap,
                rootPriorScoreFn: input.priorFn,
                priorWeight: input.priorWeight,
                branchLimit: null
            });
        let nextBestMove = bestMove;
        const ownAnchoredEdgesBefore = countAnchoredEdgeDiscsFromCorners(board, playerValue);

        if (!isCorner(nextBestMove.row, nextBestMove.col, board)) {
            const cornerMove = rankedAllMoves.find((move) => move && isCorner(move.row, move.col, board));
            if (cornerMove) {
                nextBestMove = cornerMove;
            }
        }

        if (!isCorner(nextBestMove.row, nextBestMove.col, board)) {
            const selectedRisk = evaluateImmediateCornerDonation(board, nextBestMove, playerValue);
            if (selectedRisk.donatesCornerNow) {
                for (const move of rankedAllMoves) {
                    if (!move || sameMove(move, nextBestMove)) continue;
                    const altRisk = evaluateImmediateCornerDonation(board, move, playerValue);
                    if (altRisk.donatesCornerNow) continue;
                    nextBestMove = move;
                    break;
                }
            }
        }

        if (!isCorner(nextBestMove.row, nextBestMove.col, board) && !isEdge(nextBestMove.row, nextBestMove.col, board)) {
            const ownCornersNow = countCornersFor(board, playerValue);
            const oppCornersNow = countCornersFor(board, -playerValue);
            if (ownCornersNow > oppCornersNow) {
                const selectedProfile = evaluateMoveStabilityProfile(board, nextBestMove, playerValue, ownAnchoredEdgesBefore);
                for (const move of rankedAllMoves) {
                    if (!move) continue;
                    if (isCorner(move.row, move.col, board)) continue;
                    if (!isEdge(move.row, move.col, board)) continue;
                    const altRisk = evaluateImmediateCornerDonation(board, move, playerValue);
                    if (altRisk.donatesCornerNow) continue;
                    const altProfile = evaluateMoveStabilityProfile(board, move, playerValue, ownAnchoredEdgesBefore);
                    const meaningfullyMoreStable = (
                        altProfile.anchoredEdgeDelta > selectedProfile.anchoredEdgeDelta ||
                        altProfile.stabilityProxy > (selectedProfile.stabilityProxy + 0.75)
                    );
                    if (!meaningfullyMoreStable) continue;
                    nextBestMove = move;
                    break;
                }
            }
        }

        if (!isCorner(nextBestMove.row, nextBestMove.col, board) && !isEdge(nextBestMove.row, nextBestMove.col, board)) {
            const anyCornerExists = rankedAllMoves.some((move) => move && isCorner(move.row, move.col, board));
            if (!anyCornerExists) {
                for (const move of rankedAllMoves) {
                    if (!move) continue;
                    if (isCorner(move.row, move.col, board)) continue;
                    if (!isEdge(move.row, move.col, board)) continue;
                    const altRisk = evaluateImmediateCornerDonation(board, move, playerValue);
                    if (altRisk.donatesCornerNow) continue;
                    const altProfile = evaluateMoveStabilityProfile(board, move, playerValue, ownAnchoredEdgesBefore);
                    const meaningfullySaferEdge = altProfile.anchoredEdgeDelta > 0;
                    if (!meaningfullySaferEdge) continue;
                    nextBestMove = move;
                    break;
                }
            }
        }

        return nextBestMove;
    }

    return {
        applyLookaheadHardGuards
    };
}
