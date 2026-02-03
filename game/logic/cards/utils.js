/**
 * @file utils.js
 * @description Card utility helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardUtils = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { BLACK, WHITE, EMPTY } = SharedConstants || {};
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../markers_adapter');
            } catch (e) {
                return null;
            }
        }
        const globalScope = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {}));
        return globalScope.MarkersAdapter || null;
    })();
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;

    if (BLACK === undefined || WHITE === undefined || EMPTY === undefined) {
        throw new Error('SharedConstants not loaded');
    }

    function getSpecialMarkerAt(cardState, row, col) {
        const markers = (cardState && cardState.markers) ? cardState.markers : [];
        const special = markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone') && m.row === row && m.col === col);
        if (special) return { kind: 'specialStone', marker: special };
        const bomb = markers.find(m => m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb') && m.row === row && m.col === col);
        if (bomb) return { kind: 'bomb', marker: bomb };
        return null;
    }

    function isSpecialStoneAt(cardState, row, col) {
        return !!getSpecialMarkerAt(cardState, row, col);
    }

    function getSpecialOwnerAt(cardState, row, col) {
        const entry = getSpecialMarkerAt(cardState, row, col);
        if (!entry) return null;
        return entry.marker && entry.marker.owner ? entry.marker.owner : null;
    }

    function isNormalStoneForPlayer(cardState, gameState, playerKey, row, col) {
        const playerVal = playerKey === 'black' ? BLACK : WHITE;

        if (gameState.board[row][col] !== playerVal) return false;

        const markers = (cardState && cardState.markers) ? cardState.markers : [];
        if (markers.some(m => m.row === row && m.col === col && m.kind === (MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone'))) return false;
        if (markers.some(m => m.row === row && m.col === col && m.kind === (MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb'))) return false;

        return true;
    }

    return {
        getSpecialMarkerAt,
        isSpecialStoneAt,
        getSpecialOwnerAt,
        isNormalStoneForPlayer
    };
}));
