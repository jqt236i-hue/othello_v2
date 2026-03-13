/**
 * @file teleport.js
 * @description Teleport Will card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

function getTeleportSelectionPrompt(pendingType) {
    return pendingType === 'CELL_TELEPORT_WILL'
        ? 'マステレポートさせるマスを選んでください'
        : 'テレポートさせる石を選んでください';
}

async function handleTeleportSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || (pending.type !== 'TELEPORT_WILL' && pending.type !== 'CELL_TELEPORT_WILL') || pending.stage !== 'selectTarget') return;
        const pendingType = pending.type;

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { teleportTarget: { row, col } })
            : { type: 'place', teleportTarget: { row, col } };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const result = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!result || result.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded(getTeleportSelectionPrompt(pendingType));
            return;
        }

        const selected = (result.rawEvents || []).find(e => e && e.type === 'teleport_selected');
        if (!selected || !selected.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded(getTeleportSelectionPrompt(pendingType));
            return;
        }

        if (result.nextCardState) cardState = result.nextCardState;
        if (result.nextGameState) gameState = result.nextGameState;

        if (result.playbackEvents && result.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: result.playbackEvents,
                meta: { cause: pendingType, target: { row, col } }
            });
        }

        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        if (typeof emitGameStateChange === 'function') emitGameStateChange();
        shouldCheckAutoPass = true;
    } finally {
        isProcessing = false;
        isCardAnimating = false;
        if (shouldCheckAutoPass && typeof ensureCurrentPlayerCanActOrPass === 'function') {
            try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleTeleportSelection };
}
