'use strict';

import PendingSelectionRegistry = require('./pending-selection-registry');
import ManifestStoneRegistryImport = require('../../../shared/manifest-stone-registry');
import SpecialCardRegistryImport = require('../../../shared/special-card-registry');
import CardMarkersImport = require('../cards/markers');
import BoardExecutorResolutionImport = require('../card-resolution/board-executor');
import StoneSupply = require('../../../shared/stone-supply');

const ManifestStoneRegistry: any = ManifestStoneRegistryImport;
const SpecialCardRegistry: any = SpecialCardRegistryImport;
const CardMarkersModule: any = CardMarkersImport;
const BoardExecutorResolution: any = BoardExecutorResolutionImport;

interface CardUsageContext {
    gameState?: any;
    cardState?: any;
    playerKey?: string;
    cardType?: string;
    cardId?: string;
    prng?: any;
    heavenSeedHint?: any;
    turnIndex?: number;
    riboUnlockTurnIndex?: number;
    [key: string]: any;
}

interface CardUsageResult {
    ok: boolean;
    heavenOffers: any[] | null;
    condemnOffers: any[] | null;
    observerWillOffers: any[] | null;
}

function hasTargets(targets: any[], minimumCount: number): boolean {
    const safeMinimumCount = Number.isFinite(Number(minimumCount)) ? Math.max(1, Math.trunc(Number(minimumCount))) : 1;
    return Array.isArray(targets) && targets.length >= safeMinimumCount;
}

function buildSelectionTargetArgs(context: CardUsageContext, argsKey: string): any[] {
    switch (argsKey) {
        case 'board':
            return [context.cardState, context.gameState];
        case 'player_pending':
            return [context.cardState, context.gameState, context.playerKey, context.pending || null];
        case 'player':
        default:
            return [context.cardState, context.gameState, context.playerKey];
    }
}

function validateRegistrySelectionTargets(context: CardUsageContext, entry: any): boolean {
    if (!context || !context.gameState || !entry || !entry.target)
        return false;
    const resolver = context[entry.target.method];
    if (typeof resolver !== 'function')
        return false;
    const minimumCount = Number.isFinite(Number(entry.target.minimumCount))
        ? Math.max(1, Math.trunc(Number(entry.target.minimumCount)))
        : 1;
    return hasTargets(resolver(...buildSelectionTargetArgs(context, entry.target.argsKey)), minimumCount);
}

function buildFailureResult(): CardUsageResult {
    return { ok: false, heavenOffers: null, condemnOffers: null, observerWillOffers: null };
}

function getBoardExecutorResolution(context: CardUsageContext): any {
    return (context && (context.CardBoardExecutorResolutionModule || context.BoardExecutorResolutionModule))
        || BoardExecutorResolution
        || null;
}

function isInviolableSpecialCardId(cardId: any): boolean {
    if (SpecialCardRegistry && typeof SpecialCardRegistry.isInviolableSpecialCardId === 'function') {
        return SpecialCardRegistry.isInviolableSpecialCardId(cardId) === true;
    }
    return false;
}

function isManifestStoneType(rawType: any): boolean {
    return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
}

function isActiveManifestStoneMarker(marker: any): boolean {
    return ManifestStoneRegistry.isActiveManifestStoneMarker(marker) === true;
}

function hasActiveManifestStone(cardState: any): boolean {
    if (CardMarkersModule && typeof CardMarkersModule.getActiveManifestMarkers === 'function') {
        return CardMarkersModule.getActiveManifestMarkers(cardState).length > 0;
    }
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    return markers.some(isActiveManifestStoneMarker);
}

