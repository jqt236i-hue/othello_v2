/**
 * @file position-swap.js
 * @description Position Swap Will card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

async function handlePositionSwapSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'POSITION_SWAP_WILL' || pending.stage !== 'selectTarget') return;

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { positionSwapTarget: { row, col } })
            : { type: 'place', positionSwapTarget: { row, col } };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res || res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded('入替対象の石を選んでください');
            return;
        }

        const firstSelected = (res.rawEvents || []).find(e => e && e.type === 'position_swap_first_selected');
        const swapped = (res.rawEvents || []).find(e => e && e.type === 'position_swap_selected' && e.applied && e.completed);
        if (!firstSelected && !swapped) {
            if (typeof emitLogAdded === 'function') emitLogAdded('入替対象の石を選んでください');
            return;
        }

        if (res.nextCardState) cardState = res.nextCardState;
        if (res.nextGameState) gameState = res.nextGameState;

        if (res.playbackEvents && res.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: res.playbackEvents,
                meta: { cause: 'POSITION_SWAP_WILL', target: { row, col } }
            });
        }

        if (typeof emitLogAdded === 'function') {
            if (swapped) {
                emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}が入替の意志で${posToNotation(swapped.from.row, swapped.from.col)}と${posToNotation(swapped.to.row, swapped.to.col)}を入替`);
            } else {
                emitLogAdded('入替の意志: 2つ目の石を選んでください');
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
    module.exports = { handlePositionSwapSelection };
}
