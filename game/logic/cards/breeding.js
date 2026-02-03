/**
 * @file breeding.js
 * @description Breeding effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardBreeding = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};

    if (BLACK === undefined || WHITE === undefined || DIRECTIONS === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing required values');
    }

    function processBreedingEffects(cardState, gameState, playerKey, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        const anchors = [];
        const flippedSet = new Set();

        const specials = (cardState.markers || []).filter(m => m.kind === 'specialStone');
        const breedings = specials.filter(s => s.data && s.data.type === 'BREEDING');
        const getCardContext = deps.getCardContext || (() => ({ protectedStones: specials.filter(s => s.data && s.data.type === 'PROTECTED').map(s => ({ row: s.row, col: s.col })), permaProtectedStones: specials.filter(s => s.data && (s.data.type === 'PERMA_PROTECTED' || s.data.type === 'DRAGON' || s.data.type === 'BREEDING' || s.data.type === 'ULTIMATE_DESTROY_GOD')).map(s => ({ row: s.row, col: s.col, owner: s.owner === 'black' ? BLACK : WHITE })) }));
        const getFlipsWithContext = deps.getFlipsWithContext || ((gs, r, c, playerVal, ctx) => []);
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });

        const context = getCardContext(cardState);

        for (const breeding of breedings) {
            if (breeding.owner !== playerKey) continue;

            // Anchor must still be the owner's stone
            if (gameState.board[breeding.row][breeding.col] !== player) {
                if (breeding.data) breeding.data.remainingOwnerTurns = -1; // Terminate effect
                continue;
            }

            // Turn countdown: decrement first, then fire if >= 0 (0 fires too)
            const before = (breeding.data && (breeding.data.remainingOwnerTurns !== undefined && breeding.data.remainingOwnerTurns !== null))
                ? breeding.data.remainingOwnerTurns
                : 0;
            const afterDec = before - 1;
            if (breeding.data) breeding.data.remainingOwnerTurns = afterDec;
            if (afterDec < 0) continue;
            anchors.push({ row: breeding.row, col: breeding.col, remainingNow: afterDec });

            // Find empty surrounding cells (8 squares)
            const emptyCells = [];
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue; // Skip anchor itself
                    const r = breeding.row + dr;
                    const c = breeding.col + dc;
                    if (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === EMPTY) {
                        emptyCells.push({ row: r, col: c });
                    }
                }
            }

            if (emptyCells.length > 0) {
                const index = Math.floor(p.random() * emptyCells.length);
                const target = emptyCells[index];
                const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);
                let spawnRes = null;
                if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                    spawnRes = deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, 'BREEDING', 'breeding_spawn');
                } else {
                    gameState.board[target.row][target.col] = player;
                }

                spawned.push({ row: target.row, col: target.col, anchorRow: breeding.row, anchorCol: breeding.col, stoneId: spawnRes ? spawnRes.stoneId : undefined });

                for (const [r, c] of flips) {
                    if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                        deps.BoardOps.changeAt(cardState, gameState, r, c, playerKey, 'BREEDING', 'breeding_flip');
                    } else {
                        gameState.board[r][c] = player;
                    }
                    clearBombAt(cardState, r, c);
                    const key = `${r},${c}`;
                    if (!flippedSet.has(key)) {
                        flippedSet.add(key);
                        flipped.push({ row: r, col: c });
                    }
                }
            }

            if (afterDec === 0) {
                destroyed.push({ row: breeding.row, col: breeding.col });
                if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                    deps.BoardOps.destroyAt(cardState, gameState, breeding.row, breeding.col, 'BREEDING', 'anchor_expired');
                } else {
                    gameState.board[breeding.row][breeding.col] = EMPTY;
                }
                if (breeding.data) breeding.data.remainingOwnerTurns = -1;
            }
        }

        // Remove expired breeding anchors
        if (cardState.markers) {
            cardState.markers = cardState.markers.filter(m => {
                if (m.kind !== 'specialStone') return true;
                if (!m.data || m.data.type !== 'BREEDING') return true;
                const turns = m.data.remainingOwnerTurns;
                return (turns !== undefined && turns !== null && turns >= 0);
            });
        }

        if (flipped.length > 0 && typeof deps.clearHyperactiveAtPositions === 'function') {
            deps.clearHyperactiveAtPositions(cardState, flipped);
        }

        return { spawned, destroyed, flipped, anchors };
    }

    function processBreedingEffectsAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        const flippedSet = new Set();

        const anchor = (cardState.markers || []).find(s => s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey && s.row === row && s.col === col);
        if (!anchor) return { spawned, destroyed, flipped };
        if (gameState.board[row][col] !== player) return { spawned, destroyed, flipped };

        const specials2 = (cardState.markers || []).filter(m => m.kind === 'specialStone');
        const getCardContext = deps.getCardContext || (() => ({ protectedStones: specials2.filter(s => s.data && s.data.type === 'PROTECTED').map(s => ({ row: s.row, col: s.col })), permaProtectedStones: specials2.filter(s => s.data && (s.data.type === 'PERMA_PROTECTED' || s.data.type === 'DRAGON' || s.data.type === 'BREEDING' || s.data.type === 'ULTIMATE_DESTROY_GOD')).map(s => ({ row: s.row, col: s.col, owner: s.owner === 'black' ? BLACK : WHITE })) }));
        const getFlipsWithContext = deps.getFlipsWithContext || ((gs, r, c, playerVal, ctx) => []);
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });

        const context = getCardContext(cardState);
        const emptyCells = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === EMPTY) {
                    emptyCells.push({ row: r, col: c });
                }
            }
        }

        if (emptyCells.length > 0) {
            const index = Math.floor(p.random() * emptyCells.length);
            const target = emptyCells[index];
            const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);

            let spawnRes = null;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                spawnRes = deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, 'BREEDING', 'breeding_spawn_immediate');
            } else {
                gameState.board[target.row][target.col] = player;
            }

            spawned.push({ row: target.row, col: target.col, anchorRow: row, anchorCol: col, stoneId: spawnRes ? spawnRes.stoneId : undefined });

            for (const [fr, fc] of flips) {
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    deps.BoardOps.changeAt(cardState, gameState, fr, fc, playerKey, 'BREEDING', 'breeding_flip_immediate');
                } else {
                    gameState.board[fr][fc] = player;
                }
                clearBombAt(cardState, fr, fc);
                const key = `${fr},${fc}`;
                if (!flippedSet.has(key)) {
                    flippedSet.add(key);
                    flipped.push({ row: fr, col: fc });
                }
            }
        }

        if (flipped.length > 0 && typeof deps.clearHyperactiveAtPositions === 'function') {
            deps.clearHyperactiveAtPositions(cardState, flipped);
        }

        return { spawned, destroyed, flipped };
    }

    function processBreedingEffectsAtTurnStartAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const player = playerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const spawned = [];
        const destroyed = [];
        const flipped = [];
        const flippedSet = new Set();
        const anchors = [];

        const anchor = (cardState.markers || []).find(s =>
            s.kind === 'specialStone' && s.data && s.data.type === 'BREEDING' && s.owner === playerKey && s.row === row && s.col === col
        );
        if (!anchor) return { spawned, destroyed, flipped, anchors };
        if (gameState.board[row][col] !== player) {
            if (anchor.data) anchor.data.remainingOwnerTurns = -1;
            return { spawned, destroyed, flipped, anchors };
        }

        // Turn countdown: decrement first, then fire if >= 0 (0 fires too)
        const before = (anchor.data && (anchor.data.remainingOwnerTurns !== undefined && anchor.data.remainingOwnerTurns !== null))
            ? anchor.data.remainingOwnerTurns
            : 0;
        const afterDec = before - 1;
        if (anchor.data) anchor.data.remainingOwnerTurns = afterDec;
        if (afterDec < 0) return { spawned, destroyed, flipped, anchors };
        anchors.push({ row, col, remainingNow: afterDec });

        const specials2 = (cardState.markers || []).filter(m => m.kind === 'specialStone');
        const getCardContext = deps.getCardContext || (() => ({ protectedStones: specials2.filter(s => s.data && s.data.type === 'PROTECTED').map(s => ({ row: s.row, col: s.col })), permaProtectedStones: specials2.filter(s => s.data && (s.data.type === 'PERMA_PROTECTED' || s.data.type === 'DRAGON' || s.data.type === 'BREEDING' || s.data.type === 'ULTIMATE_DESTROY_GOD')).map(s => ({ row: s.row, col: s.col, owner: s.owner === 'black' ? BLACK : WHITE })) }));
        const getFlipsWithContext = deps.getFlipsWithContext || ((gs, r, c, playerVal, ctx) => []);
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });

        const context = getCardContext(cardState);
        const emptyCells = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === EMPTY) {
                    emptyCells.push({ row: r, col: c });
                }
            }
        }

        if (emptyCells.length > 0) {
            const index = Math.floor(p.random() * emptyCells.length);
            const target = emptyCells[index];
            const flips = getFlipsWithContext(gameState, target.row, target.col, player, context);

            let spawnRes = null;
            if (deps.BoardOps && typeof deps.BoardOps.spawnAt === 'function') {
                spawnRes = deps.BoardOps.spawnAt(cardState, gameState, target.row, target.col, playerKey, 'BREEDING', 'breeding_spawned');
            } else {
                gameState.board[target.row][target.col] = player;
            }

            spawned.push({ row: target.row, col: target.col, anchorRow: row, anchorCol: col, stoneId: spawnRes ? spawnRes.stoneId : undefined });

            for (const [fr, fc] of flips) {
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    deps.BoardOps.changeAt(cardState, gameState, fr, fc, playerKey, 'BREEDING', 'breeding_flip');
                } else {
                    gameState.board[fr][fc] = player;
                }
                clearBombAt(cardState, fr, fc);
                const key = `${fr},${fc}`;
                if (!flippedSet.has(key)) {
                    flippedSet.add(key);
                    flipped.push({ row: fr, col: fc });
                }
            }
        }

        if (afterDec === 0) {
            destroyed.push({ row, col });
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                deps.BoardOps.destroyAt(cardState, gameState, row, col, 'BREEDING', 'anchor_expired');
            } else {
                gameState.board[row][col] = EMPTY;
            }
            if (anchor.data) anchor.data.remainingOwnerTurns = -1;
            if (cardState.markers) {
                cardState.markers = cardState.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'BREEDING' && m.row === row && m.col === col && m.owner === playerKey));
            }
        }

        if (flipped.length > 0 && typeof deps.clearHyperactiveAtPositions === 'function') {
            deps.clearHyperactiveAtPositions(cardState, flipped);
        }

        return { spawned, destroyed, flipped, anchors };
    }

    return {
        processBreedingEffects,
        processBreedingEffectsAtAnchor,
        processBreedingEffectsAtTurnStartAnchor
    };
}));
