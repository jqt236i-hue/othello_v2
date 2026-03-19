(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardHandManager = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function getConstants(context) {
        const constants = (context && context.constants) || {};
        return {
            CARD_DEFS: Array.isArray(constants.CARD_DEFS) ? constants.CARD_DEFS : [],
            CARD_TYPE_BY_ID: (constants.CARD_TYPE_BY_ID && typeof constants.CARD_TYPE_BY_ID === 'object') ? constants.CARD_TYPE_BY_ID : {},
            MAX_HAND_SIZE: Number.isFinite(Number(constants.MAX_HAND_SIZE))
                ? Math.max(0, Math.trunc(Number(constants.MAX_HAND_SIZE)))
                : 5,
            RIBO_WILL_UNLOCK_TURN_INDEX: Number.isFinite(Number(constants.RIBO_WILL_UNLOCK_TURN_INDEX))
                ? Math.trunc(Number(constants.RIBO_WILL_UNLOCK_TURN_INDEX))
                : 19
        };
    }

    function getHelpers(context) {
        return (context && context.helpers) || {};
    }

    function getModules(context) {
        return (context && context.modules) || {};
    }

    function getCardDefsModule(context) {
        const modules = getModules(context);
        return modules.CardDefsModule || modules.cardDefsModule || null;
    }

    function getCardCostsModule(context) {
        const modules = getModules(context);
        return modules.CardCostsModule || modules.cardCostsModule || null;
    }

    function getCardSelectorsModule(context) {
        const modules = getModules(context);
        return modules.CardSelectorsModule || modules.cardSelectorsModule || null;
    }

    function hasTargets(targets, minimumCount) {
        const safeMinimumCount = Number.isFinite(Number(minimumCount))
            ? Math.max(1, Math.trunc(Number(minimumCount)))
            : 1;
        return Array.isArray(targets) && targets.length >= safeMinimumCount;
    }

    function invokeLocalSelector(context, methodName, args) {
        const helpers = getHelpers(context);
        const selector = helpers[methodName];
        if (typeof selector !== 'function') return null;
        try {
            return selector.apply(null, args);
        } catch (e) {
            return null;
        }
    }

    function invokeModuleSelector(context, methodName, args) {
        const selectorsModule = getCardSelectorsModule(context);
        if (!selectorsModule || typeof selectorsModule[methodName] !== 'function') return null;
        try {
            return selectorsModule[methodName].apply(selectorsModule, args);
        } catch (e) {
            return null;
        }
    }

    function requireLocalTargets(context, methodName, args, minimumCount) {
        const targets = invokeLocalSelector(context, methodName, args);
        return targets === null ? true : hasTargets(targets, minimumCount);
    }

    function requireModuleTargets(context, methodName, args, minimumCount) {
        const targets = invokeModuleSelector(context, methodName, args);
        return targets === null ? true : hasTargets(targets, minimumCount);
    }

    function dealInitialHands(cardState, prng, context) {
        void prng;
        void context;
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.turnCountByPlayer || typeof cardState.turnCountByPlayer !== 'object') {
            cardState.turnCountByPlayer = { black: 0, white: 0 };
            return;
        }
        cardState.turnCountByPlayer.black = 0;
        cardState.turnCountByPlayer.white = 0;
    }

    function commitDraw(cardState, playerKey, prng, context) {
        void prng;
        const { MAX_HAND_SIZE } = getConstants(context);
        const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
            ? cardState.hands[playerKey]
            : null;
        const decks = (cardState && cardState.decks && typeof cardState.decks === 'object') ? cardState.decks : null;
        const playerDeck = (decks && Array.isArray(decks[playerKey]))
            ? decks[playerKey]
            : (Array.isArray(cardState && cardState.deck) ? cardState.deck : null);
        if (!hand || !playerDeck) return null;
        if (hand.length >= MAX_HAND_SIZE) return null;
        if (playerDeck.length === 0) return null;
        const cardId = playerDeck.pop();
        hand.push(cardId);
        return cardId;
    }

    function getCardDef(cardId, context) {
        const defsModule = getCardDefsModule(context);
        if (defsModule && typeof defsModule.getCardDef === 'function') {
            return defsModule.getCardDef(cardId);
        }
        const { CARD_DEFS } = getConstants(context);
        return CARD_DEFS.find((card) => card && card.id === cardId) || null;
    }

    function getCardType(cardId, context) {
        const defsModule = getCardDefsModule(context);
        if (defsModule && typeof defsModule.getCardType === 'function') {
            return defsModule.getCardType(cardId);
        }
        const { CARD_TYPE_BY_ID } = getConstants(context);
        return CARD_TYPE_BY_ID[cardId] || null;
    }

    function getCardDisplayName(cardId, context) {
        const defsModule = getCardDefsModule(context);
        if (defsModule && typeof defsModule.getCardDisplayName === 'function') {
            return defsModule.getCardDisplayName(cardId);
        }
        const def = getCardDef(cardId, context);
        return def ? def.name : '';
    }

    function getCardCodeName(displayName, context) {
        const defsModule = getCardDefsModule(context);
        if (defsModule && typeof defsModule.getCardCodeName === 'function') {
            return defsModule.getCardCodeName(displayName);
        }
        const { CARD_DEFS } = getConstants(context);
        const def = CARD_DEFS.find((card) => card && card.name === displayName);
        return def ? def.id : null;
    }

    function getCardCost(cardId, context) {
        const costsModule = getCardCostsModule(context);
        if (costsModule && typeof costsModule.getCardCost === 'function') {
            return costsModule.getCardCost(cardId);
        }
        const def = getCardDef(cardId, context);
        return def ? def.cost : 0;
    }

    function canUseCard(cardState, playerKey, cardId, context, opts) {
        const { RIBO_WILL_UNLOCK_TURN_INDEX } = getConstants(context);
        const hands = cardState && cardState.hands;
        if (!hands || !Array.isArray(hands[playerKey])) return false;
        const skipCostAndTurnLimit = opts && opts.skipCostAndTurnLimit;
        if (!skipCostAndTurnLimit && cardState.hasUsedCardThisTurnByPlayer[playerKey]) return false;
        if (!hands[playerKey].includes(cardId)) return false;
        if (!skipCostAndTurnLimit) {
            const cost = getCardCost(cardId, context);
            if (!cardState.charge || Number(cardState.charge[playerKey] || 0) < cost) return false;
        }
        const cardType = getCardType(cardId, context);
        if (cardType === 'RIBO_WILL' && Number(cardState.turnIndex || 0) < RIBO_WILL_UNLOCK_TURN_INDEX) {
            return false;
        }
        return true;
    }

    function ensureHandDestroyFlags(cardState) {
        if (!cardState || typeof cardState !== 'object') return;
        if (!cardState.hasDestroyedCardThisTurnByPlayer || typeof cardState.hasDestroyedCardThisTurnByPlayer !== 'object') {
            cardState.hasDestroyedCardThisTurnByPlayer = { black: false, white: false };
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'black')) {
            cardState.hasDestroyedCardThisTurnByPlayer.black = false;
        }
        if (!Object.prototype.hasOwnProperty.call(cardState.hasDestroyedCardThisTurnByPlayer, 'white')) {
            cardState.hasDestroyedCardThisTurnByPlayer.white = false;
        }
    }

    function destroyHandCard(cardState, playerKey, cardId, opts, context) {
        void opts;
        void context;
        if (!cardState || !cardState.hands) return { applied: false, reason: 'invalid_state' };
        const ownerKey = playerKey === 'white' ? 'white' : 'black';
        const hand = Array.isArray(cardState.hands[ownerKey]) ? cardState.hands[ownerKey] : null;
        if (!hand) return { applied: false, reason: 'invalid_hand' };

        ensureHandDestroyFlags(cardState);

        const index = hand.indexOf(cardId);
        if (index < 0) return { applied: false, reason: 'card_not_in_hand' };

        const destroyedCardId = hand[index];
        hand.splice(index, 1);
        if (!Array.isArray(cardState.discard)) cardState.discard = [];
        cardState.discard.push(destroyedCardId);
        cardState.hasDestroyedCardThisTurnByPlayer[ownerKey] = true;

        return { applied: true, destroyedCardId };
    }

    function getUsableCardIds(cardState, gameState, playerKey, context, opts) {
        if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return [];
        const helpers = getHelpers(context);
        const hand = cardState.hands[playerKey];
        const res = [];

        for (const cardId of hand) {
            if (!canUseCard(cardState, playerKey, cardId, context, opts)) continue;
            const def = getCardDef(cardId, context);
            if (!def) continue;
            const type = def.type;

            if (type === 'SELL_CARD_WILL' && hand.length <= 1) continue;

            if (type === 'CONDEMN_WILL') {
                const opponentKey = playerKey === 'black' ? 'white' : 'black';
                const opponentHand = (cardState.hands && Array.isArray(cardState.hands[opponentKey]))
                    ? cardState.hands[opponentKey]
                    : [];
                if (opponentHand.length === 0) continue;
            }

            if (gameState) {
                if (type === 'LAST_RESORT') {
                    if (typeof helpers.hasStandardLegalMoveForPlayer !== 'function') continue;
                    if (helpers.hasStandardLegalMoveForPlayer(cardState, gameState, playerKey)) continue;
                }

                if (type === 'CORNER_TRIBUTE') {
                    if (typeof helpers.countOpponentOccupiedCornersForPlayer !== 'function') continue;
                    if (helpers.countOpponentOccupiedCornersForPlayer(cardState, gameState, playerKey) < 4) continue;
                }

                if (type === 'TEMPT_WILL' && !requireLocalTargets(context, 'getTemptWillTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'TRAP_WILL' && !requireLocalTargets(context, 'getTrapTargets', [cardState, gameState, playerKey], 1)) continue;
                if ((type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') && !requireLocalTargets(context, 'getGuardTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'HYPERACTIVE_INHERIT_WILL' && !requireLocalTargets(context, 'getHyperactiveInheritTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'EXTEND_LIFE_WILL' && !requireLocalTargets(context, 'getExtendLifeTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'CORROSION_WILL' && !requireLocalTargets(context, 'getCorrosionTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'TIME_BOMB' && !requireLocalTargets(context, 'getTimeBombTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'TELEPORT_WILL' && !requireLocalTargets(context, 'getTeleportTargets', [cardState, gameState], 1)) continue;
                if (type === 'CELL_TELEPORT_WILL' && !requireLocalTargets(context, 'getCellTeleportTargets', [cardState, gameState], 1)) continue;
                if (type === 'SUPER_BUOYANCY_WILL' && !requireLocalTargets(context, 'getSuperBuoyancyTargets', [cardState, gameState], 1)) continue;
                if (type === 'SUPER_GRAVITY_WILL' && !requireLocalTargets(context, 'getSuperGravityTargets', [cardState, gameState], 1)) continue;
                if (type === 'CLONE_WILL' && !requireLocalTargets(context, 'getCloneTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'SPLIT_WILL' && !requireLocalTargets(context, 'getSplitTargets', [cardState, gameState, playerKey], 1)) continue;

                if (type === 'POSITION_SWAP_WILL') {
                    const getOccupiedBoardShapeCellsForCard = helpers.getOccupiedBoardShapeCellsForCard;
                    const occupied = typeof getOccupiedBoardShapeCellsForCard === 'function'
                        ? getOccupiedBoardShapeCellsForCard(cardState, gameState).length
                        : 0;
                    if (occupied < 2) continue;
                }

                if (type === 'BOARD_EXPANSION_WILL' && !requireLocalTargets(context, 'getBoardExpansionTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'BOARD_EXPANSION_GOD' && !requireLocalTargets(context, 'getBoardExpansionGodTargets', [cardState, gameState, playerKey], 2)) continue;
                if (type === 'BLOCKADE_WILL' && !requireLocalTargets(context, 'getBlockadeTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'METEOR_WILL' && !requireLocalTargets(context, 'getMeteorTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'FREEZE_WILL' && !requireLocalTargets(context, 'getFreezeTargets', [cardState, gameState, playerKey], 1)) continue;

                if (type === 'DESTROY_ONE_STONE' && !requireModuleTargets(context, 'getDestroyTargets', [cardState, gameState], 1)) continue;
                if (type === 'STRONG_WIND_WILL' && !requireModuleTargets(context, 'getStrongWindTargets', [cardState, gameState], 1)) continue;
                if (type === 'SUPER_BUOYANCY_WILL' && !requireModuleTargets(context, 'getSuperBuoyancyTargets', [cardState, gameState], 1)) continue;
                if (type === 'SUPER_GRAVITY_WILL' && !requireModuleTargets(context, 'getSuperGravityTargets', [cardState, gameState], 1)) continue;
                if (type === 'SACRIFICE_WILL' && !requireModuleTargets(context, 'getSacrificeTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'SWAP_WITH_ENEMY' && !requireModuleTargets(context, 'getSwapTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'POSITION_SWAP_WILL' && !requireModuleTargets(context, 'getPositionSwapTargets', [cardState, gameState, playerKey, null], 2)) continue;
                if (type === 'TRAP_WILL' && !requireModuleTargets(context, 'getTrapTargets', [cardState, gameState, playerKey], 1)) continue;
                if ((type === 'GUARD_WILL' || type === 'GUARDIAN_GOD') && !requireModuleTargets(context, 'getGuardTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'HYPERACTIVE_INHERIT_WILL' && !requireModuleTargets(context, 'getHyperactiveInheritTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'EXTEND_LIFE_WILL' && !requireModuleTargets(context, 'getExtendLifeTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'TIME_BOMB' && !requireModuleTargets(context, 'getTimeBombTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'TELEPORT_WILL' && !requireModuleTargets(context, 'getTeleportTargets', [cardState, gameState], 1)) continue;
                if (type === 'CELL_TELEPORT_WILL' && !requireModuleTargets(context, 'getCellTeleportTargets', [cardState, gameState], 1)) continue;
                if (type === 'CLONE_WILL' && !requireModuleTargets(context, 'getCloneTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'SPLIT_WILL' && !requireModuleTargets(context, 'getSplitTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'BOARD_EXPANSION_GOD' && !requireModuleTargets(context, 'getBoardExpansionGodTargets', [cardState, gameState, playerKey], 2)) continue;
                if (type === 'BLOCKADE_WILL' && !requireModuleTargets(context, 'getBlockadeTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'METEOR_WILL' && !requireModuleTargets(context, 'getMeteorTargets', [cardState, gameState, playerKey], 1)) continue;
                if (type === 'FREEZE_WILL' && !requireModuleTargets(context, 'getFreezeTargets', [cardState, gameState, playerKey], 1)) continue;
            }

            res.push(cardId);
        }

        return res;
    }

    function hasUsableCard(cardState, gameState, playerKey, context) {
        return getUsableCardIds(cardState, gameState, playerKey, context).length > 0;
    }

    return {
        dealInitialHands,
        commitDraw,
        getCardDef,
        getCardType,
        getCardDisplayName,
        getCardCodeName,
        getCardCost,
        canUseCard,
        ensureHandDestroyFlags,
        destroyHandCard,
        getUsableCardIds,
        hasUsableCard
    };
}));