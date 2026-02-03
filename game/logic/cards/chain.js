/**
 * @file chain.js
 * @description Chain-Will selection helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'), require('./flips'));
    } else {
        root.CardChain = factory(root.SharedConstants, root.CardFlips);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardFlips) {
    'use strict';

    const { DIRECTIONS } = SharedConstants || {};

    if (!DIRECTIONS) throw new Error('SharedConstants.DIRECTIONS required');

    function normalizePoint(p) {
        if (Array.isArray(p)) return { row: p[0], col: p[1] };
        return { row: p.row, col: p.col };
    }

    /**
     * Find the best chain candidate (deterministic via injected PRNG)
     * @param {Object} gameState
     * @param {Array} primaryFlips - array of {row,col} or [r,c]
     * @param {number} ownerVal - 1 or -1
     * @param {Object} context - flip context (protected/perma sets)
     * @param {Object} [prng]
     * @returns {{applied:boolean, flips:Array<{row,col}>, chosen:Object|null}}
     */
    function findChainChoice(gameState, primaryFlips, ownerVal, context = {}, prng) {
        const p = prng || { random: () => 0 };

        const candidatePoints = [];
        const seen = new Set();
        for (const f of (primaryFlips || [])) {
            const pt = normalizePoint(f);
            const key = `${pt.row},${pt.col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (gameState.board[pt.row][pt.col] === ownerVal) {
                candidatePoints.push({ row: pt.row, col: pt.col });
            }
        }

        if (candidatePoints.length === 0) {
            return { applied: false, flips: [], chosen: null };
        }

        const candidates = [];
        for (const point of candidatePoints) {
            for (const dir of (DIRECTIONS || [])) {
                const flips = (CardFlips && typeof CardFlips.getDirectionalChainFlips === 'function')
                    ? CardFlips.getDirectionalChainFlips(gameState, point.row, point.col, ownerVal, dir, context)
                    : [];
                if (flips && flips.length > 0) {
                    candidates.push({ from: { row: point.row, col: point.col }, dir, score: flips.length, flips });
                }
            }
        }

        if (candidates.length === 0) {
            return { applied: false, flips: [], chosen: null };
        }

        let maxScore = 0;
        for (const c of candidates) if (c.score > maxScore) maxScore = c.score;

        const top = candidates.filter(c => c.score === maxScore);
        const pickedIndex = Math.floor(p.random() * top.length);
        const chosen = top[pickedIndex];

        return { applied: true, flips: chosen.flips, chosen };
    }

    return {
        findChainChoice
    };
}));