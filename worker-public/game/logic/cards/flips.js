/**
 * @file flips.js
 * @description Flip calculation helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardFlips = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, DIRECTIONS, EMPTY } = SharedConstants || {};

    if (DIRECTIONS === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants missing DIRECTIONS/EMPTY');
    }

    function getDirectionalChainFlips(gameState, row, col, ownerVal, dir, context) {
        const protectedStones = context.protectedStones || [];
        const permaProtectedStones = context.permaProtectedStones || [];

        const protectedSet = protectedStones.length
            ? new Set(protectedStones.map(p => `${p.row},${p.col}`))
            : null;
        const permaSet = permaProtectedStones.length
            ? new Set(permaProtectedStones.map(p => `${p.row},${p.col}`))
            : null;

        const [dr, dc] = dir;
        const flips = [];
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < 8 && c >= 0 && c < 8 && gameState.board[r][c] === -ownerVal) {
            const key = `${r},${c}`;
            if ((protectedSet && protectedSet.has(key)) ||
                (permaSet && permaSet.has(key))) {
                flips.length = 0;
                break;
            }
            flips.push({ row: r, col: c });
            r += dr;
            c += dc;
        }

        if (flips.length === 0) return [];
        if (r < 0 || r >= 8 || c < 0 || c >= 8) return [];
        if (gameState.board[r][c] !== ownerVal) return [];
        return flips;
    }

    function getFlipsWithContext(state, row, col, player, context = {}) {
        if (state.board[row][col] !== EMPTY) return [];

        const allFlips = [];
        for (const dir of (DIRECTIONS || [])) {
            const flips = getDirectionalChainFlips(state, row, col, player, dir, context);
            if (flips && flips.length) {
                // convert {row,col} objects to [r,c] tuples to match legacy callers
                for (const f of flips) allFlips.push([f.row, f.col]);
            }
        }
        return allFlips;
    }

    return {
        getDirectionalChainFlips,
        getFlipsWithContext
    };
}));