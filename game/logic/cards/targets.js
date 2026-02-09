/**
 * @file targets.js
 * @description Card target selection helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardTargets = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

    if (EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    function getTemptWillTargets(cardState, gameState, playerKey) {
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        const res = [];
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const isGuarded = (r, c) => markers.some(m =>
            m &&
            m.kind === 'specialStone' &&
            m.row === r &&
            m.col === c &&
            m.data &&
            m.data.type === 'GUARD'
        );
        // Prefer CardUtils if available (handles bombs and special stones uniformly)
        const CardUtils = (typeof require === 'function') ? require('./utils') : (typeof globalThis !== 'undefined' ? globalThis.CardUtils : null);
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (isGuarded(r, c)) continue;
                // Must be a special stone or bomb owned by opponent and not an empty cell
                if (CardUtils && typeof CardUtils.isSpecialStoneAt === 'function') {
                    if (!CardUtils.isSpecialStoneAt(cardState, r, c)) continue;
                    if (CardUtils.getSpecialOwnerAt(cardState, r, c) !== opponentKey) continue;
                    if (gameState.board[r][c] === EMPTY) continue;
                    res.push({ row: r, col: c });
                } else {
                    // Fallback: check special markers list
                    const marker = (cardState.markers || []).find(m => m.kind === 'specialStone' && m.row === r && m.col === c);
                    if (!marker) continue;
                    if (marker.owner !== opponentKey) continue;
                    if (gameState.board[r][c] === EMPTY) continue;
                    res.push({ row: r, col: c });
                }
            }
        }
        return res;
    }

    return {
        getTemptWillTargets
    };
}));
