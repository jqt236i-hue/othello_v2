// @ts-nocheck
const DebugActions = /**
 * @file debug-actions.js
 * @description Debug-only helpers to mutate game/card state outside UI code.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        return module.exports = factory(require('../../shared-constants'));
    } else {
        return root.DebugActions = factory(root.SharedConstants || {});
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

    function normalizeRequestedDebugHandCardIds(defs, requestedCardIds) {
        if (!Array.isArray(requestedCardIds)) return null;
        const allowedIds = new Set();
        for (const card of defs) {
            const cardId = card && card.id ? String(card.id) : '';
            if (!cardId) continue;
            allowedIds.add(cardId);
        }
        const normalized = [];
        const seen = new Set();
        for (const rawCardId of requestedCardIds) {
            const cardId = String(rawCardId || '').trim();
            if (!cardId || seen.has(cardId) || !allowedIds.has(cardId)) continue;
            seen.add(cardId);
            normalized.push(cardId);
        }
        return normalized;
    }

    function normalizeDebugChargeValue(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        return Math.max(0, Math.min(99, Math.trunc(numeric)));
    }

    function resolveDebugFillCharge(opts, playerKey) {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const byPlayer = (options.chargeByPlayer && typeof options.chargeByPlayer === 'object')
            ? options.chargeByPlayer
            : null;
        const byPlayerCharge = byPlayer ? normalizeDebugChargeValue(byPlayer[playerKey]) : null;
        if (byPlayerCharge !== null) return byPlayerCharge;
        return normalizeDebugChargeValue(options.charge);
    }

    function fillDebugHand(cardState, opts) {
        if (!cardState || !cardState.hands) return false;
        const defs = CARD_DEFS || (typeof globalThis !== 'undefined' ? globalThis.CARD_DEFS : null);
        if (!defs || !defs.length) return false;

        const requestedPlayerKey = opts && typeof opts.playerKey === 'string'
            ? String(opts.playerKey).trim().toLowerCase()
            : '';
        const fillBlack = requestedPlayerKey === 'white' ? false : true;
        const shouldFillWhite = requestedPlayerKey === 'white'
            ? true
            : !!(opts && opts.fillWhite);
        const requestedCardIds = normalizeRequestedDebugHandCardIds(defs, opts && opts.cardIds);
        if (Array.isArray(opts && opts.cardIds) && (!requestedCardIds || requestedCardIds.length <= 0)) {
            return false;
        }
        const replaceExisting = !!(opts && opts.replaceExisting);
        const cardIds = Array.isArray(requestedCardIds) && requestedCardIds.length > 0
            ? requestedCardIds
            : defs.reduce((list, card) => {
                const cardId = card && card.id ? String(card.id) : '';
                if (!cardId || list.indexOf(cardId) !== -1) return list;
                list.push(cardId);
                return list;
            }, []);

        if (!cardState.charge || typeof cardState.charge !== 'object') {
            cardState.charge = { black: 0, white: 0 };
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'black')) cardState.charge.black = 0;
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'white')) cardState.charge.white = 0;

        function applyFillForPlayer(playerKey) {
            const currentHand = Array.isArray(cardState.hands[playerKey]) ? cardState.hands[playerKey] : [];
            const nextHand = replaceExisting ? [] : currentHand.slice();
            for (const cardId of cardIds) {
                if (!nextHand.includes(cardId)) {
                    nextHand.push(cardId);
                }
            }
            cardState.hands[playerKey] = nextHand;
            const charge = resolveDebugFillCharge(opts, playerKey);
            if (charge !== null) {
                cardState.charge[playerKey] = charge;
            }
        }

        if (fillBlack) {
            applyFillForPlayer('black');
        }
        if (shouldFillWhite) {
            applyFillForPlayer('white');
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
        cardState.boardBonusByCell = {};
        cardState.boardBonusConsumedByCell = {};
        cardState.turnToPlaceBoardBonus = null;
        cardState.turnToPlaceBoardBonusByPlayer = { black: null, white: null };

        gameState.board[0][0] = black;
        gameState.board[0][1] = white;
        gameState.board[1][0] = black;
        gameState.board[1][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 1, 0, 'black', { type: 'PROTECTED' });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 1, 1, 'white', { type: 'PROTECTED' });
        gameState.board[2][0] = black;
        gameState.board[2][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 2, 0, 'black', { type: 'PERMA_PROTECTED' });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 2, 1, 'white', { type: 'PERMA_PROTECTED' });
        gameState.board[3][0] = black;
        gameState.board[3][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 3, 0, 'black', { type: 'DRAGON', remainingOwnerTurns: 5 });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 3, 1, 'white', { type: 'DRAGON', remainingOwnerTurns: 5 });
        gameState.board[4][0] = black;
        gameState.board[4][1] = white;
        gameState.board[4][2] = black;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 4, 0, 'black', { type: 'GOLD' });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 4, 1, 'white', { type: 'GOLD' });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 4, 2, 'black', { type: 'WORK', workStage: 2, remainingOwnerTurns: 3 });
        cardState.workAnchorPosByPlayer = {
            black: { row: 4, col: 2 },
            white: null
        };
        gameState.board[5][0] = black;
        gameState.board[5][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 5, 0, 'black', { type: 'BREEDING', remainingOwnerTurns: 5 });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 5, 1, 'white', { type: 'BREEDING', remainingOwnerTurns: 5 });
        gameState.board[6][0] = black;
        gameState.board[6][1] = white;
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 6, 0, 'black', { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 5 });
        addMarker(cardState, MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone', 6, 1, 'white', { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 8 });
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

export = DebugActions;
