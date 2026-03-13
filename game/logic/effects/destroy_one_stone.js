/**
 * @file destroy_one_stone.js
 * @description DESTROY_ONE_STONE helper - UMD module for browser and Node.js
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../board_ops'));
    } else {
        root.DestroyOneStone = factory(root.BoardOps);
    }
}(typeof self !== 'undefined' ? self : this, function (BoardOpsModule) {
    'use strict';

    function getCellValue(gameState, row, col) {
        if (!gameState || !Array.isArray(gameState.board)) return null;
        if (Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8) {
            return gameState.board[row][col];
        }

        const expansion = (gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return null;

        const cells = Array.isArray(expansion.cells)
            ? expansion.cells
            : (expansion.active ? [expansion] : []);

        for (const cell of cells) {
            if (!cell || typeof cell !== 'object') continue;
            const cellRow = Number(cell.row);
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            if (!Number.isInteger(cellRow) || !Number.isInteger(cellCol)) continue;
            if (cellRow === row && cellCol === col) {
                return Number(cell.owner || 0);
            }
        }

        return null;
    }

    function applyDestroyOneStone(cardState, gameState, playerKey, row, col, deps = {}) {
        const result = { destroyed: false, evaded: false };
        if (!gameState) return result;

        const BoardOps = deps.BoardOps || BoardOpsModule;
        const destroyAtFn = deps.destroyAt;

        // Prefer BoardOps.destroyAt to ensure unified behavior and presentation event emission
        if (BoardOps && typeof BoardOps.destroyAt === 'function') {
            const res = BoardOps.destroyAt(cardState, gameState, row, col, 'DESTROY_ONE_STONE', 'destroy_one_stone');
            if (res && (res.destroyed || res.evaded)) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                result.destroyed = !!res.destroyed;
                result.evaded = !!res.evaded;
                return result;
            }
            // If BoardOps rejected destroy (e.g. guard protection), do not bypass with fallback paths.
            if (res && res.destroyed === false) {
                return result;
            }
        }

        // If destroyAt function provided
        if (typeof destroyAtFn === 'function') {
            if (getCellValue(gameState, row, col) === 0) return result;
            const destroyed = destroyAtFn(cardState, gameState, row, col);
            if (destroyed) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                result.destroyed = true;
                return result;
            }
        }

        // Fallback: original inline behavior
        if (getCellValue(gameState, row, col) === 0) return result;
        if (cardState && cardState.markers) {
            cardState.markers = cardState.markers.filter(m => !(m.row === row && m.col === col));
        }
        if (Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8) {
            gameState.board[row][col] = 0;
        } else if (gameState.boardExpansion && typeof gameState.boardExpansion === 'object') {
            const expansion = gameState.boardExpansion;
            const cells = Array.isArray(expansion.cells) ? expansion.cells : (expansion.active ? [expansion] : []);
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                if (!cell || typeof cell !== 'object') continue;
                const cellRow = Number(cell.row);
                const cellCol = Number.isInteger(cell.col)
                    ? cell.col
                    : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
                if (!Number.isInteger(cellRow) || !Number.isInteger(cellCol)) continue;
                if (cellRow === row && cellCol === col) {
                    cells[i] = Object.assign({}, cell, { owner: 0 });
                }
            }
            if (Array.isArray(expansion.cells)) {
                expansion.cells = cells;
            } else if (expansion.active) {
                const target = cells.find((cell) => cell && Number(cell.row) === row);
                if (target) expansion.owner = 0;
            }
        }
        cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
        cardState.pendingEffectByPlayer[playerKey] = null;
        result.destroyed = true;
        return result;
    }

    return {
        applyDestroyOneStone
    };
}));
