/**
 * @file dragon.js
 * @description DRAGON effect helper - UMD module for browser and Node.js
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.DragonEffects = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE } = SharedConstants || {};
    const P_BLACK = BLACK || 1;
    const P_WHITE = WHITE || -1;

    function processDragonEffects(cardState, gameState, playerKey, deps = {}) {
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];
        const anchors = [];

        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        // Build protection sets for quick lookup
        const protectedSet = new Set(
            (cardState.markers || [])
                .filter(s => s.kind === 'specialStone' && s.data && (s.data.type === 'PROTECTED' || s.data.type === 'PERMA_PROTECTED' || s.data.type === 'ULTIMATE_DESTROY_GOD' || s.data.type === 'BREEDING' || s.data.type === 'DRAGON'))
                .map(s => `${s.row},${s.col}`)
        );
        const dragons = (cardState.markers || []).filter(s => s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON');

        const clearBombAt = (row, col) => {
            if (!cardState.markers || !cardState.markers.length) return;
            const b = cardState.markers.find(x => x.kind === 'bomb' && x.row === row && x.col === col);
            if (!b) return;
            cardState.markers = cardState.markers.filter(x => !(x.kind === 'bomb' && x.row === row && x.col === col));
        };

        for (const dragon of dragons) {
            if (dragon.owner !== playerKey) continue;

            // Anchor check
            if (gameState.board[dragon.row][dragon.col] !== player) {
                if (dragon.data) dragon.data.remainingOwnerTurns = -1;
                continue;
            }

            // Turn countdown: decrement first, then fire if >= 0 (0 fires too)
            const before = (dragon.data && (dragon.data.remainingOwnerTurns !== undefined && dragon.data.remainingOwnerTurns !== null))
                ? dragon.data.remainingOwnerTurns
                : 0;
            const afterDec = before - 1;
            if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;
            anchors.push({ row: dragon.row, col: dragon.col, remainingNow: afterDec });

            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = dragon.row + dr;
                    const c = dragon.col + dc;
                    if (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === opponent) {
                        const key = `${r},${c}`;
                        if (protectedSet.has(key)) continue;
                        if (BoardOps && typeof BoardOps.changeAt === 'function') {
                            BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert');
                        } else {
                            gameState.board[r][c] = player;
                        }
                        clearBombAt(r, c);
                        converted.push({ row: r, col: c });
                    }
                }
            }

            // If countdown reached 0 this turn, destroy anchor after applying
            if (afterDec === 0) {
                destroyed.push({ row: dragon.row, col: dragon.col });
                if (BoardOps && typeof BoardOps.destroyAt === 'function') {
                    BoardOps.destroyAt(cardState, gameState, dragon.row, dragon.col, 'DRAGON', 'anchor_expired');
                } else {
                    gameState.board[dragon.row][dragon.col] = 0;
                }
                if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            }
        }

        // Remove expired dragon anchors from specialStones
        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' ||
                !s.data ||
                s.data.type !== 'DRAGON' ||
                (s.data.remainingOwnerTurns !== undefined && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0)
            );
        }

        if (converted.length > 0 && cardState.markers) {
            const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' || !s.data || s.data.type !== 'HYPERACTIVE' || !removeSet.has(`${s.row},${s.col}`)
            );
        }

        return { converted, destroyed, anchors };
    }

    function processDragonEffectsAtAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];

        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const dragon = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!dragon) return { converted, destroyed };
        if (gameState.board[row][col] !== player) return { converted, destroyed };

        const protectedSet = new Set(
            (cardState.markers || [])
                .filter(s => s.kind === 'specialStone' && s.data && (s.data.type === 'PROTECTED' || s.data.type === 'PERMA_PROTECTED' || s.data.type === 'ULTIMATE_DESTROY_GOD' || s.data.type === 'BREEDING' || s.data.type === 'DRAGON'))
                .map(s => `${s.row},${s.col}`)
        );
        const clearBombAt = (r, c) => {
            if (!cardState.markers || !cardState.markers.length) return;
            const b = cardState.markers.find(x => x.kind === 'bomb' && x.row === r && x.col === c);
            if (!b) return;
            cardState.markers = cardState.markers.filter(x => !(x.kind === 'bomb' && x.row === r && x.col === c));
        };

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                if (gameState.board[r][c] !== opponent) continue;
                const key = `${r},${c}`;
                if (protectedSet.has(key)) continue;
                if (BoardOps && typeof BoardOps.changeAt === 'function') {
                    BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert_immediate');
                } else {
                    gameState.board[r][c] = player;
                }
                clearBombAt(r, c);
                converted.push({ row: r, col: c });
            }
        }

        if (converted.length > 0 && cardState.markers) {
            const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' || !s.data || s.data.type !== 'HYPERACTIVE' || !removeSet.has(`${s.row},${s.col}`)
            );
        }

        return { converted, destroyed };
    }

    function processDragonEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, deps = {}) {
        // Process a single dragon anchor at turn start: decrement counter and apply conversions/expiration
        const BoardOps = deps.BoardOps;
        const converted = [];
        const destroyed = [];
        const anchors = [];

        const player = playerKey === 'black' ? P_BLACK : P_WHITE;
        const opponent = -player;

        const dragon = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'DRAGON' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!dragon) return { converted, destroyed, anchors };

        // Anchor must still be owner's stone
        if (gameState.board[row][col] !== player) {
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
            return { converted, destroyed, anchors };
        }

        const before = (dragon.data && (dragon.data.remainingOwnerTurns !== undefined && dragon.data.remainingOwnerTurns !== null))
            ? dragon.data.remainingOwnerTurns
            : 0;
        const afterDec = before - 1;
        if (dragon.data) dragon.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { converted, destroyed, anchors };
        anchors.push({ row, col, remainingNow: afterDec });

        const protectedSet = new Set(
            (cardState.markers || [])
                .filter(s => s.kind === 'specialStone' && s.data && (s.data.type === 'PROTECTED' || s.data.type === 'PERMA_PROTECTED' || s.data.type === 'ULTIMATE_DESTROY_GOD' || s.data.type === 'BREEDING' || s.data.type === 'DRAGON'))
                .map(s => `${s.row},${s.col}`)
        );
        const clearBombAt = (r, c) => {
            if (!cardState.markers || !cardState.markers.length) return;
            const b = cardState.markers.find(x => x.kind === 'bomb' && x.row === r && x.col === c);
            if (!b) return;
            cardState.markers = cardState.markers.filter(x => !(x.kind === 'bomb' && x.row === r && x.col === c));
        };

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === opponent) {
                    const key = `${r},${c}`;
                    if (protectedSet.has(key)) continue;
                    if (BoardOps && typeof BoardOps.changeAt === 'function') {
                        BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'DRAGON', 'dragon_convert');
                    } else {
                        gameState.board[r][c] = player;
                    }
                    clearBombAt(r, c);
                    converted.push({ row: r, col: c });
                }
            }
        }

        if (afterDec === 0) {
            destroyed.push({ row, col });
            if (BoardOps && typeof BoardOps.destroyAt === 'function') {
                BoardOps.destroyAt(cardState, gameState, row, col, 'DRAGON', 'anchor_expired');
            } else {
                gameState.board[row][col] = 0;
            }
            if (dragon.data) dragon.data.remainingOwnerTurns = -1;
        }

        // Remove expired anchors if any
        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' ||
                !s.data ||
                s.data.type !== 'DRAGON' ||
                (s.data.remainingOwnerTurns !== undefined && s.data.remainingOwnerTurns !== null && s.data.remainingOwnerTurns >= 0)
            );
        }

        if (converted.length > 0 && cardState.markers) {
            const removeSet = new Set(converted.map(p => `${p.row},${p.col}`));
            cardState.markers = cardState.markers.filter(s =>
                s.kind !== 'specialStone' || !s.data || s.data.type !== 'HYPERACTIVE' || !removeSet.has(`${s.row},${s.col}`)
            );
        }

        return { converted, destroyed, anchors };
    }

    return {
        processDragonEffects,
        processDragonEffectsAtAnchor,
        processDragonEffectsAtTurnStartAnchor
    };
}));
