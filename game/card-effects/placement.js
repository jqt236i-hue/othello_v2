/**
 * @file placement.js
 * @description Placement-triggered effects (logs + apply)
 */

let cachedPendingCoordinator = null;

function resolvePendingCoordinator() {
    if (cachedPendingCoordinator && typeof cachedPendingCoordinator === 'object') {
        return cachedPendingCoordinator;
    }
    if (typeof require === 'function') {
        try {
            cachedPendingCoordinator = require('../turn/pending-coordinator');
        } catch (e) { /* ignore */ }
    }
    return cachedPendingCoordinator;
}

function readPlacementPendingType(move) {
    if (!move) return null;
    const playerKey = typeof getPlayerKey === 'function' ? getPlayerKey(move.player) : null;
    if (!playerKey) return null;
    const activeCardState = (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
        ? cardState
        : ((typeof globalThis !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object')
            ? globalThis.cardState
            : null);
    if (!activeCardState) return null;

    const pendingCoordinator = resolvePendingCoordinator();
    if (pendingCoordinator && typeof pendingCoordinator.getPendingEffectType === 'function') {
        return pendingCoordinator.getPendingEffectType(activeCardState, playerKey);
    }
    return (activeCardState.pendingEffectByPlayer
        && activeCardState.pendingEffectByPlayer[playerKey]
        && activeCardState.pendingEffectByPlayer[playerKey].type) || null;
}

function logPlacementEffects(effects, player) {
    if (!effects) return;
    const ownerName = getPlayerDisplayName(player);

    if (effects.rainbowStoneUsed) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.rainbowCharge(effects.chargeGained));
    }
    if (effects.silverStoneUsed) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.silverCharge(effects.chargeGained));
    }
    if (effects.goldStoneUsed) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.goldCharge(effects.chargeGained));
    }
    if (effects.crystalStoneUsed) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.crystalCharge(effects.crystalStoneGain || 0));
    }
    if (effects.plunderAmount > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.plunderPoints(effects.plunderAmount));
    }
    if (effects.protected) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.protectNext(ownerName));
        if (isDebugLogAvailable()) {
            debugLog(`[EFFECT] Protected stone formed (UI-only)`, 'info');
        }
    }
    if (effects.permaProtected) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.permaProtectNext(ownerName));
    }
    if (effects.bombPlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.timeBombPlaced(ownerName));
    }
    if (effects.dragonPlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.dragonPlaced(ownerName));
    }
    if (effects.destroyDragonPlaced) {
        if (typeof emitLogAdded === 'function' && typeof LOG_MESSAGES.destroyDragonPlaced === 'function') {
            emitLogAdded(LOG_MESSAGES.destroyDragonPlaced(ownerName));
        }
    }
    if (effects.ultimateDestroyGodPlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.udgPlaced(ownerName));
    }
    if (effects.ultimateHyperactivePlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.ultimateHyperactivePlaced(ownerName));
    }
    if (effects.escapeHyperactivePlaced) {
        if (typeof emitLogAdded === 'function' && typeof LOG_MESSAGES.escapeHyperactivePlaced === 'function') {
            emitLogAdded(LOG_MESSAGES.escapeHyperactivePlaced(ownerName));
        }
    } else if (effects.extremeHyperactivePlaced) {
        if (typeof emitLogAdded === 'function' && typeof LOG_MESSAGES.extremeHyperactivePlaced === 'function') {
            emitLogAdded(LOG_MESSAGES.extremeHyperactivePlaced(ownerName));
        }
    } else if (effects.hyperactivePlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactivePlaced(ownerName));
    }
    if (effects.doublePlaceActivated) {
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(LOG_MESSAGES.doublePlaceActivated(
                effects.multiPlaceActivatedName,
                effects.multiPlaceRemaining,
                effects.multiPlaceInfinite
            ));
        }
    }
}

/**
 * Apply protection and special effects after a move
 * Uses CardLogic for state updates, then logs/animates results.
 * @param {Move} move
 */
function applyProtectionAfterMove(move, effects) {
    // Updated: UI shouldn't call CardLogic directly. This function now consumes
    // effects computed by the pipeline and logs/animates them for the UI.
    if (!move) return null;
    if (!effects) {
        console.warn('[EFFECT-APPLY] applyProtectionAfterMove called without effects; nothing to apply');
        return null;
    }

    const ownerName = getPlayerDisplayName(move.player);

    // Delegate logging for standard placement messages to the shared logger
    logPlacementEffects(effects, move.player);

    // Extra locale/debug info retained here
    if (effects.protected) {
        if (isDebugLogAvailable()) {
            debugLog(`[EFFECT] Protected stone formed at (${move.row},${move.col})`, 'info');
        }
    }

    // REGEN and BREEDING: pipeline must have already produced events for these.
    if (effects.regenTriggered && effects.regenTriggered > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.regenTriggered(effects.regenTriggered));
    }
    if (effects.regenCapture && effects.regenCapture > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.regenCapture(effects.regenCapture));
    }
    if (effects.breedingSpawned && effects.breedingSpawned > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.breedingSpawned(getPlayerName(move.player), effects.breedingSpawned));
    }

    effects.pendingType = effects.pendingType || readPlacementPendingType(move);

    return effects;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyProtectionAfterMove, logPlacementEffects };
}
