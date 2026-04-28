// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let cachedPendingCoordinator: any = null;

function resolvePendingCoordinator(): any {
    if (cachedPendingCoordinator && typeof cachedPendingCoordinator === 'object') {
        return cachedPendingCoordinator;
    }
    try {
        cachedPendingCoordinator = _require('../turn/pending-coordinator');
    } catch (e) { /* ignore */ }
    return cachedPendingCoordinator;
}

function readPlacementPendingType(move: any): string | null {
    if (!move) return null;
    const playerKey = typeof (globalThis as any).getPlayerKey === 'function' ? (globalThis as any).getPlayerKey(move.player) : null;
    if (!playerKey) return null;
    const activeCardState = (typeof (globalThis as any).cardState !== 'undefined' && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object')
        ? (globalThis as any).cardState
        : null;
    if (!activeCardState) return null;

    const pendingCoordinator = resolvePendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.getPendingEffectType === 'function') {
        return pendingCoordinator.getPendingEffectType(activeCardState, playerKey);
    }
    return (activeCardState.pendingEffectByPlayer
        && activeCardState.pendingEffectByPlayer[playerKey]
        && activeCardState.pendingEffectByPlayer[playerKey].type) || null;
}

function logPlacementEffects(effects: any, player: any): void {
    if (!effects) return;
    const ownerName = (globalThis as any).getPlayerDisplayName(player);

    if (effects.rainbowStoneUsed) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.rainbowCharge(effects.chargeGained));
    }
    if (effects.silverStoneUsed) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.silverCharge(effects.chargeGained));
    }
    if (effects.goldStoneUsed) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.goldCharge(effects.chargeGained));
    }
    if (effects.crystalStoneUsed) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.crystalCharge(effects.crystalStoneGain || 0));
    }
    if (effects.plunderAmount > 0) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.plunderPoints(effects.plunderAmount));
    }
    if (effects.protected) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.protectNext(ownerName));
        if ((globalThis as any).isDebugLogAvailable && (globalThis as any).isDebugLogAvailable()) {
            (globalThis as any).debugLog('[EFFECT] Protected stone formed (UI-only)', 'info');
        }
    }
    if (effects.permaProtected) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.permaProtectNext(ownerName));
    }
    if (effects.bombPlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.timeBombPlaced(ownerName));
    }
    if (effects.dragonPlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.dragonPlaced(ownerName));
    }
    if (effects.destroyDragonPlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function' && typeof (globalThis as any).LOG_MESSAGES.destroyDragonPlaced === 'function') {
            (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.destroyDragonPlaced(ownerName));
        }
    }
    if (effects.ultimateDestroyGodPlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.udgPlaced(ownerName));
    }
    if (effects.ultimateHyperactivePlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.ultimateHyperactivePlaced(ownerName));
    }
    if (effects.escapeHyperactivePlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function' && typeof (globalThis as any).LOG_MESSAGES.escapeHyperactivePlaced === 'function') {
            (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.escapeHyperactivePlaced(ownerName));
        }
    } else if (effects.extremeHyperactivePlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function' && typeof (globalThis as any).LOG_MESSAGES.extremeHyperactivePlaced === 'function') {
            (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.extremeHyperactivePlaced(ownerName));
        }
    } else if (effects.hyperactivePlaced) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.hyperactivePlaced(ownerName));
    }
    if (effects.doublePlaceActivated) {
        if (typeof (globalThis as any).emitLogAdded === 'function') {
            (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.doublePlaceActivated(
                effects.multiPlaceActivatedName,
                effects.multiPlaceRemaining,
                effects.multiPlaceInfinite
            ));
        }
    }
}

function applyProtectionAfterMove(move: any, effects: any): any {
    if (!move) return null;
    if (!effects) {
        console.warn('[EFFECT-APPLY] applyProtectionAfterMove called without effects; nothing to apply');
        return null;
    }

    const ownerName = (globalThis as any).getPlayerDisplayName(move.player);

    logPlacementEffects(effects, move.player);

    if (effects.protected) {
        if ((globalThis as any).isDebugLogAvailable && (globalThis as any).isDebugLogAvailable()) {
            (globalThis as any).debugLog('[EFFECT] Protected stone formed at (' + move.row + ',' + move.col + ')', 'info');
        }
    }

    if (effects.regenTriggered && effects.regenTriggered > 0) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.regenTriggered(effects.regenTriggered));
    }
    if (effects.regenCapture && effects.regenCapture > 0) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.regenCapture(effects.regenCapture));
    }
    if (effects.breedingSpawned && effects.breedingSpawned > 0) {
        if (typeof (globalThis as any).emitLogAdded === 'function') (globalThis as any).emitLogAdded((globalThis as any).LOG_MESSAGES.breedingSpawned((globalThis as any).getPlayerName(move.player), effects.breedingSpawned));
    }

    effects.pendingType = effects.pendingType || readPlacementPendingType(move);

    return effects;
}

const PlacementEffects = {
    applyProtectionAfterMove,
    logPlacementEffects
};

export = PlacementEffects;
