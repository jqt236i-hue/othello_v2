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
    return !!(selected && selected.destroyed === true);
}

function emitDestroyAppliedLog(playerKey, row, col) {
    if (typeof emitLogAdded !== 'function') return;
    if (typeof LOG_MESSAGES !== 'undefined' && LOG_MESSAGES && typeof LOG_MESSAGES.destroyApplied === 'function') {
        emitLogAdded(LOG_MESSAGES.destroyApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));
        return;
    }
    emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}が${posToNotation(row, col)}を破壊`);
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
        afterStateChange: () => {
            emitDestroyAppliedLog(playerKey, row, col);
        }
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleDestroySelection, executeDestroy };
}
