/**
 * @file udg.js
 * @description Ultimate Destroy God (UDG) effect helpers
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardUdG = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function processUltimateDestroyGodEffects(cardState, gameState, playerKey, deps = {}) {
        const destroyed = [];
        const anchors = [];
        const expired = [];

        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            if (gs.board[r][c] === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            gs.board[r][c] = EMPTY;
            return true;
        });

        const udgs = (cardState.markers || []).filter(s => s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey);
        if (!udgs.length) return { destroyed, anchors, expired };

        for (const udg of udgs) {
            // Anchor must still be the owner's stone
            if (gameState.board[udg.row][udg.col] !== player) {
                if (udg.data) udg.data.remainingOwnerTurns = -1;
                continue;
            }

            // 1) Destroy surrounding enemy stones (Destroy)
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = udg.row + dr;
                    const c = udg.col + dc;
                    if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                    if (gameState.board[r][c] !== opponent) continue;
                    let destroyedRes = false;
                    if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                        const res = deps.BoardOps.destroyAt(cardState, gameState, r, c, 'ULTIMATE_DESTROY_GOD', 'udg_destroyed');
                        destroyedRes = !!res.destroyed;
                    } else {
                        destroyedRes = destroyAt(cardState, gameState, r, c);
                    }
                    if (destroyedRes) {
                        destroyed.push({ row: r, col: c });
                    }
                }
            }

            // 2) Decrement remaining turns
            const before = (udg.data && (udg.data.remainingOwnerTurns !== undefined && udg.data.remainingOwnerTurns !== null))
                ? udg.data.remainingOwnerTurns
                : 0;
            const afterDec = before - 1;
            if (udg.data) udg.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;
            anchors.push({ row: udg.row, col: udg.col, remainingNow: afterDec });

            // 3) Expire at 0: destroy anchor
            if (afterDec === 0) {
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, udg.row, udg.col, 'ULTIMATE_DESTROY_GOD', 'anchor_expired');
                    destroyedRes = !!res.destroyed;
                } else {
                    destroyedRes = destroyAt(cardState, gameState, udg.row, udg.col);
                }
                if (destroyedRes) {
                    expired.push({ row: udg.row, col: udg.col });
                }
                if (udg.data) udg.data.remainingOwnerTurns = -1;
            }
        }

        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(m =>
                m.kind !== 'specialStone' ||
                !m.data ||
                m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
                (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
            );
        }

        return { destroyed, anchors, expired };
    }

    function processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        const destroyed = [];
        const P_BLACK = BLACK || 1;
        const P_WHITE = WHITE || -1;
        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            if (gs.board[r][c] === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            gs.board[r][c] = EMPTY;
            return true;
        });

        const udg = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'ULTIMATE_DESTROY_GOD' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!udg) return { destroyed };
        if (gameState.board[row][col] !== player) return { destroyed };

        // 1) Destroy surrounding enemy stones (Destroy)
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                if (gameState.board[r][c] !== opponent) continue;
                let destroyedRes = false;
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    const res = deps.BoardOps.destroyAt(cardState, gameState, r, c, 'ULTIMATE_DESTROY_GOD', 'udg_destroyed');
                    destroyedRes = !!res.destroyed;
                } else {
                    destroyedRes = destroyAt(cardState, gameState, r, c);
                }
                if (destroyedRes) {
                    destroyed.push({ row: r, col: c });
                }
            }
        }

        // 2) Decrement remaining turns (skip decrement for immediate placement if requested)
        const before = (udg.data && (udg.data.remainingOwnerTurns !== undefined && udg.data.remainingOwnerTurns !== null))
            ? udg.data.remainingOwnerTurns
            : 0;
        const shouldDecrement = deps.decrementRemainingOwnerTurns !== false;
        const afterDec = shouldDecrement ? before - 1 : before;
        if (shouldDecrement) {
            if (udg.data) udg.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) return { destroyed };
        } else {
            // Keep remainingOwnerTurns unchanged for immediate (placement-turn) activation
            if (udg.data) udg.data.remainingOwnerTurns = before;
        }

        // 3) Expire at 0: destroy anchor (only when we actually decremented)
        const expired = [];
        if (shouldDecrement && afterDec === 0) {
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, udg.row, udg.col, 'ULTIMATE_DESTROY_GOD', 'anchor_expired');
                destroyedRes = !!res.destroyed;
            } else {
                destroyedRes = destroyAt(cardState, gameState, udg.row, udg.col);
            }
            if (destroyedRes) {
                expired.push({ row: udg.row, col: udg.col });
            }
            if (udg.data) udg.data.remainingOwnerTurns = -1;
        }

        // Remove expired anchors
        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(m =>
                m.kind !== 'specialStone' ||
                !m.data ||
                m.data.type !== 'ULTIMATE_DESTROY_GOD' ||
                (m.data.remainingOwnerTurns !== undefined && m.data.remainingOwnerTurns !== null && m.data.remainingOwnerTurns >= 0)
            );
        }

        return { destroyed, expired };
    }

    function processUltimateDestroyGodEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        // Single-anchor turn-start processing for UDG: destroy surrounding, decrement, expire
        // This re-uses the anchor-level processor with the default behavior (which decrements remainingOwnerTurns).
        const result = processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps);
        return result;
    }

    return {
        processUltimateDestroyGodEffects,
        processUltimateDestroyGodEffectsAtAnchor,
        processUltimateDestroyGodEffectsAtTurnStartAnchor
    };
}));
