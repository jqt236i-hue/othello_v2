/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplaySearchPrimitivesConfig = {
    SharedBoardUtils?: any;
    getLegalMovesBasic?: (board: any, playerValue: any) => any[];
    setBoardCellValue?: (board: any, row: any, col: any, value: any) => any;
    evaluatePositionValue?: (row: any, col: any, board: any) => number;
    countCorners?: (board: any, playerValue: any) => number;
};

export function createSelfplaySearchPrimitives(config?: SelfplaySearchPrimitivesConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplaySearchPrimitivesConfig;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const getLegalMovesBasic = typeof cfg.getLegalMovesBasic === 'function' ? cfg.getLegalMovesBasic : (() => []);
    const setBoardCellValue = typeof cfg.setBoardCellValue === 'function'
        ? cfg.setBoardCellValue
        : ((board: any, row: any, col: any, value: any) => {
            if (!Array.isArray(board) || !Array.isArray(board[row])) return false;
            board[row][col] = value;
            return true;
        });
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
        let empties = 0;
        for (let row = 0; row < board.length; row++) {
            for (let col = 0; col < board[row].length; col++) {
                if (board[row][col] === 0) empties += 1;
            }
        }
        return empties;
    }

    function isStandardBoard(board: any) {
        if (sharedBoardUtils && typeof sharedBoardUtils.isStandardBoard8x8 === 'function') {
            return sharedBoardUtils.isStandardBoard8x8(board);
        }
        if (!Array.isArray(board) || board.length !== 8) return false;
        for (const row of board) {
            if (!Array.isArray(row) || row.length !== 8) return false;
        }
        return true;
    }

    function countDiscDiffOnBoard(board: any, playerValue: any) {
        if (!Array.isArray(board)) return 0;
        let own = 0;
        let opp = 0;
        if (sharedBoardUtils && typeof sharedBoardUtils.collectBoardCoordinates === 'function') {
            for (const cell of sharedBoardUtils.collectBoardCoordinates(board)) {
                const row = cell && cell.row;
                const col = cell && cell.col;
                const v = Array.isArray(board) && Array.isArray(board[row]) ? board[row][col] : null;
                if (v === playerValue) own += 1;
                else if (v === -playerValue) opp += 1;
            }
        } else {
            for (let row = 0; row < board.length; row++) {
                const cells = Array.isArray(board[row]) ? board[row] : [];
                for (let col = 0; col < cells.length; col++) {
                    const v = cells[col];
                    if (v === playerValue) own += 1;
                    else if (v === -playerValue) opp += 1;
                }
            }
        }
        return own - opp;
    }

    function applyMoveToBoard(board: any, move: any, playerValue: any) {
        if (!Array.isArray(board)) return [];
        const next = (sharedBoardUtils && typeof sharedBoardUtils.cloneBoard === 'function')
            ? sharedBoardUtils.cloneBoard(board)
            : board.map((row: any) => (Array.isArray(row) ? row.slice() : []));
        if (!move || !Number.isFinite(move.row) || !Number.isFinite(move.col)) return next;
        if (!setBoardCellValue(next, move.row, move.col, playerValue)) return next;
        const flips = Array.isArray(move.flips) ? move.flips : [];
        for (const flip of flips) {
            if (Array.isArray(flip) && flip.length >= 2 && Number.isFinite(flip[0]) && Number.isFinite(flip[1])) {
                setBoardCellValue(next, flip[0], flip[1], playerValue);
                continue;
            }
            if (flip && Number.isFinite(flip.row) && Number.isFinite(flip.col)) {
                setBoardCellValue(next, flip.row, flip.col, playerValue);
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
        if (!Array.isArray(board)) return 0;
        let score = 0;
        for (let row = 0; row < board.length; row++) {
            const oneRow = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < oneRow.length; col++) {
                const v = oneRow[col];
                if (v === playerValue) score += evaluatePositionValue(row, col, board);
                else if (v === -playerValue) score -= evaluatePositionValue(row, col, board);
            }
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
        if (!Array.isArray(board) || depth <= 0 || passCount >= 2) {
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
