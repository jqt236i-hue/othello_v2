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

function validateSelectionTargets(context: CardUsageContext, resolverName: string, minimumCount: number): boolean {
    if (!context || !context.gameState)
        return false;
    const resolver = context[resolverName];
    if (typeof resolver !== 'function')
        return false;
    return hasTargets(resolver(context.cardState, context.gameState, context.playerKey), minimumCount);
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
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isManifestStoneType === 'function') {
        return ManifestStoneRegistry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
}

function isActiveManifestStoneMarker(marker: any): boolean {
    if (ManifestStoneRegistry && typeof ManifestStoneRegistry.isActiveManifestStoneMarker === 'function') {
        return ManifestStoneRegistry.isActiveManifestStoneMarker(marker) === true;
    }
    const type = marker && marker.data ? String(marker.data.type || '').toUpperCase() : '';
    if (!marker || (marker.kind !== 'manifestStone' && marker.kind !== 'specialStone')) return false;
    if (!isManifestStoneType(type)) return false;
    if (Object.prototype.hasOwnProperty.call(marker.data || {}, 'remainingOwnerTurns')) {
        const remaining = Number(marker.data.remainingOwnerTurns);
        return Number.isFinite(remaining) && remaining > 0;
    }
    return true;
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
    // 効果がそのターンの通常配置に依存するカードは、通常合法手が無いと使えない（01-rulebook.md §9 使用条件の分類）。
    if (
        StoneSupply.isLegalMoveDependentCardType(cardType)
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
    if (cardType === 'EQUALITY_WILL') {
        if (!context || typeof context.canUseEqualityWillForPlayer !== 'function') {
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
    const registryEntry = PendingSelectionRegistry.getPendingSelectionEntry(cardType);
    if (registryEntry && registryEntry.target && registryEntry.target.method) {
        return validateRegistrySelectionTargets(context, registryEntry) ? result : buildFailureResult();
    }
    switch (cardType) {
        case 'TEMPT_WILL':
            return validateSelectionTargets(context, 'getTemptWillTargets', 1) ? result : buildFailureResult();
        case 'CAPTURE_WILL':
            return validateSelectionTargets(context, 'getCaptureWillTargets', 1) ? result : buildFailureResult();
        case 'STRONG_WIND_WILL':
            return validateSelectionTargets(context, 'getStrongWindTargets', 1) ? result : buildFailureResult();
        case 'BUOYANCY_WILL':
            return validateSelectionTargets(context, 'getBuoyancyTargets', 1) ? result : buildFailureResult();
        case 'SUPER_BUOYANCY_WILL':
            return validateSelectionTargets(context, 'getSuperBuoyancyTargets', 1) ? result : buildFailureResult();
        case 'GRAVITY_WILL':
            return validateSelectionTargets(context, 'getGravityTargets', 1) ? result : buildFailureResult();
        case 'SUPER_GRAVITY_WILL':
            return validateSelectionTargets(context, 'getSuperGravityTargets', 1) ? result : buildFailureResult();
        case 'TRAP_WILL':
            return validateSelectionTargets(context, 'getTrapTargets', 1) ? result : buildFailureResult();
        case 'GUARD_WILL':
        case 'GUARDIAN_GOD':
            return validateSelectionTargets(context, 'getGuardTargets', 1) ? result : buildFailureResult();
        case 'REINCARNATION_WILL':
            return validateSelectionTargets(context, 'getReincarnationTargets', 1) ? result : buildFailureResult();
        case 'LIVING_WILL':
            return validateSelectionTargets(context, 'getLivingWillTargets', 1) ? result : buildFailureResult();
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
        case 'POSITION_SWAP_WILL':
            return validateSelectionTargets(context, 'getPositionSwapTargets', 2) ? result : buildFailureResult();
        case 'BOARD_EXPANSION_WILL':
            return validateSelectionTargets(context, 'getBoardExpansionTargets', 1) ? result : buildFailureResult();
        case 'BOARD_EXPANSION_GOD':
            return validateSelectionTargets(context, 'getBoardExpansionGodTargets', 1) ? result : buildFailureResult();
        case 'BOARD_SHRINK_WILL':
            return validateSelectionTargets(context, 'getBoardShrinkTargets', 3) ? result : buildFailureResult();
        case 'BOARD_SHRINK_GOD':
            return validateSelectionTargets(context, 'getBoardShrinkGodTargets', 1) ? result : buildFailureResult();
        case 'BLOCKADE_WILL':
            return validateSelectionTargets(context, 'getBlockadeTargets', 1) ? result : buildFailureResult();
        case 'POISON_WILL':
            return validateSelectionTargets(context, 'getPoisonTargets', 1) ? result : buildFailureResult();
        case 'METEOR_WILL':
            return validateSelectionTargets(context, 'getMeteorTargets', 1) ? result : buildFailureResult();
        case 'CAUSAL_REPLAY_WILL':
            return validateSelectionTargets(context, 'getCausalReplayTargets', 1) ? result : buildFailureResult();
        case 'FREEZE_WILL':
            return validateSelectionTargets(context, 'getFreezeTargets', 1) ? result : buildFailureResult();
        case 'SEED_WILL':
            return validateSelectionTargets(context, 'getSeedTargets', 1) ? result : buildFailureResult();
        default:
            return result;
    }
}

export = {
    validateCardUsagePreconditions
};
