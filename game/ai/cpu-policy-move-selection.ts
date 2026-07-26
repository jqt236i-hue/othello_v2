import type {
    CpuPolicyBoard,
    CpuPolicyBoardBonusResolver,
    CpuPolicyLegalMoveMetrics,
    CpuPolicyMove,
    CpuPolicyMoveOptions,
    CpuPolicyRandomSource,
    CpuPolicyAiMoveSelector
} from './cpu-policy-core-types';
import {
    createCpuCandidateScoringRequest,
    isCpuCandidateScoringIdentity,
    isCpuCandidateScoringRequest,
    scoreCpuCandidateRequest,
    scoreCpuCandidateTie,
    verifyCpuCandidateScoringBatch,
    type CpuCandidateScoringBoardShape,
    type CpuCandidateScoringMove,
    type CpuCandidateScoringRequest
} from './cpu-candidate-scoring';
import { normalizeBoardPositionsStrict } from '../../shared/board/move-codec';

type CpuPolicyMoveSelectionDeps = {
    isFiniteNumber?: (value: unknown) => boolean;
    resolveBoardGeometry?: (boardOrRows?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => { maxR: number; maxC: number };
    scoreMoveHeuristic?: (move: CpuPolicyMove, level?: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => number;
    createCandidateScoringBoardShape?: (
        candidateMoves: CpuPolicyMove[],
        board?: CpuPolicyBoard | number | null | undefined,
        colsMaybe?: number | null
    ) => CpuCandidateScoringBoardShape;
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
    const createCandidateScoringBoardShape = typeof deps?.createCandidateScoringBoardShape === 'function'
        ? deps.createCandidateScoringBoardShape
        : null;

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

    function rankMovesLegacy(
        candidateMoves: CpuPolicyMove[],
        level: number,
        board: CpuPolicyBoard | null,
        useHeuristic: boolean,
        scoreMove: ((move: CpuPolicyMove) => number) | null
    ): CpuPolicyMove[] {
        const geom = resolveBoardGeometry(board);
        const tieMaxR = geom.maxR >= 0 ? geom.maxR : 7;
        const tieMaxC = geom.maxC >= 0 ? geom.maxC : 7;
        const scored = candidateMoves.map((move, idx) => {
            const learnedScore = scoreMove ? (scoreMove(move) || 0) : 0;
            const heuristicScore = useHeuristic ? scoreMoveHeuristic(move, level, board) : 0;
            const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
            const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
            const tie = scoreCpuCandidateTie({
                row,
                col,
                candidateIndex: idx,
                candidateCount: candidateMoves.length,
                tieMaxR,
                tieMaxC
            });
            return { move, score: learnedScore + heuristicScore + tie };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.map((s) => s.move);
    }

    function projectMoveForCandidateScoring(move: CpuPolicyMove): CpuCandidateScoringMove {
        const flips = normalizeBoardPositionsStrict(
            Array.isArray(move && move.flips) ? move.flips : []
        );
        if (!flips) throw new Error('CPU candidate contains an invalid flip coordinate');
        return {
            row: Number(move && move.row),
            col: Number(move && move.col),
            flips
        };
    }

    function createExpectedCandidateScoringRequest(
        candidateMoves: CpuPolicyMove[],
        level: number,
        board: CpuPolicyBoard | null,
        currentRequest: unknown
    ): CpuCandidateScoringRequest {
        const identity = isCpuCandidateScoringIdentity(currentRequest)
            ? currentRequest
            : null;
        return createCpuCandidateScoringRequest({
            requestId: identity ? identity.requestId : 'local-rank',
            decisionEpoch: identity ? identity.decisionEpoch : 0,
            stateVersion: identity ? identity.stateVersion : null,
            turnNumber: identity ? identity.turnNumber : 0,
            playerKey: identity ? identity.playerKey : 'local',
            level,
            boardShape: (createCandidateScoringBoardShape as NonNullable<typeof createCandidateScoringBoardShape>)(candidateMoves, board),
            candidateMoves: candidateMoves.map(projectMoveForCandidateScoring)
        });
    }

    function rankMoves(candidateMoves: CpuPolicyMove[], level = 1, options?: CpuPolicyMoveOptions | null): CpuPolicyMove[] {
        const opts = options || {};
        const useHeuristic = !!opts.enableHeuristic;
        const scoreMove = typeof opts.scoreMove === 'function' ? opts.scoreMove : null;
        const board = opts.board && typeof opts.board === 'object' ? opts.board : null;
        if (!useHeuristic && !scoreMove) return candidateMoves.slice();

        if (!createCandidateScoringBoardShape) {
            return rankMovesLegacy(candidateMoves, level, board, useHeuristic, scoreMove);
        }

        let scoreResponse;
        try {
            const batch = opts.candidateScoringBatch;
            const currentRequest = opts.expectedCandidateScoringRequest;
            const hasCurrentRequest = isCpuCandidateScoringRequest(currentRequest);
            const expectedRequest = createExpectedCandidateScoringRequest(candidateMoves, level, board, currentRequest);
            scoreResponse = hasCurrentRequest && verifyCpuCandidateScoringBatch(expectedRequest, batch)
                ? batch.response
                : scoreCpuCandidateRequest(expectedRequest);
        } catch (error) {
            // Invalid internal candidates are not eligible for the portable DTO.
            // Preserve the existing synchronous selector as the exact local fallback.
            return rankMovesLegacy(candidateMoves, level, board, useHeuristic, scoreMove);
        }

        const scored = candidateMoves.map((move, idx) => {
            const learnedScore = scoreMove ? (scoreMove(move) || 0) : 0;
            const candidateScore = scoreResponse.scores[idx];
            const heuristicScore = useHeuristic ? candidateScore.heuristicScore : 0;
            // Keep the legacy floating-point addition order exactly.
            return { move, score: learnedScore + heuristicScore + candidateScore.tieScore };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.map((entry) => entry.move);
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
        createExpectedCandidateScoringRequest,
        rankMoves,
        chooseMove
    };
}
