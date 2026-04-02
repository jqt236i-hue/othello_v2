(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardUsagePrechecks = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function hasTargets(targets, minimumCount) {
        const safeMinimumCount = Number.isFinite(Number(minimumCount)) ? Math.max(1, Math.trunc(Number(minimumCount))) : 1;
        return Array.isArray(targets) && targets.length >= safeMinimumCount;
    }

    function validateSelectionTargets(context, resolverName, minimumCount) {
        if (!context || !context.gameState) return false;
        const resolver = context[resolverName];
        if (typeof resolver !== 'function') return false;
        return hasTargets(resolver(context.cardState, context.gameState, context.playerKey), minimumCount);
    }

    function buildFailureResult() {
        return { ok: false, heavenOffers: null, condemnOffers: null };
    }

    function validateCardUsagePreconditions(context) {
        const cardType = String(context && context.cardType || '');
        const result = { ok: true, heavenOffers: null, condemnOffers: null };
        if (!cardType) return result;

        if (cardType === 'SELL_CARD_WILL') {
            const remainingHandCount = (context && context.cardState && context.cardState.hands && context.cardState.hands[context.handKey]
                ? context.cardState.hands[context.handKey].length
                : 0) - 1;
            return remainingHandCount > 0 ? result : buildFailureResult();
        }

        if (cardType === 'LAST_RESORT') {
            if (!context || !context.gameState || typeof context.canUseLastResortForPlayer !== 'function') {
                return buildFailureResult();
            }
            return context.canUseLastResortForPlayer(context.cardState, context.gameState, context.playerKey)
                ? result
                : buildFailureResult();
        }

        if (cardType === 'EQUALITY_WILL') {
            if (!context || !context.gameState || typeof context.canUseEqualityWillForPlayer !== 'function') {
                return buildFailureResult();
            }
            return context.canUseEqualityWillForPlayer(context.cardState, context.gameState, context.playerKey)
                ? result
                : buildFailureResult();
        }

        if (cardType === 'REINFORCEMENT_WILL') {
            if (!context || !context.gameState || typeof context.canUseReinforcementWillForPlayer !== 'function') {
                return buildFailureResult();
            }
            return context.canUseReinforcementWillForPlayer(context.cardState, context.gameState, context.playerKey)
                ? result
                : buildFailureResult();
        }

        if (cardType === 'CORNER_TRIBUTE') {
            if (!context || !context.gameState || typeof context.countOpponentOccupiedCornersForPlayer !== 'function') {
                return buildFailureResult();
            }
            return context.countOpponentOccupiedCornersForPlayer(context.cardState, context.gameState, context.playerKey) >= 4
                ? result
                : buildFailureResult();
        }

        if (cardType === 'RIBO_WILL') {
            const turnIndex = Number(context && context.turnIndex);
            const unlockTurnIndex = Number(context && context.riboUnlockTurnIndex);
            if (!Number.isFinite(turnIndex) || !Number.isFinite(unlockTurnIndex) || turnIndex < unlockTurnIndex) {
                return buildFailureResult();
            }
            return result;
        }

        if (cardType === 'TIME_STOP_GOD') {
            if (typeof context.canUseTimeStopGodForPlayer !== 'function') {
                return buildFailureResult();
            }
            return context.canUseTimeStopGodForPlayer(context.cardState, context.gameState, context.playerKey)
                ? result
                : buildFailureResult();
        }

        if (cardType === 'LOSS_WILL') {
            if (typeof context.getLossWillRemovableCount !== 'function') return buildFailureResult();
            return context.getLossWillRemovableCount(context.cardState, context.gameState) > 0
                ? result
                : buildFailureResult();
        }

        if (cardType === 'SALVATION_WILL') {
            if (typeof context.getSalvationWillTargetCount !== 'function') return buildFailureResult();
            return context.getSalvationWillTargetCount(context.cardState, context.playerKey) > 0
                ? result
                : buildFailureResult();
        }

        if (cardType === 'HEAVEN_BLESSING') {
            if (typeof context.buildHeavenBlessingOffers !== 'function') return buildFailureResult();
            const offers = context.buildHeavenBlessingOffers(context.cardId, context.prng, context.heavenSeedHint);
            if (!Array.isArray(offers) || offers.length <= 0) return buildFailureResult();
            result.heavenOffers = offers;
            return result;
        }

        if (cardType === 'CONDEMN_WILL') {
            if (typeof context.buildCondemnOffers !== 'function') return buildFailureResult();
            const offers = context.buildCondemnOffers(context.cardState, context.playerKey);
            if (!Array.isArray(offers) || offers.length <= 0) return buildFailureResult();
            result.condemnOffers = offers;
            return result;
        }

        if (cardType === 'REVEAL_HAND_WILL') {
            const opponentKey = context.playerKey === 'black' ? 'white' : 'black';
            const opponentHand = (context && context.cardState && context.cardState.hands && Array.isArray(context.cardState.hands[opponentKey]))
                ? context.cardState.hands[opponentKey]
                : [];
            return opponentHand.length > 0 ? result : buildFailureResult();
        }

        switch (cardType) {
        case 'TEMPT_WILL':
            return validateSelectionTargets(context, 'getTemptWillTargets', 1) ? result : buildFailureResult();
        case 'CAPTURE_WILL':
            return validateSelectionTargets(context, 'getCaptureWillTargets', 1) ? result : buildFailureResult();
        case 'STRONG_WIND_WILL':
            return validateSelectionTargets(context, 'getStrongWindTargets', 1) ? result : buildFailureResult();
        case 'SUPER_BUOYANCY_WILL':
            return validateSelectionTargets(context, 'getSuperBuoyancyTargets', 1) ? result : buildFailureResult();
        case 'SUPER_GRAVITY_WILL':
            return validateSelectionTargets(context, 'getSuperGravityTargets', 1) ? result : buildFailureResult();
        case 'TRAP_WILL':
            return validateSelectionTargets(context, 'getTrapTargets', 1) ? result : buildFailureResult();
        case 'GUARD_WILL':
        case 'GUARDIAN_GOD':
            return validateSelectionTargets(context, 'getGuardTargets', 1) ? result : buildFailureResult();
        case 'HYPERACTIVE_INHERIT_WILL':
            return validateSelectionTargets(context, 'getHyperactiveInheritTargets', 1) ? result : buildFailureResult();
        case 'EXTEND_LIFE_WILL':
        case 'EXTEND_LIFE_GOD':
            return validateSelectionTargets(context, 'getExtendLifeTargets', 1) ? result : buildFailureResult();
        case 'CORROSION_WILL':
            return validateSelectionTargets(context, 'getCorrosionTargets', 1) ? result : buildFailureResult();
        case 'TIME_BOMB':
            return validateSelectionTargets(context, 'getTimeBombTargets', 1) ? result : buildFailureResult();
        case 'TELEPORT_WILL':
            return validateSelectionTargets(context, 'getTeleportTargets', 1) ? result : buildFailureResult();
        case 'CELL_TELEPORT_WILL':
            return validateSelectionTargets(context, 'getCellTeleportTargets', 1) ? result : buildFailureResult();
        case 'CLONE_WILL':
            return validateSelectionTargets(context, 'getCloneTargets', 1) ? result : buildFailureResult();
        case 'SPLIT_WILL':
            return validateSelectionTargets(context, 'getSplitTargets', 1) ? result : buildFailureResult();
        case 'POSITION_SWAP_WILL':
            return validateSelectionTargets(context, 'getPositionSwapTargets', 2) ? result : buildFailureResult();
        case 'BOARD_EXPANSION_WILL':
            return validateSelectionTargets(context, 'getBoardExpansionTargets', 1) ? result : buildFailureResult();
        case 'BOARD_EXPANSION_GOD':
            return validateSelectionTargets(context, 'getBoardExpansionGodTargets', 1) ? result : buildFailureResult();
        case 'BLOCKADE_WILL':
            return validateSelectionTargets(context, 'getBlockadeTargets', 1) ? result : buildFailureResult();
        case 'METEOR_WILL':
            return validateSelectionTargets(context, 'getMeteorTargets', 1) ? result : buildFailureResult();
        case 'FREEZE_WILL':
            return validateSelectionTargets(context, 'getFreezeTargets', 1) ? result : buildFailureResult();
        default:
            return result;
        }
    }

    return {
        validateCardUsagePreconditions
    };
}));
