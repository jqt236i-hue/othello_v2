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

    return {
        moveHyperactiveOnce,
        processHyperactiveMoves,
        processHyperactiveMoveAtAnchor
    };
}));
