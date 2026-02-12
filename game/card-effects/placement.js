/**
 * @file placement.js
 * @description Placement-triggered effects (logs + apply)
 */

function logPlacementEffects(effects, player) {
    if (!effects) return;
    const ownerName = getPlayerDisplayName(player);

    if (effects.silverStoneUsed) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.silverCharge(effects.chargeGained));
    }
    if (effects.goldStoneUsed) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.goldCharge(effects.chargeGained));
    }
    if (effects.plunderAmount > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.plunderPoints(effects.plunderAmount));
    }
    if (effects.stolenCount > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.plunderCards(effects.stolenCount, effects.resaleGain));
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
    if (effects.ultimateDestroyGodPlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.udgPlaced(ownerName));
    }
    if (effects.ultimateHyperactivePlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.ultimateHyperactivePlaced(ownerName));
    }
    if (effects.hyperactivePlaced) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactivePlaced(ownerName));
    }
    if (effects.doublePlaceActivated) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.doublePlaceActivated());
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

    effects.pendingType = effects.pendingType || (cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[getPlayerKey(move.player)] && cardState.pendingEffectByPlayer[getPlayerKey(move.player)].type);

    return effects;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { applyProtectionAfterMove, logPlacementEffects };
}
