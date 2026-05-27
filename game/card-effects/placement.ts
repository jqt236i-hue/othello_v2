declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

// Imports replacing globalThis references
const cardEffectsHelpers = _require('./helpers');
const { getPlayerKey, getPlayerDisplayName } = cardEffectsHelpers;
const CardSystem = _require('../../card-system');
const ControllerEvents = _require('../controller-events');
const LOG_MESSAGES = _require('../log-messages');

let cachedPendingCoordinator: any = null;
let __uiImpl_placement: any = {};

function setUIImpl(obj: any): void {
    __uiImpl_placement = (obj && typeof obj === 'object') ? obj : {};
}

function resolvePendingCoordinator(): any {
    if (cachedPendingCoordinator && typeof cachedPendingCoordinator === 'object') {
        return cachedPendingCoordinator;
    }
    try {
        cachedPendingCoordinator = _require('../turn/pending-coordinator');
    } catch (e) { /* ignore */ }
    return cachedPendingCoordinator;
}

function emitPlacementLog(message: string): void {
    const injectedEmit = __uiImpl_placement && typeof __uiImpl_placement.emitLogAdded === 'function'
        ? __uiImpl_placement.emitLogAdded
        : null;
    if (typeof injectedEmit === 'function') {
        injectedEmit(message);
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
        ControllerEvents.emitLogAdded(message);
    }
}

function emitPlacementDebugLog(message: string, level: string = 'debug', meta?: any): void {
    try {
        if (
            !__uiImpl_placement ||
            typeof __uiImpl_placement.isDebugLogAvailable !== 'function' ||
            __uiImpl_placement.isDebugLogAvailable() !== true
        ) {
            return;
        }
        if (typeof __uiImpl_placement.debugLog === 'function') {
            __uiImpl_placement.debugLog(message, level, meta || null);
        }
    } catch (e) { /* ignore */ }
}

function readPlacementPendingType(move: any): string | null {
    if (!move) return null;
    const playerKey = typeof getPlayerKey === 'function' ? getPlayerKey(move.player) : null;
    if (!playerKey) return null;
    const injectedCardState = __uiImpl_placement && typeof __uiImpl_placement.getCardState === 'function'
        ? __uiImpl_placement.getCardState()
        : null;
    const activeCardState = (injectedCardState && typeof injectedCardState === 'object')
        ? injectedCardState
        : (CardSystem.cardState && typeof CardSystem.cardState === 'object')
        ? CardSystem.cardState
        : null;
    if (!activeCardState) return null;

    const pendingCoordinator = resolvePendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.getPendingEffectType === 'function') {
        const coordinated = pendingCoordinator.getPendingEffectType(activeCardState, playerKey);
        if (coordinated) return coordinated;
    }
    return (activeCardState.pendingEffectByPlayer
        && activeCardState.pendingEffectByPlayer[playerKey]
        && activeCardState.pendingEffectByPlayer[playerKey].type) || null;
}

function logPlacementEffects(effects: any, player: any): void {
    if (!effects) return;
    const ownerName = getPlayerDisplayName(player);

    if (effects.rainbowStoneUsed) {
        emitPlacementLog(LOG_MESSAGES.rainbowCharge(effects.chargeGained));
    }
    if (effects.silverStoneUsed) {
        emitPlacementLog(LOG_MESSAGES.silverCharge(effects.chargeGained));
    }
    if (effects.goldStoneUsed) {
        emitPlacementLog(LOG_MESSAGES.goldCharge(effects.chargeGained));
    }
    if (effects.crystalStoneUsed) {
        emitPlacementLog(LOG_MESSAGES.crystalCharge(effects.crystalStoneGain || 0));
    }
    if (effects.plunderAmount > 0) {
        emitPlacementLog(LOG_MESSAGES.plunderPoints(effects.plunderAmount));
    }
    if (effects.protected) {
        emitPlacementLog(LOG_MESSAGES.protectNext(ownerName));
        emitPlacementDebugLog('[EFFECT] Protected stone formed (UI-only)', 'info');
    }
    if (effects.permaProtected) {
        emitPlacementLog(LOG_MESSAGES.permaProtectNext(ownerName));
    }
    if (effects.bombPlaced) {
        emitPlacementLog(LOG_MESSAGES.timeBombPlaced(ownerName));
    }
    if (effects.dragonPlaced) {
        emitPlacementLog(LOG_MESSAGES.dragonPlaced(ownerName));
    }
    if (effects.destroyDragonPlaced) {
        if (typeof LOG_MESSAGES.destroyDragonPlaced === 'function') {
            emitPlacementLog(LOG_MESSAGES.destroyDragonPlaced(ownerName));
        }
    }
    if (effects.ultimateDestroyGodPlaced) {
        emitPlacementLog(LOG_MESSAGES.udgPlaced(ownerName));
    }
    if (effects.ultimateHyperactivePlaced) {
        emitPlacementLog(LOG_MESSAGES.ultimateHyperactivePlaced(ownerName));
    }
    if (effects.escapeHyperactivePlaced) {
        if (typeof LOG_MESSAGES.escapeHyperactivePlaced === 'function') {
            emitPlacementLog(LOG_MESSAGES.escapeHyperactivePlaced(ownerName));
        }
    } else if (effects.extremeHyperactivePlaced) {
        if (typeof LOG_MESSAGES.extremeHyperactivePlaced === 'function') {
            emitPlacementLog(LOG_MESSAGES.extremeHyperactivePlaced(ownerName));
        }
    } else if (effects.hyperactivePlaced) {
        emitPlacementLog(LOG_MESSAGES.hyperactivePlaced(ownerName));
    }
    if (effects.doublePlaceActivated) {
        emitPlacementLog(LOG_MESSAGES.doublePlaceActivated(
            effects.multiPlaceActivatedName,
            effects.multiPlaceRemaining,
            effects.multiPlaceInfinite
        ));
    }
}

function applyProtectionAfterMove(move: any, effects: any): any {
    if (!move) return null;
    if (!effects) {
        console.warn('[EFFECT-APPLY] applyProtectionAfterMove called without effects; nothing to apply');
        return null;
    }

    const ownerName = getPlayerDisplayName(move.player);

    logPlacementEffects(effects, move.player);

    if (effects.protected) {
        emitPlacementDebugLog('[EFFECT] Protected stone formed at (' + move.row + ',' + move.col + ')', 'info');
    }

    if (effects.regenTriggered && effects.regenTriggered > 0) {
        emitPlacementLog(LOG_MESSAGES.regenTriggered(effects.regenTriggered));
    }
    if (effects.regenCapture && effects.regenCapture > 0) {
        emitPlacementLog(LOG_MESSAGES.regenCapture(effects.regenCapture));
    }
    if (effects.breedingSpawned && effects.breedingSpawned > 0) {
        emitPlacementLog(LOG_MESSAGES.breedingSpawned(getPlayerDisplayName(move.player), effects.breedingSpawned));
    }

    effects.pendingType = effects.pendingType || readPlacementPendingType(move);

    return effects;
}

const PlacementEffects = {
    setUIImpl,
    applyProtectionAfterMove,
    logPlacementEffects
};

export = PlacementEffects;
