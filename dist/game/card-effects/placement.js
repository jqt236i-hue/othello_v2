"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
let cachedPendingCoordinator = null;
function resolvePendingCoordinator() {
    if (cachedPendingCoordinator && typeof cachedPendingCoordinator === 'object') {
        return cachedPendingCoordinator;
    }
    try {
        cachedPendingCoordinator = _require('../turn/pending-coordinator');
    }
    catch (e) { /* ignore */ }
    return cachedPendingCoordinator;
}
function readPlacementPendingType(move) {
    if (!move)
        return null;
    const playerKey = typeof globalThis.getPlayerKey === 'function' ? globalThis.getPlayerKey(move.player) : null;
    if (!playerKey)
        return null;
    const activeCardState = (typeof globalThis.cardState !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object')
        ? globalThis.cardState
        : null;
    if (!activeCardState)
        return null;
    const pendingCoordinator = resolvePendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.getPendingEffectType === 'function') {
        return pendingCoordinator.getPendingEffectType(activeCardState, playerKey);
    }
    return (activeCardState.pendingEffectByPlayer
        && activeCardState.pendingEffectByPlayer[playerKey]
        && activeCardState.pendingEffectByPlayer[playerKey].type) || null;
}
function logPlacementEffects(effects, player) {
    if (!effects)
        return;
    const ownerName = globalThis.getPlayerDisplayName(player);
    if (effects.rainbowStoneUsed) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.rainbowCharge(effects.chargeGained));
    }
    if (effects.silverStoneUsed) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.silverCharge(effects.chargeGained));
    }
    if (effects.goldStoneUsed) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.goldCharge(effects.chargeGained));
    }
    if (effects.crystalStoneUsed) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.crystalCharge(effects.crystalStoneGain || 0));
    }
    if (effects.plunderAmount > 0) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.plunderPoints(effects.plunderAmount));
    }
    if (effects.protected) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.protectNext(ownerName));
        if (globalThis.isDebugLogAvailable && globalThis.isDebugLogAvailable()) {
            globalThis.debugLog('[EFFECT] Protected stone formed (UI-only)', 'info');
        }
    }
    if (effects.permaProtected) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.permaProtectNext(ownerName));
    }
    if (effects.bombPlaced) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.timeBombPlaced(ownerName));
    }
    if (effects.dragonPlaced) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.dragonPlaced(ownerName));
    }
    if (effects.destroyDragonPlaced) {
        if (typeof globalThis.emitLogAdded === 'function' && typeof globalThis.LOG_MESSAGES.destroyDragonPlaced === 'function') {
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyDragonPlaced(ownerName));
        }
    }
    if (effects.ultimateDestroyGodPlaced) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.udgPlaced(ownerName));
    }
    if (effects.ultimateHyperactivePlaced) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.ultimateHyperactivePlaced(ownerName));
    }
    if (effects.escapeHyperactivePlaced) {
        if (typeof globalThis.emitLogAdded === 'function' && typeof globalThis.LOG_MESSAGES.escapeHyperactivePlaced === 'function') {
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.escapeHyperactivePlaced(ownerName));
        }
    }
    else if (effects.extremeHyperactivePlaced) {
        if (typeof globalThis.emitLogAdded === 'function' && typeof globalThis.LOG_MESSAGES.extremeHyperactivePlaced === 'function') {
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.extremeHyperactivePlaced(ownerName));
        }
    }
    else if (effects.hyperactivePlaced) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.hyperactivePlaced(ownerName));
    }
    if (effects.doublePlaceActivated) {
        if (typeof globalThis.emitLogAdded === 'function') {
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.doublePlaceActivated(effects.multiPlaceActivatedName, effects.multiPlaceRemaining, effects.multiPlaceInfinite));
        }
    }
}
function applyProtectionAfterMove(move, effects) {
    if (!move)
        return null;
    if (!effects) {
        console.warn('[EFFECT-APPLY] applyProtectionAfterMove called without effects; nothing to apply');
        return null;
    }
    const ownerName = globalThis.getPlayerDisplayName(move.player);
    logPlacementEffects(effects, move.player);
    if (effects.protected) {
        if (globalThis.isDebugLogAvailable && globalThis.isDebugLogAvailable()) {
            globalThis.debugLog('[EFFECT] Protected stone formed at (' + move.row + ',' + move.col + ')', 'info');
        }
    }
    if (effects.regenTriggered && effects.regenTriggered > 0) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.regenTriggered(effects.regenTriggered));
    }
    if (effects.regenCapture && effects.regenCapture > 0) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.regenCapture(effects.regenCapture));
    }
    if (effects.breedingSpawned && effects.breedingSpawned > 0) {
        if (typeof globalThis.emitLogAdded === 'function')
            globalThis.emitLogAdded(globalThis.LOG_MESSAGES.breedingSpawned(globalThis.getPlayerName(move.player), effects.breedingSpawned));
    }
    effects.pendingType = effects.pendingType || readPlacementPendingType(move);
    return effects;
}
const PlacementEffects = {
    applyProtectionAfterMove,
    logPlacementEffects
};
module.exports = PlacementEffects;
//# sourceMappingURL=placement.js.map