/**
 * @file destroy.js
 * @description Destroy card handlers
 */

var PendingSelectionFlow;
if (typeof require === 'function') {
    try { PendingSelectionFlow = require('./selection-flow'); } catch (e) { /* ignore */ }
}
if (!PendingSelectionFlow && typeof globalThis !== 'undefined' && globalThis.PendingSelectionFlow) {
    PendingSelectionFlow = globalThis.PendingSelectionFlow;
}

var DestroyOutcomeContract;
if (typeof require === 'function') {
    try { DestroyOutcomeContract = require('../../shared/destroy-outcome-contract'); } catch (e) { /* ignore */ }
}
if (!DestroyOutcomeContract && typeof globalThis !== 'undefined' && globalThis.DestroyOutcomeContract) {
    DestroyOutcomeContract = globalThis.DestroyOutcomeContract;
}
var DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS) || Object.freeze({
    DESTROYED: 'destroyed',
    REGENERATED: 'regenerated',
    GHOST_BLOCKED: 'ghost_blocked',
    PROLIFERATED: 'proliferated',
    EVADED_MOVE: 'evaded_move'
});

function getDestroyOutcomeKind(result) {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.getDestroyOutcomeKind === 'function') {
        return DestroyOutcomeContract.getDestroyOutcomeKind(result);
    }
    if (!result || typeof result !== 'object') return null;
    if (result.regenerated === true) return DESTROY_OUTCOME_KINDS.REGENERATED;
    if (result.proliferated === true) return DESTROY_OUTCOME_KINDS.PROLIFERATED;
    if (result.blockedByGhost === true) return DESTROY_OUTCOME_KINDS.GHOST_BLOCKED;
    if (result.evaded === true) return DESTROY_OUTCOME_KINDS.EVADED_MOVE;
    if (result.destroyed === true) return DESTROY_OUTCOME_KINDS.DESTROYED;
    return null;
}

function isDestroyOutcomeResolved(result) {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
        return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
    }
    return getDestroyOutcomeKind(result) !== null;
}

function getDestroySelectPrompt() {
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroySelectPrompt === 'function') {
        return LOG_MESSAGES.destroySelectPrompt();
    }
    return '破壊する石を選んでください';
}

function getDestroyRejectedMessage(context) {
    if (context && context.result && context.result.ok === false && typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroyFailed === 'function') {
        return LOG_MESSAGES.destroyFailed();
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
    if (typeof emitLogAdded !== 'function') return;
    const selected = context && context.result && Array.isArray(context.result.rawEvents)
        ? context.result.rawEvents.find((event) => event && event.type === 'destroy_selected')
        : null;
    const outcomeKind = getDestroyOutcomeKind(selected);
    const playerLabel = playerKey === 'black' ? '黒' : '白';
    const posText = posToNotation(row, col);
    if (outcomeKind === DESTROY_OUTCOME_KINDS.PROLIFERATED) {
        emitLogAdded(`${playerLabel}が破壊神で ${posText} を狙うと、石は残ったまま増殖した`);
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.REGENERATED) {
        emitLogAdded(`${playerLabel}が破壊神で ${posText} を狙ったが復活された`);
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED) {
        emitLogAdded(`${playerLabel}が破壊神で ${posText} を狙ったが幽体化で無効化された`);
        return;
    }
    if (outcomeKind === DESTROY_OUTCOME_KINDS.EVADED_MOVE) {
        emitLogAdded(`${playerLabel}が破壊神で ${posText} を狙ったが回避された`);
        return;
    }
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroyApplied === 'function') {
        emitLogAdded(LOG_MESSAGES.destroyApplied(playerLabel, posText));
        return;
    }
    emitLogAdded(`${playerLabel}が${posText}を破壊`);
}

async function handleDestroySelection(row, col, playerKey) {
    if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getSelectableTargets === 'function') {
        const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
        const allowed = targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) {
            if (typeof emitLogAdded === 'function') emitLogAdded(getDestroySelectPrompt());
            return;
        }
    }
    return executeDestroy(row, col, playerKey);
}

async function executeDestroy(row, col, playerKey) {
    if (!PendingSelectionFlow || typeof PendingSelectionFlow.executePendingSelection !== 'function') return;
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleDestroySelection, executeDestroy };
}
