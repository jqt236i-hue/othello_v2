/**
 * @file swap_with_enemy.js
 * @description SWAP_WITH_ENEMY helper - UMD module for browser and Node.js
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.SwapWithEnemy = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE } = SharedConstants || {};
    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;

    function applySwapWithEnemy(cardState, gameState, playerKey, row, col, deps = {}) {
        const boardOpsInstance = deps.BoardOps;
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
        const result = { swapped: false };

        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        if (!gameState || gameState.board[row][col] !== opponent) return result;

        // Swap targets must be NORMAL stones only.
        // Hidden trap stones owned by opponent are treated as normal for the acting player.
        const hasSpecialOrBomb = (cardState.markers || []).some(m => {
            if (!m || m.row !== row || m.col !== col) return false;
            if (m.kind === 'bomb') return true;
            if (m.kind !== 'specialStone') return false;
            const isHiddenTrapForPlayer = !!(m.data && m.data.type === 'TRAP' && m.owner && m.owner !== playerKey);
            if (isHiddenTrapForPlayer) return false;
            return true;
        });
        if (hasSpecialOrBomb) return result;

        if (boardOpsInstance && typeof boardOpsInstance.changeAt === 'function') {
            boardOpsInstance.changeAt(cardState, gameState, row, col, playerKey, 'SWAP', 'swap_with_enemy');
        } else {
            gameState.board[row][col] = player;
        }

        // Clear hyperactive at swapped position
        if (typeof clearHyperactiveAtPositions === 'function') {
            clearHyperactiveAtPositions(cardState, [{ row, col }]);
        } else if (cardState.markers && cardState.markers.length) {
            cardState.markers = cardState.markers.filter(s =>
                !(s.kind === 'specialStone' && s.data && s.data.type === 'HYPERACTIVE' && s.row === row && s.col === col)
            );
        }

        cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
        cardState.pendingEffectByPlayer[playerKey] = null;

        // Rule 10.4: SWAP は反転扱いでチャージ対象（1枚分加算）
        cardState.charge = cardState.charge || { black: 0, white: 0 };
        cardState.charge[playerKey] = Math.min(30, (cardState.charge[playerKey] || 0) + 1);

        result.swapped = true;
        return result;
    }

    return {
        applySwapWithEnemy
    };
}));
