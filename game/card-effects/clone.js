/**
 * @file clone.js
 * @description Clone Will card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

async function handleCloneLikeSelection(row, col, playerKey, config) {
    const cfg = config || {};
    const pendingType = String(cfg.pendingType || 'CLONE_WILL');
    const actionTargetKey = String(cfg.actionTargetKey || 'cloneTarget');
    const selectedEventType = String(cfg.selectedEventType || 'clone_selected');
    const selectionFailLog = String(cfg.selectionFailLog || '周囲に空きがある自分の石を選んでください');
    const playbackCause = String(cfg.playbackCause || pendingType);
    const successLogBuilder = typeof cfg.successLogBuilder === 'function'
        ? cfg.successLogBuilder
        : ((spawnedCount) => `複製の意志: ${spawnedCount}個を生成`);

    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') return;

        const actionPayload = {
            [actionTargetKey]: { row, col }
        };

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, actionPayload)
            : { type: 'place', ...actionPayload };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res || res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded(selectionFailLog);
            return;
        }

        const selected = (res.rawEvents || []).find(e => e && e.type === selectedEventType);
        if (!selected || !selected.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded(selectionFailLog);
            return;
        }

        if (res.nextCardState) cardState = res.nextCardState;
        if (res.nextGameState) gameState = res.nextGameState;

        if (res.playbackEvents && res.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: res.playbackEvents,
                meta: { cause: playbackCause, target: { row, col } }
            });
        }

        if (typeof emitLogAdded === 'function') {
            const spawnedCount = Array.isArray(selected.spawned) ? selected.spawned.length : 0;
            emitLogAdded(successLogBuilder(spawnedCount, selected));
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

async function handleCloneSelection(row, col, playerKey) {
    return handleCloneLikeSelection(row, col, playerKey, {
        pendingType: 'CLONE_WILL',
        actionTargetKey: 'cloneTarget',
        selectedEventType: 'clone_selected',
        selectionFailLog: '周囲に空きがある自分の石を選んでください',
        playbackCause: 'CLONE_WILL',
        successLogBuilder: (spawnedCount) => `複製の意志: ${spawnedCount}個を生成`
    });
}

async function handleSplitSelection(row, col, playerKey) {
    return handleCloneLikeSelection(row, col, playerKey, {
        pendingType: 'SPLIT_WILL',
        actionTargetKey: 'splitTarget',
        selectedEventType: 'split_selected',
        selectionFailLog: '周囲に空きがある自分の石を選んでください',
        playbackCause: 'SPLIT_WILL',
        successLogBuilder: (spawnedCount) => `分裂の意志: ${spawnedCount}個を生成（持続ターン半減）`
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleCloneSelection, handleSplitSelection };
}
