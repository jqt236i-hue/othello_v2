/**
 * @file position-weights.ts
 * @description 盤面位置評価マトリックス（ブラウザ/Headless共通）
 */


declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

const BoardUtils = (typeof module === 'object' && module.exports)
    ? _require('../../shared/shared-board-utils')
    : (typeof self !== 'undefined' ? (self as any).SharedBoardUtils : null);

interface Bounds {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

const POSITION_WEIGHTS: number[][] = [
    [100, -20, 10, 10, 10, 10, -20, 100],
    [-20, -30, 1, 1, 1, 1, -30, -20],
    [10, 1, 5, 3, 3, 5, 1, 10],
    [10, 1, 3, 1, 1, 3, 1, 10],
    [10, 1, 3, 1, 1, 3, 1, 10],
    [10, 1, 5, 3, 3, 5, 1, 10],
    [-20, -30, 1, 1, 1, 1, -30, -20],
    [100, -20, 10, 10, 10, 10, -20, 100]
];

function resolveBoardBounds(boardOrRows: number | number[][], maybeCols?: number): Bounds | null {
    if (BoardUtils && typeof BoardUtils.resolveBoardBounds === 'function') {
        return BoardUtils.resolveBoardBounds(boardOrRows, maybeCols);
    }
    if (Array.isArray(boardOrRows)) {
        if (boardOrRows.length <= 0) return null;
        let maxCol = -1;
        for (const row of boardOrRows) {
            if (Array.isArray(row) && row.length > 0) {
                maxCol = Math.max(maxCol, row.length - 1);
            }
        }
        if (maxCol < 0) return null;
        return { minRow: 0, maxRow: boardOrRows.length - 1, minCol: 0, maxCol };
    }
    const rows = Number.isFinite(boardOrRows) ? Math.max(1, Math.floor(boardOrRows as number)) : 8;
    const cols = Number.isFinite(maybeCols) ? Math.max(1, Math.floor(maybeCols as number)) : rows;
    return { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 };
}

function getPositionScore(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): number {
    const bounds = resolveBoardBounds(boardOrRows, maybeCols);
    if (!bounds) return 0;
    if (row < bounds.minRow || row > bounds.maxRow || col < bounds.minCol || col > bounds.maxCol) {
        return 0;
    }
    if (bounds.maxRow === 7 && bounds.maxCol === 7) {
        return POSITION_WEIGHTS[row][col];
    }
    if (isCorner(row, col, boardOrRows, maybeCols)) return 100;
    if (isXSquare(row, col, boardOrRows, maybeCols)) return -30;
    if (isCSquare(row, col, boardOrRows, maybeCols)) return -20;
    if (isEdge(row, col, boardOrRows, maybeCols)) return 10;
    const nearOuterRing = (
        row === (bounds.minRow + 1) ||
        row === (bounds.maxRow - 1) ||
        col === (bounds.minCol + 1) ||
        col === (bounds.maxCol - 1)
    );
    return nearOuterRing ? 5 : 1;
}

function isCorner(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean {
    if (BoardUtils && typeof BoardUtils.isCorner === 'function') {
        return BoardUtils.isCorner(row, col, boardOrRows, maybeCols);
    }
    const bounds = resolveBoardBounds(boardOrRows, maybeCols);
    if (!bounds) return false;
    return (
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        (row === bounds.minRow || row === bounds.maxRow) &&
        (col === bounds.minCol || col === bounds.maxCol)
    );
}

function isEdge(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean {
    if (BoardUtils && typeof BoardUtils.isEdge === 'function') {
        return BoardUtils.isEdge(row, col, boardOrRows, maybeCols);
    }
    const bounds = resolveBoardBounds(boardOrRows, maybeCols);
    if (!bounds) return false;
    return (
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        (row === bounds.minRow || row === bounds.maxRow || col === bounds.minCol || col === bounds.maxCol)
    );
}

function isXSquare(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean {
    if (BoardUtils && typeof BoardUtils.isXSquare === 'function') {
        return BoardUtils.isXSquare(row, col, boardOrRows, maybeCols);
    }
    const bounds = resolveBoardBounds(boardOrRows, maybeCols);
    if (!bounds) return false;
    if ((bounds.maxRow - bounds.minRow) < 2 || (bounds.maxCol - bounds.minCol) < 2) return false;
    return (
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        (row === (bounds.minRow + 1) || row === (bounds.maxRow - 1)) &&
        (col === (bounds.minCol + 1) || col === (bounds.maxCol - 1))
    );
}

function isCSquare(row: number, col: number, boardOrRows: number | number[][], maybeCols?: number): boolean {
    if (BoardUtils && typeof BoardUtils.isCSquare === 'function') {
        return BoardUtils.isCSquare(row, col, boardOrRows, maybeCols);
    }
    const bounds = resolveBoardBounds(boardOrRows, maybeCols);
    if (!bounds) return false;
    if ((bounds.maxRow - bounds.minRow) < 2 || (bounds.maxCol - bounds.minCol) < 2) return false;
    return (
        ((row === bounds.minRow || row === bounds.maxRow) && (col === (bounds.minCol + 1) || col === (bounds.maxCol - 1))) ||
        ((row === (bounds.minRow + 1) || row === (bounds.maxRow - 1)) && (col === bounds.minCol || col === bounds.maxCol))
    );
}

export = {
    POSITION_WEIGHTS,
    getPositionScore,
    isCorner,
    isEdge,
    isXSquare,
    isCSquare
};
