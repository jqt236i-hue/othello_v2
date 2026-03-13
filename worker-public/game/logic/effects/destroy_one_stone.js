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

    function applyDestroyOneStone(cardState, gameState, playerKey, row, col, deps = {}) {
        const result = { destroyed: false };
        if (!gameState || gameState.board[row][col] === 0) return result;

        const BoardOps = deps.BoardOps || BoardOpsModule;
        const destroyAtFn = deps.destroyAt;

        // Prefer BoardOps.destroyAt to ensure unified behavior and presentation event emission
        if (BoardOps && typeof BoardOps.destroyAt === 'function') {
            const res = BoardOps.destroyAt(cardState, gameState, row, col, 'DESTROY_ONE_STONE', 'destroy_one_stone');
            if (res && res.destroyed) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                result.destroyed = true;
                return result;
            }
            // If BoardOps rejected destroy (e.g. guard protection), do not bypass with fallback paths.
            if (res && res.destroyed === false) {
                return result;
            }
        }

        // If destroyAt function provided
        if (typeof destroyAtFn === 'function') {
            const destroyed = destroyAtFn(cardState, gameState, row, col);
            if (destroyed) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                result.destroyed = true;
                return result;
            }
        }

        // Fallback: original inline behavior
        if (cardState && cardState.markers) {
            cardState.markers = cardState.markers.filter(m => !(m.row === row && m.col === col));
        }
        gameState.board[row][col] = 0;
        cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
        cardState.pendingEffectByPlayer[playerKey] = null;
        result.destroyed = true;
        return result;
    }

    return {
        applyDestroyOneStone
    };
}));