function validateCardUsagePreconditions(context: CardUsageContext): CardUsageResult {
    const cardType = String(context && context.cardType || '');
    const result: CardUsageResult = { ok: true, heavenOffers: null, condemnOffers: null, observerWillOffers: null };
    if (!cardType)
        return result;
    if (isInviolableSpecialCardId(context && context.cardId) && hasActiveManifestStone(context && context.cardState)) {
        return buildFailureResult();
    }
    if (StoneSupply.isStonePlacementCardType(cardType) && StoneSupply.isStoneSupplyExhausted(context.cardState, context.playerKey)) {
        return buildFailureResult();
    }
    // 置ける場所が無い手番に使っても何も起きないことが確実なカードだけを使えなくする（01-rulebook.md §9）。
    if (
        StoneSupply.isNoEffectWithoutLegalMoveCardType(cardType)
        && context.gameState
        && typeof context.hasStandardLegalMoveForPlayer === 'function'
        && context.hasStandardLegalMoveForPlayer(context.cardState, context.gameState, context.playerKey) !== true
    ) {
        return buildFailureResult();
    }
    if (cardType === 'THEORY_INCARNATION') {
        const totals = context && context.cardState && context.cardState.numberCellCollectedTotalByPlayer;
        const collected = Number(totals && totals[context.playerKey || ''] || 0);
        if (!Number.isFinite(collected) || collected < 42) {
            return buildFailureResult();
        }
    }
    if (cardType === 'BOARD_EXECUTOR') {
        const moduleRef = getBoardExecutorResolution(context);
        if (!moduleRef || typeof moduleRef.canUseBoardExecutor !== 'function') {
            return buildFailureResult();
        }
        return moduleRef.canUseBoardExecutor(context.cardState, context.playerKey)
            ? result
            : buildFailureResult();
    }
    if (cardType === 'CHAOS_SUMMON') {
        if (!context || !context.gameState || typeof context.canUseChaosSummon !== 'function') {
            return buildFailureResult();
        }
        return context.canUseChaosSummon(context.cardState, context.gameState, context.playerKey)
            ? result
            : buildFailureResult();
    }
    if (cardType === 'LAST_RESORT') {
        if (!context || !context.gameState || typeof context.canUseLastResortForPlayer !== 'function') {
            return buildFailureResult();
        }
        return context.canUseLastResortForPlayer(context.cardState, context.gameState, context.playerKey)
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
    if (cardType === 'SUPPORT_TROOPS_WILL') {
        if (!context || !context.gameState || typeof context.canUseSupportTroopsWillForPlayer !== 'function') {
            return buildFailureResult();
        }
        return context.canUseSupportTroopsWillForPlayer(context.cardState, context.gameState, context.playerKey)
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
    if (cardType === 'TIME_STOP_DEITY') {
        if (typeof context.canUseTimeStopDeityForPlayer !== 'function') {
            return buildFailureResult();
        }
        return context.canUseTimeStopDeityForPlayer(context.cardState, context.gameState, context.playerKey)
            ? result
            : buildFailureResult();
    }
    if (cardType === 'LOSS_WILL') {
        if (typeof context.getLossWillRemovableCount !== 'function')
            return buildFailureResult();
        return context.getLossWillRemovableCount(context.cardState, context.gameState) > 0
            ? result
            : buildFailureResult();
    }
    if (cardType === 'MASS_FREEZE_WILL') {
        if (typeof context.getMassFreezeWillTargetCount !== 'function')
            return buildFailureResult();
        return context.getMassFreezeWillTargetCount(context.cardState, context.gameState, context.playerKey) > 0
            ? result
            : buildFailureResult();
    }
    if (cardType === 'SALVATION_WILL') {
        if (typeof context.getSalvationWillTargetCount !== 'function')
            return buildFailureResult();
        return context.getSalvationWillTargetCount(context.cardState, context.playerKey) > 0
            ? result
            : buildFailureResult();
    }
    if (cardType === 'EXECUTION_WILL') {
        if (typeof context.getExecutionWillTargetCount !== 'function')
            return buildFailureResult();
        const opponentKey = context.playerKey === 'black' ? 'white' : 'black';
        const opponentHand = (context && context.cardState && context.cardState.hands && Array.isArray(context.cardState.hands[opponentKey]))
            ? context.cardState.hands[opponentKey]
            : [];
        const hasDestructibleOpponentCard = opponentHand.some((cardId: any) => !isInviolableSpecialCardId(cardId));
        return context.getExecutionWillTargetCount(context.cardState, context.playerKey) > 0 && hasDestructibleOpponentCard
            ? result
            : buildFailureResult();
    }
    if (cardType === 'HEAVEN_BLESSING') {
        if (typeof context.buildHeavenBlessingOffers !== 'function')
            return buildFailureResult();
        const offers = context.buildHeavenBlessingOffers(context.cardId, context.prng, context.heavenSeedHint);
        if (!Array.isArray(offers) || offers.length <= 0)
            return buildFailureResult();
        result.heavenOffers = offers;
        return result;
    }
    if (cardType === 'CONDEMN_WILL') {
        if (typeof context.buildCondemnOffers !== 'function')
            return buildFailureResult();
        const offers = context.buildCondemnOffers(context.cardState, context.playerKey);
        if (!Array.isArray(offers) || offers.length <= 0)
            return buildFailureResult();
        result.condemnOffers = offers;
        return result;
    }
    if (cardType === 'OBSERVER_WILL') {
        const gameTurnNumber = Number(context && context.gameState && context.gameState.turnNumber);
        const turnIndex = Number(context && context.turnIndex);
        const elapsedTurns = Number.isFinite(gameTurnNumber) ? gameTurnNumber : turnIndex;
        if (!Number.isFinite(elapsedTurns) || elapsedTurns < 18)
            return buildFailureResult();
        if (typeof context.buildObserverWillOffers !== 'function')
            return buildFailureResult();
        const offers = context.buildObserverWillOffers(context.cardState, context.playerKey);
        if (!Array.isArray(offers) || offers.length <= 0)
            return buildFailureResult();
        result.observerWillOffers = offers;
        return result;
    }
    if (cardType === 'REVEAL_HAND_WILL') {
        const opponentKey = context.playerKey === 'black' ? 'white' : 'black';
        const opponentHand = (context && context.cardState && context.cardState.hands && Array.isArray(context.cardState.hands[opponentKey]))
            ? context.cardState.hands[opponentKey]
            : [];
        return opponentHand.length > 0 ? result : buildFailureResult();
    }
    // Every target-selection card is described by the pending-selection registry (method, args, minimum).
    const registryEntry = PendingSelectionRegistry.getPendingSelectionEntry(cardType);
    if (registryEntry && registryEntry.target && registryEntry.target.method) {
        return validateRegistrySelectionTargets(context, registryEntry) ? result : buildFailureResult();
    }
    return result;
}

export = {
    validateCardUsagePreconditions
};
