/**
 * @file swap_with_enemy.js
 * @description SWAP_WITH_ENEMY helper - UMD module for browser and Node.js
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../../shared-constants'),
            (function () {
                try {
                    return require('../cards/utils');
                } catch (e) {
                    return null;
                }
            })(),
            (function () {
                try {
                    return require('../core');
                } catch (e) {
                    return null;
                }
            })()
        );
    } else {
        root.SwapWithEnemy = factory(root.SharedConstants, root.CardUtils || null, root.CoreLogic || root.Core || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardUtils, CoreModule) {
    'use strict';

    const { BLACK, WHITE, EMPTY, CHARGE_MAX } = SharedConstants || {};
    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;
    const P_EMPTY = (typeof EMPTY === 'number') ? EMPTY : 0;

    function normalizeFlips(flips) {
        if (!Array.isArray(flips) || flips.length === 0) return [];
        return flips
            .filter(f => Array.isArray(f) && Number.isInteger(f[0]) && Number.isInteger(f[1]))
            .map(f => [f[0], f[1]]);
    }

    function resolveSwapFlips(gameState, row, col, player, context, core) {
        if (!core || typeof core.getFlipsWithContext !== 'function') return [];
        if (!gameState || !Array.isArray(gameState.board) || !Array.isArray(gameState.board[row])) return [];
        const prev = gameState.board[row][col];
        gameState.board[row][col] = P_EMPTY;
        try {
            return normalizeFlips(core.getFlipsWithContext(gameState, row, col, player, context || {}));
        } finally {
            gameState.board[row][col] = prev;
        }
    }

    function applySwapWithEnemy(cardState, gameState, playerKey, row, col, deps = {}) {
        const boardOpsInstance = deps.BoardOps;
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions;
        const clearBombAt = deps.clearBombAt;
        const core = deps.Core || CoreModule || null;
        const cardContext = deps.cardContext || {};
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
            const isExpiredUltimateHyperactive = !!(
                m.data &&
                m.data.type === 'ULTIMATE_HYPERACTIVE' &&
                Number.isFinite(Number(m.data.remainingOwnerTurns)) &&
                Number(m.data.remainingOwnerTurns) <= 0
            );
            if (isExpiredUltimateHyperactive) return false;
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
                !(
                    s.kind === 'specialStone' &&
                    s.data &&
                    (s.data.type === 'HYPERACTIVE' || s.data.type === 'ESCAPE_HYPERACTIVE' || s.data.type === 'EXTREME_HYPERACTIVE') &&
                    s.row === row &&
                    s.col === col
                )
            );
        }

        const swapFlips = resolveSwapFlips(gameState, row, col, player, cardContext, core);
        if (swapFlips.length > 0) {
            for (const [fr, fc] of swapFlips) {
                if (boardOpsInstance && typeof boardOpsInstance.changeAt === 'function') {
                    boardOpsInstance.changeAt(cardState, gameState, fr, fc, playerKey, 'SWAP', 'swap_with_enemy_capture');
                } else {
                    gameState.board[fr][fc] = player;
                }
                if (typeof clearBombAt === 'function') {
                    clearBombAt(cardState, fr, fc);
                }
            }
            if (typeof clearHyperactiveAtPositions === 'function') {
                clearHyperactiveAtPositions(cardState, swapFlips.map(([fr, fc]) => ({ row: fr, col: fc })));
            }
        }

        cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
        cardState.pendingEffectByPlayer[playerKey] = null;

        // Rule 10.4: SWAP 本体1枚 + 交換起点の挟み反転ぶんを加算
        cardState.charge = cardState.charge || { black: 0, white: 0 };
        const chargeGain = 1 + swapFlips.length;
        if (CardUtils && typeof CardUtils.addChargeWithDelta === 'function') {
            CardUtils.addChargeWithDelta(cardState, playerKey, chargeGain, 'swap_flip_gain');
        } else {
            cardState.charge[playerKey] = Math.min(CHARGE_MAX || 99, (cardState.charge[playerKey] || 0) + chargeGain);
        }

        result.swapped = true;
        result.flipped = swapFlips.map(([fr, fc]) => ({ row: fr, col: fc }));
        return result;
    }

    return {
        applySwapWithEnemy
    };
}));
