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
        module.exports = factory();
    } else {
        // Browser
        root.PositionWeights = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

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
    function getPositionScore(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) {
            return 0;
        }
        return POSITION_WEIGHTS[row][col];
    }

    /**
     * 角かどうかを判定
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    function isCorner(row, col) {
        return (row === 0 || row === 7) && (col === 0 || col === 7);
    }

    /**
     * 辺かどうかを判定
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    function isEdge(row, col) {
        return row === 0 || row === 7 || col === 0 || col === 7;
    }

    /**
     * X位置（角の斜め隣）かどうかを判定
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    function isXSquare(row, col) {
        return (row === 1 || row === 6) && (col === 1 || col === 6);
    }

    /**
     * C位置（角の隣）かどうかを判定
     * @param {number} row
     * @param {number} col
     * @returns {boolean}
     */
    function isCSquare(row, col) {
        return ((row === 0 || row === 7) && (col === 1 || col === 6)) ||
            ((row === 1 || row === 6) && (col === 0 || col === 7));
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
