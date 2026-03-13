/**
 * @file debug-actions.js
 * @description Debug-only helpers to mutate game/card state outside UI code.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../shared-constants'));
    } else {
        root.DebugActions = factory(root.SharedConstants || {});
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const { CARD_DEFS, BLACK, WHITE, EMPTY } = SharedConstants || {};
    const MarkersAdapter = (() => {
        if (typeof require === 'function') {
            try {
                return require('../logic/markers_adapter');
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

    function addMarker(cardState, kind, row, col, owner, data) {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.addMarker === 'function') {
            return CardLogic.addMarker(cardState, kind, row, col, owner, data);
        }
        if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
            MarkersAdapter.ensureMarkers(cardState);
        } else {
            if (!Array.isArray(cardState.markers)) cardState.markers = [];
            if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
            if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
        }
        const id = cardState._nextMarkerId++;
        const createdSeq = cardState._nextCreatedSeq++;
        const marker = {
            id,
            row,
            col,
            kind,
            owner,
            createdSeq,
            data: data || {}
        };
        cardState.markers.push(marker);
        return marker;
    }

    function fillDebugHand(cardState, opts) {
        if (!cardState || !cardState.hands) return false;
        const defs = CARD_DEFS || (typeof globalThis !== 'undefined' ? globalThis.CARD_DEFS : null);
        if (!defs || !defs.length) return false;

        const shouldFillWhite = !!(opts && opts.fillWhite);
        const typeMap = {};
        for (const card of defs) {
            if (!typeMap[card.type]) {
                typeMap[card.type] = card.id;
            }
        }
        for (const cardId of Object.values(typeMap)) {
            if (!cardState.hands.black.includes(cardId)) {
                cardState.hands.black.push(cardId);
            }
            if (shouldFillWhite && cardState.hands.white && !cardState.hands.white.includes(cardId)) {
                cardState.hands.white.push(cardId);
            }
        }
        cardState.debugHandFilled = true;
        cardState.debugNoDraw = true;
        return true;
    }

    function applyVisualTestBoard(gameState, cardState) {
        if (!gameState || !gameState.board || !cardState) return false;
        const black = (typeof BLACK === 'number') ? BLACK : 1;
        const white = (typeof WHITE === 'number') ? WHITE : -1;
        const empty = (typeof EMPTY === 'number') ? EMPTY : 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                gameState.board[r][c] = empty;
            }
        }
        if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
            MarkersAdapter.ensureMarkers(cardState);
        } else if (!Array.isArray(cardState.markers)) {
            cardState.markers = [];
        }
        cardState.markers = [];

        // Row 0: Normal stones
        gameState.board[0][0] = black;
        gameState.board[0][1] = white;

        // Row 1: Temporary protected (gray)
        gameState.board[1][0] = black;
        gameState.board[1][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 1, 0, 'black', { type: 'PROTECTED' });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 1, 1, 'white', { type: 'PROTECTED' });

        // Row 2: Perma protected
        gameState.board[2][0] = black;
        gameState.board[2][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 2, 0, 'black', { type: 'PERMA_PROTECTED' });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 2, 1, 'white', { type: 'PERMA_PROTECTED' });

        // Row 3: Ultimate dragons
        gameState.board[3][0] = black;
        gameState.board[3][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 3, 0, 'black', { type: 'DRAGON', remainingOwnerTurns: 5 });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 3, 1, 'white', { type: 'DRAGON', remainingOwnerTurns: 5 });

        // Row 4: Gold stone
        gameState.board[4][0] = black;
        gameState.board[4][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 4, 0, 'black', { type: 'GOLD' });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 4, 1, 'white', { type: 'GOLD' });

        // Row 5: Breeding stone
        gameState.board[5][0] = black;
        gameState.board[5][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 5, 0, 'black', { type: 'BREEDING', remainingOwnerTurns: 3 });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 5, 1, 'white', { type: 'BREEDING', remainingOwnerTurns: 3 });

        // Row 6: Time bomb
        gameState.board[6][0] = black;
        gameState.board[6][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb', 6, 0, 'black', { remainingTurns: 5 });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.BOMB : 'bomb', 6, 1, 'white', { remainingTurns: 8 });

        // Row 7: Ultimate destroy god
        gameState.board[7][0] = black;
        gameState.board[7][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 7, 0, 'black', { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 7, 1, 'white', { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 });

        return true;
    }

    return {
        fillDebugHand,
        applyVisualTestBoard
    };
}));
