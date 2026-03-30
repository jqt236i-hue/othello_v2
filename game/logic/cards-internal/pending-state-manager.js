(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardPendingStateManager = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    const PENDING_SELECTION_CONTRACTS = Object.freeze({
        DESTROY_ONE_STONE: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        STRONG_WIND_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SUPER_BUOYANCY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SUPER_GRAVITY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CELL_TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TEMPT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CAPTURE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TRAP_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        GUARD_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        GUARDIAN_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        HYPERACTIVE_INHERIT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        EXTEND_LIFE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        EXTEND_LIFE_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CORROSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CLONE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SPLIT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        BLOCKADE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        BOARD_EXPANSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        BOARD_EXPANSION_GOD: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        FREEZE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        POSITION_SWAP_WILL: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        METEOR_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        TIME_BOMB: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SWAP_WITH_ENEMY: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        SELL_CARD_WILL: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        HEAVEN_BLESSING: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true },
        CONDEMN_WILL: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true }
    });

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
        'CAPTURE_WILL',
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

    const PENDING_SELECTION_DISPATCH_KEYS = Object.freeze({
        DESTROY_ONE_STONE: 'destroy',
        STRONG_WIND_WILL: 'strong_wind',
        SUPER_BUOYANCY_WILL: 'super_buoyancy',
        SUPER_GRAVITY_WILL: 'super_gravity',
        TELEPORT_WILL: 'teleport',
        CELL_TELEPORT_WILL: 'cell_teleport',
        TEMPT_WILL: 'tempt',
        CAPTURE_WILL: 'capture',
        TRAP_WILL: 'trap',
        GUARD_WILL: 'guard',
        GUARDIAN_GOD: 'guard',
        HYPERACTIVE_INHERIT_WILL: 'hyperactive_inherit',
        EXTEND_LIFE_WILL: 'extend_life',
        EXTEND_LIFE_GOD: 'extend_life',
        CORROSION_WILL: 'corrosion',
        TIME_BOMB: 'time_bomb',
        SWAP_WITH_ENEMY: 'swap_with_enemy',
        POSITION_SWAP_WILL: 'position_swap',
        BOARD_EXPANSION_WILL: 'board_expansion',
        BOARD_EXPANSION_GOD: 'board_expansion',
        BLOCKADE_WILL: 'blockade',
        METEOR_WILL: 'meteor',
        FREEZE_WILL: 'freeze',
        CLONE_WILL: 'clone',
        SPLIT_WILL: 'split',
        SELL_CARD_WILL: 'sell_card',
        HEAVEN_BLESSING: 'heaven_blessing',
        CONDEMN_WILL: 'condemn'
    });

    function normalizeCardType(cardType) {
        return String(cardType || '');
    }

    function normalizePendingType(cardType) {
        return String(cardType || '').trim().toUpperCase();
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

    function resolvePendingSelectionContract(cardType) {
        const normalizedType = normalizePendingType(cardType);
        return normalizedType && PENDING_SELECTION_CONTRACTS[normalizedType]
            ? PENDING_SELECTION_CONTRACTS[normalizedType]
            : null;
    }

    function isSelectionOnlyEndTurnPendingType(cardType) {
        const contract = resolvePendingSelectionContract(cardType);
        return !!(contract && contract.turnOutcome === 'end_turn');
    }

    function shouldDeferNetworkPublishForPendingType(cardType) {
        const contract = resolvePendingSelectionContract(cardType);
        return !!(contract && contract.deferNetworkPublish === true);
    }

    function shouldWaitForPlaybackIdleForPendingType(cardType) {
        const contract = resolvePendingSelectionContract(cardType);
        return !!(contract && contract.waitForPlaybackIdle === true);
    }

    function resolvePendingSelectionDispatchKey(cardType) {
        const normalizedType = normalizePendingType(cardType);
        return normalizedType && PENDING_SELECTION_DISPATCH_KEYS[normalizedType]
            ? PENDING_SELECTION_DISPATCH_KEYS[normalizedType]
            : null;
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
            sourceHandIndex: Number.isInteger(opts.sourceHandIndex) ? opts.sourceHandIndex : undefined,
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
        PENDING_SELECTION_CONTRACTS,
        requiresTargetSelection,
        isCancellablePendingType,
        resolvePendingSelectionContract,
        isSelectionOnlyEndTurnPendingType,
        shouldDeferNetworkPublishForPendingType,
        shouldWaitForPlaybackIdleForPendingType,
        resolvePendingSelectionDispatchKey,
        createPendingEffectState,
        cancelPendingSelection
    };
}));
