'use strict';

import { CardState } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

function readRuntimeGlobal(globalKey: string): any {
    if (!globalKey) return null;
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
        if (typeof self !== 'undefined' && (self as any)[globalKey]) {
            return (self as any)[globalKey];
        }
    } catch (e) {
        return null;
    }
    return null;
}

function unwrapModule(mod: any): any {
    if (mod && typeof mod === 'object' && Object.prototype.hasOwnProperty.call(mod, 'default')) {
        return mod.default || mod;
    }
    return mod;
}

const CardModuleResolver = safeRequire('../logic/cards-internal/module-resolver');

function loadRuntimeModule(id: string, globalKey: string): any {
    if (CardModuleResolver && typeof CardModuleResolver.resolveModule === 'function') {
        const resolved = CardModuleResolver.resolveModule({
            globalName: globalKey,
            requirePath: id,
            requireFn: _require,
            label: globalKey
        });
        if (resolved) return unwrapModule(resolved);
    }

    return unwrapModule(safeRequire(id)) || unwrapModule(readRuntimeGlobal(globalKey));
}

const SharedConstants = loadRuntimeModule('../../shared-constants', 'SharedConstants');

const DeckSpecHelpers = loadRuntimeModule('../../shared/deck-spec', 'DeckSpecHelpers');

const PlayerEncoding = loadRuntimeModule('../../shared/player-encoding', 'PlayerEncoding');

const CardHandManager = loadRuntimeModule('../logic/cards-internal/hand-manager', 'CardHandManager');

const CardChargeLedger = loadRuntimeModule('../logic/cards-internal/charge-ledger', 'CardChargeLedger');

const CardMarkers = loadRuntimeModule('../logic/cards/markers', 'CardMarkers');

const { CHARGE_MAX, CARD_DEFS } = SharedConstants || {};
const { normalizePlayerKey } = PlayerEncoding || {};

function ensureHands(cardState: CardState) {
    return CardHandManager.ensureHands(cardState);
}

function getHand(cardState: CardState, playerKey: string): string[] {
    const hands = ensureHands(cardState);
    const key = normalizePlayerKey(playerKey);
    return Array.isArray(hands[key]) ? hands[key] : [];
}

function drawCard(cardState: CardState, playerKey: string, prng: any) {
    const context = buildHandManagerContext();
    return CardHandManager.commitDraw(cardState, playerKey, prng, context);
}

function addToHand(cardState: CardState, playerKey: string, cardId: string, opts?: any) {
    const context = buildHandManagerContext();
    return CardHandManager.addCardToHand(cardState, playerKey, cardId, context, opts);
}

function removeFromHand(cardState: CardState, playerKey: string, handIndex: number) {
    return CardHandManager.removeHandCardAt(cardState, playerKey, handIndex);
}

function ensureChargeState(cardState: any) {
    if (!cardState || typeof cardState !== 'object')
        return;
    if (!cardState.charge || typeof cardState.charge !== 'object') {
        cardState.charge = { black: 0, white: 0 };
        return;
    }
    if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'black'))
        cardState.charge.black = 0;
    if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'white'))
        cardState.charge.white = 0;
}

function getCharge(cardState: CardState, playerKey: string): number {
    if (!cardState)
        return 0;
    ensureChargeState(cardState);
    const key = normalizePlayerKey(playerKey);
    const value = Number((cardState as any).charge[key]);
    return Number.isFinite(value) ? value : 0;
}

function addCharge(cardState: CardState, playerKey: string, amount: number, reason: string, meta?: any) {
    const context = buildChargeLedgerContext();
    return CardChargeLedger.addChargeValue(cardState, playerKey, amount, reason, context, meta);
}

function consumeCharge(cardState: CardState, playerKey: string, amount: number, reason: string, meta?: any) {
    const context = buildChargeLedgerContext();
    return CardChargeLedger.addChargeValue(cardState, playerKey, -amount, reason, context, meta);
}

function normalizeCharge(cardState: CardState, playerKey: string, nextValue: number, reason: string, meta?: any) {
    const context = buildChargeLedgerContext();
    return CardChargeLedger.setChargeValue(cardState, playerKey, nextValue, reason, context, meta);
}

function getMarkers(cardState: CardState) {
    return CardMarkers.getMarkers(cardState);
}

function addMarker(cardState: CardState, kind: string, row: number, col: number, owner: string, data: any) {
    return CardMarkers.addMarker(cardState, kind, row, col, owner, data);
}

function removeMarker(cardState: CardState, markerId: number) {
    return CardMarkers.removeMarkerById(cardState, markerId);
}

function updateMarker(cardState: CardState, markerId: number, updater: any) {
    if (!cardState || !Array.isArray(cardState.markers))
        return false;
    const marker = cardState.markers.find((m: any) => m && m.id === markerId);
    if (!marker)
        return false;
    if (typeof updater === 'function') {
        updater(marker);
    }
    else if (updater && typeof updater === 'object') {
        Object.assign(marker.data || (marker.data = {}), updater);
    }
    return true;
}

function getDeck(cardState: CardState, playerKey: string): string[] {
    const decks = CardHandManager.ensureDecks(cardState);
    const key = normalizePlayerKey(playerKey);
    return Array.isArray(decks[key]) ? decks[key] : [];
}

function createDefaultDeck(prng?: any): string[] {
    if (DeckSpecHelpers && typeof DeckSpecHelpers.sampleDefaultDeckCardIds === 'function') {
        return DeckSpecHelpers.sampleDefaultDeckCardIds(prng);
    }
    const seen = new Set<string>();
    const deck: string[] = [];
    (CARD_DEFS || []).forEach((cardDef: any) => {
        if (!cardDef || !cardDef.id || cardDef.enabled === false)
            return;
        if (seen.has(cardDef.id))
            return;
        seen.add(cardDef.id);
        deck.push(cardDef.id);
    });
    if (prng && typeof prng.shuffle === 'function') {
        prng.shuffle(deck);
    }
    const DEFAULT_DECK_SIZE = 30;
    return deck.slice(0, DEFAULT_DECK_SIZE);
}

function shuffleDeck(deck: string[], prng?: any): string[] {
    if (!Array.isArray(deck))
        return [];
    const copy = deck.slice();
    if (prng && typeof prng.shuffle === 'function') {
        prng.shuffle(copy);
    }
    else if (prng && typeof prng === 'function') {
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(prng() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
    }
    return copy;
}

function buildHandManagerContext() {
    return {
        constants: {
            CARD_DEFS: CARD_DEFS || [],
            CARD_TYPE_BY_ID: buildCardTypeById(),
            MAX_HAND_SIZE: 5,
            RIBO_WILL_UNLOCK_TURN_INDEX: 19
        }
    };
}

function buildChargeLedgerContext() {
    return {
        helpers: {
            chargeMax: Number.isFinite(Number(CHARGE_MAX)) ? Number(CHARGE_MAX) : 99
        }
    };
}

function buildCardTypeById(): Record<string, string> {
    const map: Record<string, string> = {};
    (CARD_DEFS || []).forEach((def: any) => {
        if (def && def.id && def.type) {
            map[def.id] = def.type;
        }
    });
    return map;
}

export = {
    drawCard,
    addToHand,
    removeFromHand,
    getHand,
    ensureHands,
    addCharge,
    consumeCharge,
    getCharge,
    normalizeCharge,
    addMarker,
    removeMarker,
    getMarkers,
    updateMarker,
    shuffleDeck,
    createDefaultDeck,
    getDeck
};
