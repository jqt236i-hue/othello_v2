/**
 * @file time_bomb.js
 * @description Time Bomb helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardTimeBomb = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { TIME_BOMB_TURNS } = SharedConstants || {};

    function applyTimeBomb(cardState, playerKey, row, col, deps = {}) {
        const addMarker = deps.addMarker || ((cs, kind, r, c, owner, data) => {
            if (!cs.markers) cs.markers = [];
            const id = (typeof cs._nextMarkerId === 'number') ? cs._nextMarkerId++ : 1;
            const createdSeq = (typeof cs._nextCreatedSeq === 'number') ? cs._nextCreatedSeq++ : 1;
            cs.markers.push({
                id,
                row: r,
                col: c,
                kind: kind,
                owner,
                createdSeq,
                data: { remainingTurns: data.remainingTurns, placedTurn: data.placedTurn }
            });
            return { placed: true };
        });

        const bombs = (cardState.markers || []).filter(m => m.kind === 'bomb');
        if (bombs.some(b => b.row === row && b.col === col)) return { placed: false, reason: 'exists' };

        addMarker(cardState, 'bomb', row, col, playerKey, {
            remainingTurns: TIME_BOMB_TURNS,
            placedTurn: cardState.turnIndex
        });
        return { placed: true };
    }

    function tickBombs(cardState, gameState, playerKey, deps = {}) {
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            if (gs.board[r][c] === 0) return false;
            // remove markers if applicable
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            gs.board[r][c] = 0;
            return true;
        });

        const exploded = [];
        const destroyed = [];
        const activeKey = playerKey || cardState.lastTurnStartedFor;
        const bombs = (cardState.markers || []).filter(m => m.kind === 'bomb');
        const removeIds = new Set();

        for (const bomb of bombs) {
            if (activeKey && bomb.owner !== activeKey) {
                continue;
            }
            if (bomb.data && bomb.data.placedTurn === cardState.turnIndex) {
                continue;
            }
            if (!bomb.data) bomb.data = {};
            bomb.data.remainingTurns = (typeof bomb.data.remainingTurns === 'number') ? bomb.data.remainingTurns - 1 : -1;
            if (bomb.data.remainingTurns <= 0) {
                exploded.push({ row: bomb.row, col: bomb.col });
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const r = bomb.row + dr;
                        const c = bomb.col + dc;
                        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                            let destroyedRes = false;
                            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                                const res = deps.BoardOps.destroyAt(cardState, gameState, r, c, 'TIME_BOMB', 'bomb_explosion');
                                destroyedRes = !!res.destroyed;
                            } else {
                                destroyedRes = destroyAt(cardState, gameState, r, c);
                            }
                            if (destroyedRes) {
                                destroyed.push({ row: r, col: c });
                            }
                        }
                    }
                }
                if (bomb.id !== undefined) {
                    removeIds.add(bomb.id);
                } else {
                    removeIds.add(`${bomb.row},${bomb.col},${bomb.owner}`);
                }
            }
        }

        if (removeIds.size > 0) {
            cardState.markers = (cardState.markers || []).filter(m => {
                if (m.kind !== 'bomb') return true;
                if (removeIds.has(m.id)) return false;
                return !removeIds.has(`${m.row},${m.col},${m.owner}`);
            });
        }
        return { exploded, destroyed };
    }

    return {
        applyTimeBomb,
        tickBombs
    };
}));
