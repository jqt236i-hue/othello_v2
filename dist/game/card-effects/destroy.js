"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
let PendingSelectionFlow;
try {
    PendingSelectionFlow = _require('./selection-flow');
}
catch (e) { /* ignore */ }
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}
let DestroyOutcomeContract;
try {
    DestroyOutcomeContract = _require('../../shared/destroy-outcome-contract');
}
catch (e) { /* ignore */ }
if (!DestroyOutcomeContract && typeof globalThis !== 'undefined' && globalThis.DestroyOutcomeContract) {
    DestroyOutcomeContract = globalThis.DestroyOutcomeContract;
}
const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS) || Object.freeze({
    DESTROYED: 'destroyed',
    REGENERATED: 'regenerated',
    LIVING_WILL_RESTORED: 'living_will_restored',
    GHOST_BLOCKED: 'ghost_blocked',
    PROLIFERATED: 'proliferated',
    EVADED_MOVE: 'evaded_move'
});
function getDestroyOutcomeKind(result) {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.getDestroyOutcomeKind === 'function') {
        return DestroyOutcomeContract.getDestroyOutcomeKind(result);
    }
    if (!result || typeof result !== 'object')
        return null;
    if (result.livingWillRevived === true)
        return DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED;
    if (result.regenerated === true)
        return DESTROY_OUTCOME_KINDS.REGENERATED;
    if (result.proliferated === true)
        return DESTROY_OUTCOME_KINDS.PROLIFERATED;
    if (result.blockedByGhost === true)
        return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
    if (result.evaded === true)
        return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
    if (result.destroyed === true)
        return DESTROY_OUTCOME_KINDS.DESTROYED;
    return null;
}
function isDestroyOutcomeResolved(result) {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
        return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
    }
    return getDestroyOutcomeKind(result) !== null;
}
function getDestroySelectPrompt() {
    if (typeof globalThis.LOG_MESSAGES !== 'undefined' && globalThis.LOG_MESSAGES && typeof globalThis.LOG_MESSAGES.destroySelectPrompt === 'function') {
        return globalThis.LOG_MESSAGES.destroySelectPrompt();
    }
    return '破壊する石を選んでください';
}
function getDestroyRejectedMessage(context) {
    if (context && context.result && context.result.ok === false && typeof globalThis.LOG_MESSAGES !== 'undefined' && globalThis.LOG_MESSAGES && typeof globalThis.LOG_MESSAGES.destroyFailed === 'function') {
        return globalThis.LOG_MESSAGES.destroyFailed();
    }
    return getDestroySelectPrompt();
}
function wasDestroySelectionApplied(result) {
    const selected = result && Array.isArray(result.rawEvents)
        ? result.rawEvents.find((event) => event && event.type === 'destroy_selected')
        : null;
    return !!(selected && (selected.applied === true || isDestroyOutcomeResolved(selected)));
}
function emitDestroyAppliedLog(context, playerKey, row, col) {
    if (typeof globalThis.emitLogAdded !== 'function')
        return;
    const selected = context && context.result && Array.isArray(context.result.rawEvents)
        ? context.result.rawEvents.find((event) => event && event.type === 'destroy_selected')
        : null;
    const outcomeKind = getDestroyOutcomeKind(selected);
    const playerLabel = playerKey === 'black' ? '黒' : '白';
    const posText = globalThis.posToNotation(row, col);
    if (outcomeKind === DESTROY_OUTCOME_KINDS.PROLIFERATED) {
        globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyProliferated(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.REGENERATED) {
        globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyRegenerated(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED) {
        globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyLivingWillRestored(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED) {
        globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyGhostBlocked(playerLabel, posText));
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.EVADED_MOVE) {
        globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyEvaded(playerLabel, posText));
        return;
    }
    if (typeof globalThis.LOG_MESSAGES !== 'undefined' && globalThis.LOG_MESSAGES && typeof globalThis.LOG_MESSAGES.destroyApplied === 'function') {
        globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyApplied(playerLabel, posText));
        return;
    }
    globalThis.emitLogAdded(globalThis.LOG_MESSAGES.destroyDefault(playerLabel, posText));
}
async function handleDestroySelection(row, col, playerKey) {
    if (typeof globalThis.CardLogic !== 'undefined' && globalThis.CardLogic && typeof globalThis.CardLogic.getSelectableTargets === 'function') {
        const targets = globalThis.CardLogic.getSelectableTargets(globalThis.cardState, globalThis.gameState, playerKey) || [];
        const allowed = targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) {
            if (typeof globalThis.emitLogAdded === 'function')
                globalThis.emitLogAdded(getDestroySelectPrompt());
            return;
        }
    }
    return executeDestroy(row, col, playerKey);
}
async function executeDestroy(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function')
        return;
    return PendingSelectionFlow.executePendingSelection({
        row,
        col,
        playerKey,
        pendingType: 'DESTROY_ONE_STONE',
        actionPayload: { destroyTarget: { row, col } },
        invalidMessage: getDestroyRejectedMessage,
        validateResult: ({ result }) => wasDestroySelectionApplied(result),
        buildPlaybackMeta: () => ({ row, col, cause: 'DESTROY' }),
        afterStateChange: (context) => {
            emitDestroyAppliedLog(context, playerKey, row, col);
        }
    });
}
const DestroyEffects = {
    handleDestroySelection,
    executeDestroy
};
module.exports = DestroyEffects;
//# sourceMappingURL=destroy.js.map