(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardPendingStateManager = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    const TARGET_SELECTION_PENDING_TYPES = new Set([
        'DESTROY_ONE_STONE',
        'STRONG_WIND_WILL',
        'SUPER_BUOYANCY_WILL',
        'SUPER_GRAVITY_WILL',
        'SELL_CARD_WILL',
        'HEAVEN_BLESSING',
        'CONDEMN_WILL',
        'SWAP_WITH_ENEMY',
        'POSITION_SWAP_WILL',
        'TRAP_WILL',
        'TEMPT_WILL',
        'GUARD_WILL',
        'GUARDIAN_GOD',
        'HYPERACTIVE_INHERIT_WILL',
        'EXTEND_LIFE_WILL',
        'EXTEND_LIFE_GOD',
        'CORROSION_WILL',
        'TIME_BOMB',
        'TELEPORT_WILL',
        'CELL_TELEPORT_WILL',
        'CLONE_WILL',
        'SPLIT_WILL',
        'BOARD_EXPANSION_WILL',
        'BOARD_EXPANSION_GOD',
        'BLOCKADE_WILL',
        'METEOR_WILL',
        'FREEZE_WILL'
    ]);

    const CANCELLABLE_PENDING_TYPES = new Set([
        'DESTROY_ONE_STONE',
        'POSITION_SWAP_WILL',
        'BOARD_EXPANSION_WILL',
        'BOARD_EXPANSION_GOD',
        'BLOCKADE_WILL',
        'METEOR_WILL',
        'FREEZE_WILL'
    ]);

    function normalizeCardType(cardType) {
        return String(cardType || '');
    }

    function getHelpers(context) {
        return (context && context.helpers) || {};
    }

    function ensureChargeState(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.charge || typeof cardState.charge !== 'object') {
            cardState.charge = { black: 0, white: 0 };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'black')) cardState.charge.black = 0;
        if (!Object.prototype.hasOwnProperty.call(cardState.charge, 'white')) cardState.charge.white = 0;
    }

    function addChargeFallback(cardState, playerKey, amount) {
        ensureChargeState(cardState);
        if (!cardState || !cardState.charge) return;
        const before = Number(cardState.charge[playerKey] || 0);
        const safeBefore = Number.isFinite(before) ? before : 0;
        const delta = Number(amount);
        const safeDelta = Number.isFinite(delta) ? delta : 0;
        cardState.charge[playerKey] = safeBefore + safeDelta;
    }

    function ensureUsageFlags(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.hasUsedCardThisTurnByPlayer || typeof cardState.hasUsedCardThisTurnByPlayer !== 'object') {
            cardState.hasUsedCardThisTurnByPlayer = { black: false, white: false };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.hasUsedCardThisTurnByPlayer, 'black')) {
            cardState.hasUsedCardThisTurnByPlayer.black = false;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.hasUsedCardThisTurnByPlayer, 'white')) {
            cardState.hasUsedCardThisTurnByPlayer.white = false;
        }
    }

    function ensureUseCounts(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.cardUseCountByPlayer || typeof cardState.cardUseCountByPlayer !== 'object') {
            cardState.cardUseCountByPlayer = { black: 0, white: 0 };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.cardUseCountByPlayer, 'black')) {
            cardState.cardUseCountByPlayer.black = 0;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.cardUseCountByPlayer, 'white')) {
            cardState.cardUseCountByPlayer.white = 0;
        }
    }

    function ensureHands(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.hands || typeof cardState.hands !== 'object') {
            cardState.hands = { black: [], white: [] };
            return;
        }
        if (!Array.isArray(cardState.hands.black)) cardState.hands.black = [];
        if (!Array.isArray(cardState.hands.white)) cardState.hands.white = [];
    }

    function ensureDiscard(cardState) {
        if (!cardState || typeof cardState !== 'object') return [];
        if (!Array.isArray(cardState.discard)) cardState.discard = [];
        return cardState.discard;
    }

    function requiresTargetSelection(cardType) {
        const normalizedType = normalizeCardType(cardType);
        return !!normalizedType && TARGET_SELECTION_PENDING_TYPES.has(normalizedType);
    }

    function isCancellablePendingType(cardType) {
        const normalizedType = normalizeCardType(cardType);
        return !!normalizedType && CANCELLABLE_PENDING_TYPES.has(normalizedType);
    }

    function createPendingEffectState(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const cardType = normalizeCardType(opts.cardType);
        if (!cardType) return null;

        const needsSelection = (typeof opts.needsSelection === 'boolean')
            ? opts.needsSelection
            : requiresTargetSelection(cardType);

        return {
            type: cardType,
            cardId: opts.cardId,
            stage: needsSelection ? 'selectTarget' : null,
            offers: opts.offers || undefined,
            selectedCount: cardType === 'BOARD_EXPANSION_GOD' ? 0 : undefined,
            maxSelections: cardType === 'BOARD_EXPANSION_GOD' ? 2 : undefined,
            selectedTargets: cardType === 'BOARD_EXPANSION_GOD' ? [] : undefined,
            placementsRemaining: cardType === 'LAST_RESORT' ? 3 : undefined
        };
    }

    function cancelPendingSelection(cardState, playerKey, opts, context) {
        if (!cardState || !cardState.pendingEffectByPlayer) return { canceled: false, reason: 'no_state' };
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.stage !== 'selectTarget') return { canceled: false, reason: 'not_pending' };
        if (!isCancellablePendingType(pending.type)) return { canceled: false, reason: 'not_cancellable' };

        const helpers = getHelpers(context);
        const getCardDef = helpers.getCardDef;
        const addChargeValue = helpers.addChargeValue;
        const moveDiscardCardToHandByCardId = helpers.moveDiscardCardToHandByCardId;
        const cardId = pending.cardId;
        const cardDef = (cardId && typeof getCardDef === 'function') ? getCardDef(cardId) : null;
        const cost = cardDef ? Number(cardDef.cost || 0) : 0;
        const refundCost = !(opts && opts.refundCost === false);
        const resetUsage = !(opts && opts.resetUsage === false);
        const noConsume = !!(opts && opts.noConsume);

        if (refundCost && !noConsume) {
            if (typeof addChargeValue === 'function') {
                addChargeValue(cardState, playerKey, cost, 'card_cancel_refund');
            } else {
                addChargeFallback(cardState, playerKey, cost);
            }
        }

        if (resetUsage && !noConsume) {
            ensureUsageFlags(cardState);
            cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
        }

        if (!noConsume) {
            ensureUseCounts(cardState);
            cardState.cardUseCountByPlayer[playerKey] = Math.max(0, Number(cardState.cardUseCountByPlayer[playerKey] || 0) - 1);
        }

        if (cardId) {
            const handKey = Array.isArray(cardState.hands[playerKey]) ? playerKey : 'black';
            const restored = (typeof moveDiscardCardToHandByCardId === 'function')
                ? moveDiscardCardToHandByCardId(cardState, handKey, cardId, { ignoreHandLimit: true })
                : null;
            if (!restored) {
                ensureHands(cardState);
                const discard = ensureDiscard(cardState);
                if (!cardState.hands[handKey].includes(cardId)) {
                    cardState.hands[handKey].push(cardId);
                }
                const discardIndex = discard.lastIndexOf(cardId);
                if (discardIndex >= 0) {
                    discard.splice(discardIndex, 1);
                }
            }
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { canceled: true, cardId };
    }

    return {
        requiresTargetSelection,
        isCancellablePendingType,
        createPendingEffectState,
        cancelPendingSelection
    };
}));
