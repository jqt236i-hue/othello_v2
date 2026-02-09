/**
 * @file sacrifice.js
 * @description Sacrifice Will card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

async function handleSacrificeSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { sacrificeTarget: { row, col } })
            : { type: 'place', sacrificeTarget: { row, col } };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res || res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded('自分の石を選んでください');
            return;
        }

        const selected = (res.rawEvents || []).find(e => e && e.type === 'sacrifice_selected');
        if (!selected || !selected.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded('自分の石を選んでください');
            return;
        }

        if (res.nextCardState) cardState = res.nextCardState;
        if (res.nextGameState) gameState = res.nextGameState;

        if (res.playbackEvents && res.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: res.playbackEvents,
                meta: { cause: 'SACRIFICE_WILL', target: { row, col } }
            });
        }

        const playerLabel = playerKey === 'black' ? '黒' : '白';
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${playerLabel}が生贄の意志で ${posToNotation(row, col)} を破壊（+${selected.gained || 0}）`);
            if (selected.completed) {
                emitLogAdded(`${playerLabel}の生贄の意志を終了`);
            } else {
                const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
                if (pending && pending.type === 'SACRIFICE_WILL') {
                    const remain = Math.max(0, (pending.maxSelections || 3) - (pending.selectedCount || 0));
                    emitLogAdded(`生贄の意志: あと${remain}回選択できます`);
                }
            }
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
    module.exports = { handleSacrificeSelection };
}
