/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CpuPolicyBoard, CpuPolicyMove } from './cpu-policy-core-types';

type CpuPolicyBoardFeaturesConfig = {
    SharedBoardUtils?: any;
    inBoard?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => boolean;
    isXSquare?: (row: number, col: number, board: CpuPolicyBoard | null | undefined) => boolean;
    isCSquare?: (row: number, col: number, board: CpuPolicyBoard | null | undefined) => boolean;
    hasOwnedAdjacentCorner?: (board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number) => boolean;
    getLegalMovesBasic?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyMove[];
    isCorner?: (row: number, col: number, board: CpuPolicyBoard | null | undefined) => boolean;
};

function fallbackInBoard(board: CpuPolicyBoard | null | undefined, row: number, col: number): boolean {
    return (
        Array.isArray(board) &&
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= 0 &&
        row < board.length &&
        Array.isArray(board[row]) &&
        col >= 0 &&
        col < board[row].length
    );
}

function fallbackGetBoardCellValue(
    board: CpuPolicyBoard | null | undefined,
    row: number,
    col: number
): unknown {
    if (!Array.isArray(board)) return null;
    const denseRow = board[row];
    return Array.isArray(denseRow) ? denseRow[col] : null;
}

export function createCpuPolicyBoardFeatures(config?: CpuPolicyBoardFeaturesConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuPolicyBoardFeaturesConfig;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const inBoard = typeof cfg.inBoard === 'function' ? cfg.inBoard : fallbackInBoard;
    const isXSquare = typeof cfg.isXSquare === 'function' ? cfg.isXSquare : (() => false);
    const isCSquare = typeof cfg.isCSquare === 'function' ? cfg.isCSquare : (() => false);
    const hasOwnedAdjacentCorner = typeof cfg.hasOwnedAdjacentCorner === 'function'
        ? cfg.hasOwnedAdjacentCorner
        : (() => false);
    const getLegalMovesBasic = typeof cfg.getLegalMovesBasic === 'function'
        ? cfg.getLegalMovesBasic
        : (() => []);
    const isCorner = typeof cfg.isCorner === 'function' ? cfg.isCorner : (() => false);

    function countCornersFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
        if (sharedBoardUtils && typeof sharedBoardUtils.countCornerControl === 'function') {
            return Number(sharedBoardUtils.countCornerControl(board, playerValue).ownCorners || 0);
        }
        if (!Array.isArray(board) || board.length <= 0) return 0;
        const maxR = board.length - 1;
        const maxC = Array.isArray(board[0]) ? (board[0].length - 1) : maxR;
        const corners = [
            [0, 0],
            [0, maxC],
            [maxR, 0],
            [maxR, maxC]
        ];
        let count = 0;
        for (const p of corners) {
            if (inBoard(board, p[0], p[1]) && board[p[0]][p[1]] === playerValue) count += 1;
        }
        return count;
    }

    function countEdgesFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
        if (sharedBoardUtils && typeof sharedBoardUtils.countEdgeControl === 'function') {
            return Number(sharedBoardUtils.countEdgeControl(board, playerValue).ownEdges || 0);
        }
        if (!Array.isArray(board) || board.length <= 0) return 0;
        let count = 0;
        const maxR = board.length - 1;
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            if (row.length <= 0) continue;
            const maxC = row.length - 1;
            for (let c = 0; c < row.length; c++) {
                const corner = (r === 0 || r === maxR) && (c === 0 || c === maxC);
                const edge = (r === 0 || r === maxR || c === 0 || c === maxC);
                if (edge && !corner && row[c] === playerValue) count += 1;
            }
        }
        return count;
    }

    function summarizeEdgeRunsFor(board: CpuPolicyBoard | null | undefined, playerValue: number) {
        if (sharedBoardUtils && typeof sharedBoardUtils.summarizeEdgeRuns === 'function') {
            return sharedBoardUtils.summarizeEdgeRuns(board, playerValue);
        }
        return {
            totalLines: 0,
            maxLineLength: 0,
            totalLineCells: 0,
            totalOwnedCells: 0,
            chainStrength: 0,
            longestRun: 0,
            longestRunShare: 0,
            completeLineCount: 0,
            segmentCount: 0,
            loneDiscCount: 0
        };
    }

    function countAdjacentLoneEdgeDiscsFor(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): number {
        if (sharedBoardUtils && typeof sharedBoardUtils.countAdjacentLoneEdgeDiscs === 'function') {
            return Number(sharedBoardUtils.countAdjacentLoneEdgeDiscs(board, row, col, playerValue) || 0);
        }
        return 0;
    }

    function normalizePriorScore(score: unknown): number {
        const n = Number(score);
        if (!Number.isFinite(n) || n === 0) return 0;
        return Math.sign(n) * Math.log1p(Math.abs(n));
    }

    function countXsAndCsFor(board: CpuPolicyBoard | null | undefined, playerValue: number): { x: number; c: number } {
        if ((!board || typeof board !== 'object')
            || (!Array.isArray(board) && (!sharedBoardUtils || typeof sharedBoardUtils.collectBoardCoordinates !== 'function'))) {
            return { x: 0, c: 0 };
        }
        let x = 0;
        let c = 0;
        const coordinates = sharedBoardUtils && typeof sharedBoardUtils.collectBoardCoordinates === 'function'
            ? sharedBoardUtils.collectBoardCoordinates(board)
            : (Array.isArray(board) ? board.flatMap((row, rowIndex) => (
                Array.isArray(row) ? row.map((_value, col) => ({ row: rowIndex, col })) : []
            )) : []);
        for (const cell of coordinates) {
            const row = Number(cell && cell.row);
            const col = Number(cell && cell.col);
            const owner = sharedBoardUtils && typeof sharedBoardUtils.getCellValue === 'function'
                ? sharedBoardUtils.getCellValue(board, row, col)
                : fallbackGetBoardCellValue(board, row, col);
            if (owner !== playerValue) continue;
            const xSquare = isXSquare(row, col, board);
            const cSquare = !xSquare && isCSquare(row, col, board);
            if (!xSquare && !cSquare) continue;
            if (hasOwnedAdjacentCorner(board, row, col, playerValue)) continue;
            if (xSquare) x += 1;
            else c += 1;
        }
        return { x, c };
    }

    function countCornerMovesFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
        const legal = getLegalMovesBasic(board, playerValue);
        if (!Array.isArray(legal) || legal.length <= 0) return 0;
        let count = 0;
        for (const move of legal) {
            if (move && isCorner(move.row, move.col, board)) count += 1;
        }
        return count;
    }

    return {
        countCornersFor,
        countEdgesFor,
        summarizeEdgeRunsFor,
        countAdjacentLoneEdgeDiscsFor,
        normalizePriorScore,
        countXsAndCsFor,
        countCornerMovesFor
    };
}
