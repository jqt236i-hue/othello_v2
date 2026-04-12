/**
 * @file position-weights.js
 * @description 盤面位置評価マトリックス（ブラウザ/Headless共通）
 * 
 * 各位置の戦略的価値を数値化:
 * - 角: 100 (最重要)
 * - X位置（角の斜め隣）: -30 (危険)
 * - C位置（角の隣）: -20 (やや危険)
 * - 辺: 10 (有利)
 * - 内側辺寄り: 5
 * - 中央: 1-3
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory(require('../../shared/shared-board-utils'));
    } else {
        // Browser
        root.PositionWeights = factory(root.SharedBoardUtils || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedBoardUtils) {
    'use strict';

    const BoardUtils = SharedBoardUtils || null;

    /**
     * 8x8 位置評価マトリックス
     * インデックス: [row][col]
     */
    const POSITION_WEIGHTS = [
        [100, -20, 10, 10, 10, 10, -20, 100],
        [-20, -30, 1, 1, 1, 1, -30, -20],
        [10, 1, 5, 3, 3, 5, 1, 10],
        [10, 1, 3, 1, 1, 3, 1, 10],
        [10, 1, 3, 1, 1, 3, 1, 10],
        [10, 1, 5, 3, 3, 5, 1, 10],
        [-20, -30, 1, 1, 1, 1, -30, -20],
        [100, -20, 10, 10, 10, 10, -20, 100]
    ];

    /**
     * 指定位置のスコアを取得
     * @param {number} row - 行 (0-7)
     * @param {number} col - 列 (0-7)
     * @returns {number} 位置スコア
     */
    function resolveBoardBounds(boardOrRows, maybeCols) {
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
        const rows = Number.isFinite(boardOrRows) ? Math.max(1, Math.floor(boardOrRows)) : 8;
        const cols = Number.isFinite(maybeCols) ? Math.max(1, Math.floor(maybeCols)) : rows;
        return { minRow: 0, maxRow: rows - 1, minCol: 0, maxCol: cols - 1 };
    }

    function getPositionScore(row, col, boardOrRows, maybeCols) {
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return 0;
        if (row < bounds.minRow || row > bounds.maxRow || col < bounds.minCol || col > bounds.maxCol) {
            return 0;
        }
        if (bounds.maxRow === 7 && bounds.maxCol === 7) {
            return POSITION_WEIGHTS[row][col];
        }
        if (isCorner(row, col, bounds.maxRow + 1, bounds.maxCol + 1)) return 100;
        if (isXSquare(row, col, bounds.maxRow + 1, bounds.maxCol + 1)) return -30;
        if (isCSquare(row, col, bounds.maxRow + 1, bounds.maxCol + 1)) return -20;
        if (isEdge(row, col, bounds.maxRow + 1, bounds.maxCol + 1)) return 10;
        const nearOuterRing = (
            row === (bounds.minRow + 1) ||
            row === (bounds.maxRow - 1) ||
            col === (bounds.minCol + 1) ||
            col === (bounds.maxCol - 1)
        );
        return nearOuterRing ? 5 : 1;
    }

    function isCorner(row, col, boardOrRows, maybeCols) {
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

    function isEdge(row, col, boardOrRows, maybeCols) {
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

    /**
     * X位置（角の斜め隣）かどうかを判定
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    function isXSquare(row, col, boardOrRows, maybeCols) {
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

    /**
     * C位置（角の隣）かどうかを判定
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    function isCSquare(row, col, boardOrRows, maybeCols) {
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

    return {
        POSITION_WEIGHTS,
        getPositionScore,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare
    };
}));
