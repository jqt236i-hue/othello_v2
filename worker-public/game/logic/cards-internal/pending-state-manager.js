(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardPendingStateManager = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    const PENDING_SELECTION_CONTRACT_DEFINITIONS = Object.freeze({
        DESTROY_ONE_STONE: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'destroy' },
        STRONG_WIND_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'strong_wind' },
        SUPER_BUOYANCY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'super_buoyancy' },
        SUPER_GRAVITY_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'super_gravity' },
        TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'teleport' },
        CELL_TELEPORT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'cell_teleport' },
        TEMPT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'tempt' },
        CAPTURE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'capture' },
        TRAP_WILL: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'trap' },
        GUARD_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'guard' },
        GUARDIAN_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'guard' },
        LIVING_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'living_will' },
        HYPERACTIVE_INHERIT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'hyperactive_inherit' },
        EXTEND_LIFE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'extend_life' },
        EXTEND_LIFE_GOD: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'extend_life' },
        CORROSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'corrosion' },
        CLONE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'clone' },
        SPLIT_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'split' },
        BLOCKADE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'blockade' },
        BOARD_EXPANSION_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_expansion' },
        BOARD_EXPANSION_GOD: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_expansion' },
        BOARD_SHRINK_WILL: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_shrink' },
        BOARD_SHRINK_GOD: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'board_shrink' },
        FREEZE_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'freeze' },
        SEED_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'seed' },
        POSITION_SWAP_WILL: { kind: 'multi_stage', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'position_swap' },
        METEOR_WILL: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, cancellable: true, dispatchKey: 'meteor' },
        TIME_BOMB: { kind: 'continue_turn', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'time_bomb' },
        SWAP_WITH_ENEMY: { kind: 'end_turn', turnOutcome: 'end_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'swap_with_enemy' },
        HEAVEN_BLESSING: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'heaven_blessing' },
        SELL_CARD_WILL: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'sell_card' },
        CONDEMN_WILL: { kind: 'hand_overlay', turnOutcome: 'continue_turn', deferNetworkPublish: true, waitForPlaybackIdle: true, needsTargetSelection: true, dispatchKey: 'condemn' }
    });

    function buildPendingSelectionContracts(definitions) {
        const contracts = {};
        Object.keys(definitions).forEach((cardType) => {
            const definition = definitions[cardType] || {};
            contracts[cardType] = Object.freeze({
                kind: definition.kind,
                turnOutcome: definition.turnOutcome,
                deferNetworkPublish: definition.deferNetworkPublish === true,
                waitForPlaybackIdle: definition.waitForPlaybackIdle === true
            });
        });
        return Object.freeze(contracts);
    }

    function buildPendingSelectionTypeSet(definitions, fieldName) {
        const types = [];
        Object.keys(definitions).forEach((cardType) => {
            if (definitions[cardType] && definitions[cardType][fieldName] === true) {
                types.push(cardType);
            }
        });
        return new Set(types);
    }

    function buildPendingSelectionDispatchKeys(definitions) {
        const dispatchKeys = {};
        Object.keys(definitions).forEach((cardType) => {
            const dispatchKey = definitions[cardType] && definitions[cardType].dispatchKey;
            if (typeof dispatchKey === 'string' && dispatchKey) {
                dispatchKeys[cardType] = dispatchKey;
            }
        });
        return Object.freeze(dispatchKeys);
    }

    const PENDING_SELECTION_CONTRACTS = buildPendingSelectionContracts(PENDING_SELECTION_CONTRACT_DEFINITIONS);
    const TARGET_SELECTION_PENDING_TYPES = buildPendingSelectionTypeSet(PENDING_SELECTION_CONTRACT_DEFINITIONS, 'needsTargetSelection');
    const CANCELLABLE_PENDING_TYPES = buildPendingSelectionTypeSet(PENDING_SELECTION_CONTRACT_DEFINITIONS, 'cancellable');
    const PENDING_SELECTION_DISPATCH_KEYS = buildPendingSelectionDispatchKeys(PENDING_SELECTION_CONTRACT_DEFINITIONS);

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
            selectedCount: (cardType === 'BOARD_EXPANSION_GOD' || cardType === 'BOARD_SHRINK_WILL') ? 0 : undefined,
            maxSelections: cardType === 'BOARD_EXPANSION_GOD'
                ? 2
                : (cardType === 'BOARD_SHRINK_WILL' ? 3 : undefined),
            selectedTargets: (cardType === 'BOARD_EXPANSION_GOD' || cardType === 'BOARD_SHRINK_WILL') ? [] : undefined,
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
