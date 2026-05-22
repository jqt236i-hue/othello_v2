declare const CardLogic: { addMarker?: (cardState: DebugCardState, kind: string, row: number, col: number, owner: PlayerKey, data?: Record<string, any>) => any } | undefined;

type PlayerKey = 'black' | 'white';

interface DebugCardDef {
    id?: string;
}

interface DebugSharedConstants {
    CARD_DEFS?: DebugCardDef[];
    BLACK?: number;
    WHITE?: number;
    EMPTY?: number;
}

interface DebugMarkersAdapter {
    MARKER_KINDS?: {
        SPECIAL_STONE?: string;
    };
    ensureMarkers?: (cardState: DebugCardState) => void;
}

interface DebugCardState {
    hands?: Partial<Record<PlayerKey, string[]>>;
    charge?: Partial<Record<PlayerKey, number>>;
    markers?: any[];
    _nextMarkerId?: number;
    _nextCreatedSeq?: number;
    boardBonusByCell?: Record<string, any>;
    boardBonusConsumedByCell?: Record<string, any>;
    turnToPlaceBoardBonus?: any;
    turnToPlaceBoardBonusByPlayer?: Partial<Record<PlayerKey, any>>;
    workAnchorPosByPlayer?: Partial<Record<PlayerKey, { row: number; col: number } | null>>;
    debugHandFilled?: boolean;
    debugNoDraw?: boolean;
}

interface DebugGameState {
    board?: number[][];
}

interface DebugFillOptions {
    playerKey?: string;
    fillWhite?: boolean;
    cardIds?: any;
    replaceExisting?: boolean;
    charge?: any;
    chargeByPlayer?: Partial<Record<PlayerKey, any>>;
}

interface DebugActionsApi {
    fillDebugHand: (cardState: DebugCardState, opts?: DebugFillOptions) => boolean;
    applyVisualTestBoard: (gameState: DebugGameState, cardState: DebugCardState) => boolean;
}

type DebugRoot = {
    DebugActions?: DebugActionsApi;
    SharedConstants?: DebugSharedConstants;
    MarkersAdapter?: DebugMarkersAdapter | null;
};

