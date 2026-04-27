(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(
            require('../../shared-constants'),
            require('../../shared/player-encoding'),
            require('../logic/cards-internal/hand-manager'),
            require('../logic/cards-internal/charge-ledger'),
            require('../logic/cards/markers'),
            require('../logic/cards-internal/state-factory')
        );
    } else {
        root.CardStateManager = factory(
            root.SharedConstants,
            root.PlayerEncoding,
            root.CardHandManager,
            root.CardChargeLedger,
            root.CardMarkers,
            root.CardStateFactory
        );
    }
}(typeof self !== 'undefined' ? self : this, function (
    SharedConstants,
    PlayerEncoding,
    CardHandManager,
    CardChargeLedger,
    CardMarkers,
    CardStateFactory
) {
    'use strict';

    const { CHARGE_MAX, CARD_DEFS } = SharedConstants || {};
    const { normalizePlayerKey } = PlayerEncoding || {};

    // ------------------------------------------------------------------
    // 手札管理
    // ------------------------------------------------------------------

    function ensureHands(cardState) {
        return CardHandManager.ensureHands(cardState);
    }

    function getHand(cardState, playerKey) {
        const hands = ensureHands(cardState);
        const key = normalizePlayerKey(playerKey);
        return Array.isArray(hands[key]) ? hands[key] : [];
    }

    function drawCard(cardState, playerKey, prng) {
        const context = buildHandManagerContext();
        return CardHandManager.commitDraw(cardState, playerKey, prng, context);
    }

    function addToHand(cardState, playerKey, cardId, opts) {
        const context = buildHandManagerContext();
        return CardHandManager.addCardToHand(cardState, playerKey, cardId, context, opts);
    }

    function removeFromHand(cardState, playerKey, handIndex) {
        return CardHandManager.removeHandCardAt(cardState, playerKey, handIndex);
    }

    // ------------------------------------------------------------------
    // チャージ管理
    // ------------------------------------------------------------------

    function ensureChargeState(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.charge || typeof cardState.charge !== 'object') {
            cardState.charge = { black: 0, white: 0 };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'black')) cardState.charge.black = 0;
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'white')) cardState.charge.white = 0;
    }

    function getCharge(cardState, playerKey) {
        if (!cardState) return 0;
        ensureChargeState(cardState);
        const key = normalizePlayerKey(playerKey);
        const value = Number(cardState.charge[key]);
        return Number.isFinite(value) ? value : 0;
    }

    function addCharge(cardState, playerKey, amount, reason, meta) {
        const context = buildChargeLedgerContext();
        return CardChargeLedger.addChargeValue(cardState, playerKey, amount, reason, context, meta);
    }

    function consumeCharge(cardState, playerKey, amount, reason, meta) {
        const context = buildChargeLedgerContext();
        return CardChargeLedger.addChargeValue(cardState, playerKey, -amount, reason, context, meta);
    }

    function normalizeCharge(cardState, playerKey, nextValue, reason, meta) {
        const context = buildChargeLedgerContext();
        return CardChargeLedger.setChargeValue(cardState, playerKey, nextValue, reason, context, meta);
    }

    // ------------------------------------------------------------------
    // マーカー管理
    // ------------------------------------------------------------------

    function getMarkers(cardState) {
        return CardMarkers.getMarkers(cardState);
    }

    function addMarker(cardState, kind, row, col, owner, data) {
        return CardMarkers.addMarker(cardState, kind, row, col, owner, data);
    }

    function removeMarker(cardState, markerId) {
        return CardMarkers.removeMarkerById(cardState, markerId);
    }

    function updateMarker(cardState, markerId, updater) {
        if (!cardState || !Array.isArray(cardState.markers)) return false;
        const marker = cardState.markers.find((m) => m && m.id === markerId);
        if (!marker) return false;
        if (typeof updater === 'function') {
            updater(marker);
        } else if (updater && typeof updater === 'object') {
            Object.assign(marker.data || (marker.data = {}), updater);
        }
        return true;
    }

    // ------------------------------------------------------------------
    // デッキ管理
    // ------------------------------------------------------------------

    function getDeck(cardState, playerKey) {
        const decks = CardHandManager.ensureDecks(cardState);
        const key = normalizePlayerKey(playerKey);
        return Array.isArray(decks[key]) ? decks[key] : [];
    }

    function createDefaultDeck(prng) {
        const seen = new Set();
        const deck = [];
        (CARD_DEFS || []).forEach((cardDef) => {
            if (!cardDef || !cardDef.id || cardDef.enabled === false) return;
            if (seen.has(cardDef.id)) return;
            seen.add(cardDef.id);
            deck.push(cardDef.id);
        });
        if (prng && typeof prng.shuffle === 'function') {
            prng.shuffle(deck);
        }
        const DEFAULT_DECK_SIZE = 30;
        return deck.slice(0, DEFAULT_DECK_SIZE);
    }

    function shuffleDeck(deck, prng) {
        if (!Array.isArray(deck)) return [];
        const copy = deck.slice();
        if (prng && typeof prng.shuffle === 'function') {
            prng.shuffle(copy);
        } else if (prng && typeof prng === 'function') {
            // Fisher-Yates fallback when only a random function is provided
            for (let i = copy.length - 1; i > 0; i--) {
                const j = Math.floor(prng() * (i + 1));
                [copy[i], copy[j]] = [copy[j], copy[i]];
            }
        }
        return copy;
    }

    // ------------------------------------------------------------------
    // Context builders (internal)
    // ------------------------------------------------------------------

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

    function buildCardTypeById() {
        const map = {};
        (CARD_DEFS || []).forEach((def) => {
            if (def && def.id && def.type) {
                map[def.id] = def.type;
            }
        });
        return map;
    }

    // ------------------------------------------------------------------
    // Exports
    // ------------------------------------------------------------------

    return {
        // 手札管理
        drawCard,
        addToHand,
        removeFromHand,
        getHand,
        ensureHands,

        // チャージ管理
        addCharge,
        consumeCharge,
        getCharge,
        normalizeCharge,

        // マーカー管理
        addMarker,
        removeMarker,
        getMarkers,
        updateMarker,

        // デッキ管理
        shuffleDeck,
        createDefaultDeck,
        getDeck
    };
}));
