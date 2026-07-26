/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeBoardPositionsStrict } from '../../shared/board/move-codec';

type SelfplaySearchPrimitivesConfig = {
    SharedBoardUtils?: any;
    getLegalMovesBasic?: (board: any, playerValue: any) => any[];
    setBoardCellValue?: (board: any, row: any, col: any, value: any) => any;
    setBoardCellValues?: (
        board: any,
        updates: Array<{ row: number; col: number; value: number }>
    ) => any;
    evaluatePositionValue?: (row: any, col: any, board: any) => number;
    countCorners?: (board: any, playerValue: any) => number;
};

export function createSelfplaySearchPrimitives(config?: SelfplaySearchPrimitivesConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplaySearchPrimitivesConfig;
    let sharedBoardUtils = cfg.SharedBoardUtils || null;
    if (!sharedBoardUtils) {
        try {
            sharedBoardUtils = require('../../shared/shared-board-utils.js');
        } catch (error) {
            sharedBoardUtils = null;
        }
    }
    const getLegalMovesBasic = typeof cfg.getLegalMovesBasic === 'function' ? cfg.getLegalMovesBasic : (() => []);
    const setBoardCellValue = typeof cfg.setBoardCellValue === 'function'
        ? cfg.setBoardCellValue
        : ((board: any, row: any, col: any, value: any) => {
            if (!sharedBoardUtils || typeof sharedBoardUtils.setCellValue !== 'function') return false;
            return sharedBoardUtils.setCellValue(board, row, col, value);
        });
    const setBoardCellValues = typeof cfg.setBoardCellValues === 'function'
        ? cfg.setBoardCellValues
        : (sharedBoardUtils && typeof sharedBoardUtils.setCellValues === 'function'
            ? sharedBoardUtils.setCellValues
            : null);
    const evaluatePositionValue = typeof cfg.evaluatePositionValue === 'function'
        ? cfg.evaluatePositionValue
        : (() => 0);
    const countCorners = typeof cfg.countCorners === 'function'
        ? cfg.countCorners
        : (() => 0);

    function countEmpties(board: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.countBoardEmpties === 'function') {
            return sharedBoardUtils.countBoardEmpties(board);
        }
        throw new Error('SharedBoardUtils.countBoardEmpties is required by selfplay search');
    }

    function isStandardBoard(board: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.isStandardBoard8x8 === 'function') {
            return sharedBoardUtils.isStandardBoard8x8(board);
        }
        throw new Error('SharedBoardUtils.isStandardBoard8x8 is required by selfplay search');
    }

    function countDiscDiffOnBoard(board: any, playerValue: any) {
        if (!sharedBoardUtils || typeof sharedBoardUtils.countDiscsByPlayer !== 'function') {
            throw new Error('SharedBoardUtils.countDiscsByPlayer is required by selfplay search');
        }
        const counts = sharedBoardUtils.countDiscsByPlayer(board);
        return playerValue === 1
            ? Number(counts.black || 0) - Number(counts.white || 0)
            : Number(counts.white || 0) - Number(counts.black || 0);
    }

    function applyMoveToBoard(board: any, move: any, playerValue: any) {
        if (!sharedBoardUtils || typeof sharedBoardUtils.cloneBoard !== 'function') {
            throw new Error('SharedBoardUtils.cloneBoard is required by selfplay search');
        }
        const next = sharedBoardUtils.cloneBoard(board);
        if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return next;
        const updates = [{ row: move.row, col: move.col, value: playerValue }];
        const updateKeys = new Set([`${move.row},${move.col}`]);
        const flips = normalizeBoardPositionsStrict(
            Array.isArray(move.flips) ? move.flips : []
        );
        if (!flips) throw new Error('Selfplay move contains an invalid flip coordinate');
        for (const flip of flips) {
            const key = `${flip.row},${flip.col}`;
            if (updateKeys.has(key)) {
                throw new Error('Selfplay move contains a duplicate flip coordinate');
            }
            updateKeys.add(key);
            updates.push({ row: flip.row, col: flip.col, value: playerValue });
        }
        if (setBoardCellValues) {
            if (!setBoardCellValues(next, updates)) {
                throw new Error('Selfplay board kernel rejected an atomic move update');
            }
            return next;
        }
        if (!setBoardCellValue(next, move.row, move.col, playerValue)) {
            throw new Error('Selfplay board setter rejected the placement coordinate');
        }
        for (const update of updates.slice(1)) {
            if (!setBoardCellValue(next, update.row, update.col, playerValue)) {
                throw new Error('Selfplay board setter rejected a flip coordinate');
            }
        }
        return next;
    }

    function evaluateBoardForSearch(board: any, playerValue: any) {
        const empties = countEmpties(board);
        const cornerDiff = countCorners(board, playerValue);
        const positionalDiff = evaluatePositionValueSummary(board, playerValue);
        const mobilityDiff = getLegalMovesBasic(board, playerValue).length - getLegalMovesBasic(board, -playerValue).length;
        const discDiff = countDiscDiffOnBoard(board, playerValue);
        const discWeight = empties <= 10 ? 20 : (empties <= 24 ? 10 : 3);
        return (
            (cornerDiff * 420) +
            (mobilityDiff * 30) +
            (positionalDiff * 5) +
            (discDiff * discWeight)
        );
    }

    function evaluatePositionValueSummary(board: any, playerValue: any) {
        if (
            !sharedBoardUtils ||
            typeof sharedBoardUtils.collectBoardCoordinates !== 'function' ||
            typeof sharedBoardUtils.getCellValue !== 'function'
        ) {
            throw new Error('SharedBoardUtils board iteration is required by selfplay search');
        }
        let score = 0;
        for (const cell of sharedBoardUtils.collectBoardCoordinates(board)) {
            const row = cell && cell.row;
            const col = cell && cell.col;
            const value = sharedBoardUtils.getCellValue(board, row, col);
            if (value === playerValue) score += evaluatePositionValue(row, col, board);
            else if (value === -playerValue) score -= evaluatePositionValue(row, col, board);
        }
        return score;
    }

    function scoreMoveForSearchOrder(move: any, board: any) {
        const flips = Array.isArray(move && move.flips) ? move.flips.length : 0;
        const row = Number.isFinite(move && move.row) ? move.row : 0;
        const col = Number.isFinite(move && move.col) ? move.col : 0;
        return (flips * 120) + (evaluatePositionValue(row, col, board) * 14);
    }

    function sortMovesForSearch(moves: any, beamWidth: any, board: any) {
        const out = Array.isArray(moves) ? moves.slice() : [];
        out.sort((a: any, b: any) => {
            const sa = scoreMoveForSearchOrder(a, board);
            const sb = scoreMoveForSearchOrder(b, board);
            if (sb !== sa) return sb - sa;
            if (a.row !== b.row) return a.row - b.row;
            return a.col - b.col;
        });
        const bw = Number.isFinite(beamWidth) ? Math.max(1, Math.floor(beamWidth)) : 6;
        if (out.length > bw) return out.slice(0, bw);
        return out;
    }

    function resolveTacticalSearchDepth(options: any, empties: any, planState: any) {
        const openingDepth = Number.isFinite(options && options.tacticalDepthOpening)
            ? Math.max(0, Math.floor(options.tacticalDepthOpening))
            : 2;
        const midDepth = Number.isFinite(options && options.tacticalDepthMid)
            ? Math.max(0, Math.floor(options.tacticalDepthMid))
            : 3;
        const endDepth = Number.isFinite(options && options.tacticalDepthEnd)
            ? Math.max(0, Math.floor(options.tacticalDepthEnd))
            : 4;
        let depth = empties <= 14 ? endDepth : (empties <= 32 ? midDepth : openingDepth);
        if (planState && planState.cornerEmergency) depth += 1;
        const phaseCap = empties <= 12 ? 11 : (empties <= 28 ? 9 : 7);
        return Math.max(0, Math.min(phaseCap, depth));
    }

    function resolveTacticalBeamWidth(options: any, empties: any) {
        const configured = Number.isFinite(options && options.tacticalBeamWidth)
            ? Math.max(1, Math.floor(options.tacticalBeamWidth))
            : 0;
        if (configured > 0) return Math.min(16, configured);
        if (empties <= 12) return 12;
        if (empties <= 28) return 10;
        return 8;
    }

    function resolveTacticalMetricsCandidateLimit(options: any, candidateCount: any) {
        const total = Number.isFinite(candidateCount) ? Math.max(0, Math.floor(candidateCount)) : 0;
        if (total <= 0) return 0;
        const configured = Number.isFinite(options && options.tacticalMetricsCandidateLimit)
            ? Math.max(1, Math.floor(options.tacticalMetricsCandidateLimit))
            : 0;
        if (configured > 0) return Math.min(total, configured);
        if (total <= 4) return total;
        return Math.min(total, 3);
    }

    function computePositiveOpportunityMissMetrics(bestScore: any, selectedScore: any) {
        const best = Number.isFinite(bestScore) ? Number(bestScore) : 0;
        const selected = Number.isFinite(selectedScore) ? Number(selectedScore) : 0;
        if (best <= 0) {
            return {
                miss: 0,
                ratio: 0
            };
        }
        const miss = Math.max(0, best - selected);
        return {
            miss,
            ratio: miss / Math.max(1, Math.abs(best), Math.abs(selected))
        };
    }

    function minimaxBoardSearch(board: any, currentPlayer: any, rootPlayer: any, depth: any, alpha: any, beta: any, passCount: any, beamWidth: any) {
        if (!board || typeof board !== 'object' || depth <= 0 || passCount >= 2) {
            return evaluateBoardForSearch(board, rootPlayer);
        }

        const legalMoves = getLegalMovesBasic(board, currentPlayer);
        if (!legalMoves.length) {
            return minimaxBoardSearch(board, -currentPlayer, rootPlayer, depth - 1, alpha, beta, passCount + 1, beamWidth);
        }

        const maximizing = currentPlayer === rootPlayer;
        const orderedMoves = sortMovesForSearch(legalMoves, beamWidth, board);
        if (maximizing) {
            let best = -Infinity;
            for (const move of orderedMoves) {
                const nextBoard = applyMoveToBoard(board, move, currentPlayer);
                const score = minimaxBoardSearch(nextBoard, -currentPlayer, rootPlayer, depth - 1, alpha, beta, 0, beamWidth);
                if (score > best) best = score;
                if (score > alpha) alpha = score;
                if (beta <= alpha) break;
            }
            return best;
        }

        let best = Infinity;
        for (const move of orderedMoves) {
            const nextBoard = applyMoveToBoard(board, move, currentPlayer);
            const score = minimaxBoardSearch(nextBoard, -currentPlayer, rootPlayer, depth - 1, alpha, beta, 0, beamWidth);
            if (score < best) best = score;
            if (score < beta) beta = score;
            if (beta <= alpha) break;
        }
        return best;
    }

    return {
        countEmpties,
        isStandardBoard,
        countDiscDiffOnBoard,
        applyMoveToBoard,
        evaluateBoardForSearch,
        scoreMoveForSearchOrder,
        sortMovesForSearch,
        resolveTacticalSearchDepth,
        resolveTacticalBeamWidth,
        resolveTacticalMetricsCandidateLimit,
        computePositiveOpportunityMissMetrics,
        minimaxBoardSearch
    };
}