const DebugActions = /**
 * @file debug-actions.js
 * @description Debug-only helpers to mutate game/card state outside UI code.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        const MarkersAdapter = (() => {
            try {
                return require('../logic/markers_adapter');
            } catch (e) {
                return null;
            }
        })();
        return module.exports = factory(require('../../shared-constants'), MarkersAdapter);
    } else {
        return root.DebugActions = factory(root.SharedConstants || {}, root.MarkersAdapter || null);
    }
}(typeof self !== 'undefined' ? self : globalThis as DebugRoot, function (SharedConstants: DebugSharedConstants, MarkersAdapter: DebugMarkersAdapter | null): DebugActionsApi {
    'use strict';

    const { CARD_DEFS, BLACK, WHITE, EMPTY } = SharedConstants || {};
    const MARKER_KINDS = MarkersAdapter && MarkersAdapter.MARKER_KINDS;

    function addMarker(cardState: DebugCardState, kind: string, row: number, col: number, owner: PlayerKey, data?: Record<string, any>) {
        if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.addMarker === 'function') {
            return CardLogic.addMarker(cardState, kind, row, col, owner, data);
        }
        if (MarkersAdapter && typeof MarkersAdapter.ensureMarkers === 'function') {
            MarkersAdapter.ensureMarkers(cardState);
        }
        if (!Array.isArray(cardState.markers)) cardState.markers = [];
        if (typeof cardState._nextMarkerId !== 'number') cardState._nextMarkerId = 1;
        if (typeof cardState._nextCreatedSeq !== 'number') cardState._nextCreatedSeq = 1;
        const markers = cardState.markers;
        const id = cardState._nextMarkerId;
        const createdSeq = cardState._nextCreatedSeq;
        cardState._nextMarkerId += 1;
        cardState._nextCreatedSeq += 1;
        const marker = {
            id,
            row,
            col,
            kind,
            owner,
            createdSeq,
            data: data || {}
        };
        markers.push(marker);
        return marker;
    }

    function normalizeRequestedDebugHandCardIds(defs: DebugCardDef[], requestedCardIds: any): string[] | null {
        if (!Array.isArray(requestedCardIds)) return null;
        const allowedIds = new Set<string>();
        for (const card of defs) {
            const cardId = card && card.id ? String(card.id) : '';
            if (!cardId) continue;
            allowedIds.add(cardId);
        }
        const normalized: string[] = [];
        const seen = new Set<string>();
        for (const rawCardId of requestedCardIds) {
            const cardId = String(rawCardId || '').trim();
            if (!cardId || seen.has(cardId) || !allowedIds.has(cardId)) continue;
            seen.add(cardId);
            normalized.push(cardId);
        }
        return normalized;
    }

    function normalizeDebugChargeValue(value: any): number | null {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return null;
        return Math.max(0, Math.min(99, Math.trunc(numeric)));
    }

    function resolveDebugFillCharge(opts: DebugFillOptions | undefined, playerKey: PlayerKey): number | null {
        const options = (opts && typeof opts === 'object') ? opts : {};
        const byPlayer = (options.chargeByPlayer && typeof options.chargeByPlayer === 'object')
            ? options.chargeByPlayer
            : null;
        const byPlayerCharge = byPlayer ? normalizeDebugChargeValue(byPlayer[playerKey]) : null;
        if (byPlayerCharge !== null) return byPlayerCharge;
        return normalizeDebugChargeValue(options.charge);
    }

    function fillDebugHand(cardState: DebugCardState, opts?: DebugFillOptions): boolean {
        if (!cardState || !cardState.hands) return false;
        const hands = cardState.hands;
        const defs = CARD_DEFS || null;
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
            : defs.reduce((list: string[], card: DebugCardDef) => {
                const cardId = card && card.id ? String(card.id) : '';
                if (!cardId || list.indexOf(cardId) !== -1) return list;
                list.push(cardId);
                return list;
            }, []);

        if (!cardState.charge || typeof cardState.charge !== 'object') {
            cardState.charge = { black: 0, white: 0 };
        }
        const chargeByPlayer = cardState.charge;
        if (!Object.prototype.hasOwnProperty.call(chargeByPlayer, 'black')) chargeByPlayer.black = 0;
        if (!Object.prototype.hasOwnProperty.call(chargeByPlayer, 'white')) chargeByPlayer.white = 0;

        function applyFillForPlayer(playerKey: PlayerKey) {
            const currentHand = Array.isArray(hands[playerKey]) ? hands[playerKey] : [];
            const nextHand = replaceExisting ? [] : currentHand.slice();
            for (const cardId of cardIds) {
                if (!nextHand.includes(cardId)) {
                    nextHand.push(cardId);
                }
            }
            hands[playerKey] = nextHand;
            const charge = resolveDebugFillCharge(opts, playerKey);
            if (charge !== null) {
                chargeByPlayer[playerKey] = charge;
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

    function applyVisualTestBoard(gameState: DebugGameState, cardState: DebugCardState): boolean {
        if (!gameState || !gameState.board || !cardState) return false;
        const black = (typeof BLACK === 'number') ? BLACK : 1;
        const white = (typeof WHITE === 'number') ? WHITE : -1;
        const empty = (typeof EMPTY === 'number') ? EMPTY : 0;
        const specialStoneKind = (MARKER_KINDS && MARKER_KINDS.SPECIAL_STONE) || 'specialStone';

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
        addMarker(cardState, specialStoneKind, 1, 0, 'black', { type: 'PROTECTED' });
        addMarker(cardState, specialStoneKind, 1, 1, 'white', { type: 'PROTECTED' });
        gameState.board[2][0] = black;
        gameState.board[2][1] = white;
        addMarker(cardState, specialStoneKind, 2, 0, 'black', { type: 'PERMA_PROTECTED' });
        addMarker(cardState, specialStoneKind, 2, 1, 'white', { type: 'PERMA_PROTECTED' });
        gameState.board[3][0] = black;
        gameState.board[3][1] = white;
        addMarker(cardState, specialStoneKind, 3, 0, 'black', { type: 'DRAGON', remainingOwnerTurns: 5 });
        addMarker(cardState, specialStoneKind, 3, 1, 'white', { type: 'DRAGON', remainingOwnerTurns: 5 });
        gameState.board[4][0] = black;
        gameState.board[4][1] = white;
        gameState.board[4][2] = black;
        addMarker(cardState, specialStoneKind, 4, 0, 'black', { type: 'GOLD' });
        addMarker(cardState, specialStoneKind, 4, 1, 'white', { type: 'GOLD' });
        addMarker(cardState, specialStoneKind, 4, 2, 'black', { type: 'WORK', workStage: 2, remainingOwnerTurns: 3 });
        cardState.workAnchorPosByPlayer = {
            black: { row: 4, col: 2 },
            white: null
        };
        gameState.board[5][0] = black;
        gameState.board[5][1] = white;
        addMarker(cardState, specialStoneKind, 5, 0, 'black', { type: 'BREEDING', remainingOwnerTurns: 5 });
        addMarker(cardState, specialStoneKind, 5, 1, 'white', { type: 'BREEDING', remainingOwnerTurns: 5 });
        gameState.board[6][0] = black;
        gameState.board[6][1] = white;
        addMarker(cardState, specialStoneKind, 6, 0, 'black', { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 5 });
        addMarker(cardState, specialStoneKind, 6, 1, 'white', { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 8 });
        gameState.board[7][0] = black;
        gameState.board[7][1] = white;
        addMarker(cardState, specialStoneKind, 7, 0, 'black', { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 });
        addMarker(cardState, specialStoneKind, 7, 1, 'white', { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 });

        return true;
    }

    return {
        fillDebugHand,
        applyVisualTestBoard
    };
}));

export = DebugActions;
