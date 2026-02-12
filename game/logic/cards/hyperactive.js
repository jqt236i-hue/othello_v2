/**
 * @file hyperactive.js
 * @description Hyperactive effect helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardHyperactive = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    function clearUltimateHyperactiveAtPositions(cardState, positions) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        const removeSet = new Set((positions || []).map(p => `${p.row},${p.col}`));
        cardState.markers = cardState.markers.filter(m => {
            if (!m || m.kind !== 'specialStone') return true;
            if (!m.data || m.data.type !== 'ULTIMATE_HYPERACTIVE') return true;
            return !removeSet.has(`${m.row},${m.col}`);
        });
    }

    function getNeighborEmptyCandidates(gameState, row, col) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                if (gameState.board[r][c] === EMPTY) out.push({ row: r, col: c });
            }
        }
        return out;
    }

    function getNeighborEnemyCandidates(gameState, row, col, enemyVal) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr;
                const c = col + dc;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                if (gameState.board[r][c] === enemyVal) out.push({ row: r, col: c });
            }
        }
        return out;
    }

    function destroyUltimateAnchorWithBurst(cardState, gameState, entry, ownerVal, deps, destroyAt) {
        const destroyed = [];
        const enemyVal = -ownerVal;
        const enemyTargets = getNeighborEnemyCandidates(gameState, entry.row, entry.col, enemyVal);
        for (const target of enemyTargets) {
            if (gameState.board[target.row][target.col] !== enemyVal) continue;
            let enemyDestroyed = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(
                    cardState,
                    gameState,
                    target.row,
                    target.col,
                    'ULTIMATE_HYPERACTIVE_GOD',
                    'no_candidates_burst'
                );
                enemyDestroyed = !!(res && res.destroyed);
            } else {
                enemyDestroyed = destroyAt(cardState, gameState, target.row, target.col);
            }
            if (enemyDestroyed) destroyed.push({ row: target.row, col: target.col });
        }

        let anchorDestroyed = false;
        if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
            const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, 'ULTIMATE_HYPERACTIVE_GOD', 'no_candidates');
            anchorDestroyed = !!(res && res.destroyed);
        } else {
            anchorDestroyed = destroyAt(cardState, gameState, entry.row, entry.col);
        }
        if (anchorDestroyed) destroyed.push({ row: entry.row, col: entry.col });
        return destroyed;
    }

    function moveHyperactiveOnce(cardState, gameState, entry, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            if (gs.board[r][c] === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            gs.board[r][c] = EMPTY;
            return true;
        });
        const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
        const clearHyperactiveAtPositions = deps.clearHyperactiveAtPositions || ((cs, positions) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'specialStone' && m.data && m.data.type === 'HYPERACTIVE' && positions.some(p => p.row === m.row && p.col === m.col))); });
        const clearBombAt = deps.clearBombAt || ((cs, r, c) => { if (cs.markers) cs.markers = cs.markers.filter(m => !(m.kind === 'bomb' && m.row === r && m.col === c)); });

        const moved = [];
        const destroyed = [];
        const flipped = [];

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);

        // Anchor must still be owner's stone
        if (gameState.board[entry.row][entry.col] !== ownerVal) {
            // remove the anchor
            clearHyperactiveAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, flipped, ownerKey };
        }

        const candidates = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = entry.row + dr;
                const c = entry.col + dc;
                if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
                if (gameState.board[r][c] === EMPTY) {
                    candidates.push({ row: r, col: c });
                }
            }
        }
        if (typeof console !== 'undefined' && console.log) console.log('[HYPERACTIVE] moveHyperactiveOnce candidates', candidates.length, 'at', { row: entry.row, col: entry.col, owner: entry.owner });

        if (candidates.length === 0) {
            let destroyedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.destroyAt === 'function') {
                const res = deps.BoardOps.destroyAt(cardState, gameState, entry.row, entry.col, 'HYPERACTIVE', 'no_candidates');
                destroyedRes = !!res.destroyed;
            } else {
                destroyedRes = destroyAt(cardState, gameState, entry.row, entry.col);
            }
            if (destroyedRes) {
                destroyed.push({ row: entry.row, col: entry.col });
            }
            return { moved, destroyed, flipped, ownerKey };
        }

        const index = Math.floor(p.random() * candidates.length);
        const target = candidates[index];
        if (typeof console !== 'undefined' && console.log) console.log('[HYPERACTIVE] selected target', { index, target, candidatesLen: candidates.length });

        // Compute flips as if placing on the target cell.
        const flipCells = getFlipsWithContext(gameState, target.row, target.col, ownerVal, deps.getCardContext ? deps.getCardContext(cardState) : {});

        if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
            deps.BoardOps.moveAt(cardState, gameState, entry.row, entry.col, target.row, target.col, 'HYPERACTIVE', 'hyperactive_move');
        } else {
            gameState.board[entry.row][entry.col] = EMPTY;
            gameState.board[target.row][target.col] = ownerVal;
        }
        moved.push({ from: { row: entry.row, col: entry.col }, to: { row: target.row, col: target.col } });

        entry.row = target.row;
        entry.col = target.col;

        if (flipCells.length > 0) {
            const flipPositions = flipCells.map(([r, c]) => ({ row: r, col: c }));
            for (const [r, c] of flipCells) {
                if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                    deps.BoardOps.changeAt(cardState, gameState, r, c, ownerKey, 'HYPERACTIVE', 'hyperactive_flip');
                } else {
                    gameState.board[r][c] = ownerVal;
                }
            }
            // If a hyperactive stone flips/gets converted, it loses hyperactive status.
            clearHyperactiveAtPositions(cardState, flipPositions);
            flipped.push(...flipPositions);
        }

        return { moved, destroyed, flipped, ownerKey };
    }

    function processHyperactiveMoves(cardState, gameState, prng, deps = {}) {
        const moved = [];
        const destroyed = [];
        const flipped = [];
        const flippedByOwner = { black: [], white: [] };

        const entries = (cardState.markers || [])
            .filter(s => s.kind === 'specialStone' && s.data && s.data.type === 'HYPERACTIVE')
            .slice()
            .sort((a, b) => (a.createdSeq || 0) - (b.createdSeq || 0));

        for (const entry of entries) {
            if (!(cardState.markers || []).includes(entry)) continue;
            const res = moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
            moved.push(...res.moved);
            destroyed.push(...res.destroyed);
            flipped.push(...res.flipped);
            if (res.flipped.length > 0 && res.ownerKey && flippedByOwner[res.ownerKey]) {
                flippedByOwner[res.ownerKey].push(...res.flipped);
            }
        }

        return { moved, destroyed, flipped, flippedByOwner };
    }

    function processHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const entry = (cardState.markers || []).find(s => s.kind === 'specialStone' && s.data && s.data.type === 'HYPERACTIVE' && s.owner === playerKey && s.row === row && s.col === col);
        if (!entry) return { moved: [], destroyed: [], flipped: [] };
        return moveHyperactiveOnce(cardState, gameState, entry, prng, deps);
    }

    function processUltimateHyperactiveMoveAtAnchor(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const p = prng || (deps.defaultPrng || { random: () => 0 });
        const entry = (cardState.markers || []).find(s =>
            s &&
            s.kind === 'specialStone' &&
            s.data &&
            s.data.type === 'ULTIMATE_HYPERACTIVE' &&
            s.owner === playerKey &&
            s.row === row &&
            s.col === col
        );
        if (!entry) {
            return { moved: [], destroyed: [], flipped: [], ownerKey: playerKey };
        }

        const ownerKey = entry.owner;
        const ownerVal = ownerKey === 'black' ? (BLACK || 1) : (WHITE || -1);
        const clearUltimateAtPositions = deps.clearUltimateAtPositions || clearUltimateHyperactiveAtPositions;
        const getFlipsWithContext = deps.getFlipsWithContext || (() => []);
        const destroyAt = deps.destroyAt || ((cs, gs, r, c) => {
            if (gs.board[r][c] === EMPTY) return false;
            if (cs.markers) cs.markers = cs.markers.filter(m => !(m.row === r && m.col === c));
            gs.board[r][c] = EMPTY;
            return true;
        });

        const moved = [];
        const destroyed = [];
        const flipped = [];

        // Anchor is removed if the board owner no longer matches marker owner.
        if (gameState.board[entry.row][entry.col] !== ownerVal) {
            clearUltimateAtPositions(cardState, [{ row: entry.row, col: entry.col }]);
            return { moved, destroyed, flipped, ownerKey };
        }

        for (let step = 1; step <= 2; step++) {
            const candidates = getNeighborEmptyCandidates(gameState, entry.row, entry.col);
            if (!candidates.length) {
                destroyed.push(...destroyUltimateAnchorWithBurst(cardState, gameState, entry, ownerVal, deps, destroyAt));
                break;
            }

            const target = candidates[Math.floor(p.random() * candidates.length)];
            const from = { row: entry.row, col: entry.col };
            const flipCells = getFlipsWithContext(
                gameState,
                target.row,
                target.col,
                ownerVal,
                deps.getCardContext ? deps.getCardContext(cardState) : {}
            );
            let movedRes = false;
            if (deps.BoardOps && typeof deps.BoardOps.moveAt === 'function') {
                const res = deps.BoardOps.moveAt(
                    cardState,
                    gameState,
                    entry.row,
                    entry.col,
                    target.row,
                    target.col,
                    'ULTIMATE_HYPERACTIVE_GOD',
                    'ultimate_hyperactive_step_move',
                    { step }
                );
                movedRes = !!(res && res.moved);
            } else {
                gameState.board[entry.row][entry.col] = EMPTY;
                gameState.board[target.row][target.col] = ownerVal;
                movedRes = true;
            }

            if (!movedRes) break;
            entry.row = target.row;
            entry.col = target.col;
            moved.push({ from, to: { row: target.row, col: target.col }, step });

            if (flipCells.length > 0) {
                const flipPositions = flipCells.map(([r, c]) => ({ row: r, col: c }));
                for (const [r, c] of flipCells) {
                    if (deps.BoardOps && typeof deps.BoardOps.changeAt === 'function') {
                        deps.BoardOps.changeAt(cardState, gameState, r, c, ownerKey, 'ULTIMATE_HYPERACTIVE_GOD', 'ultimate_hyperactive_flip');
                    } else {
                        gameState.board[r][c] = ownerVal;
                    }
                }
                // Flipped hyperactive/ultimate stones lose their special status.
                if (deps.clearHyperactiveAtPositions) {
                    deps.clearHyperactiveAtPositions(cardState, flipPositions);
                }
                flipped.push(...flipPositions);
            }
        }

        return { moved, destroyed, flipped, ownerKey };
    }

    return {
        moveHyperactiveOnce,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor,
        processUltimateHyperactiveMoveAtAnchor
    };
}));
