/**
 * @file board-expansion.js
 * @description Board Expansion Will card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

function playBoardExpansionRevealSound() {
    try {
        if (typeof SoundEngine !== 'undefined' && SoundEngine && typeof SoundEngine.playEffectByKey === 'function') {
            SoundEngine.init();
            SoundEngine.playEffectByKey('board_expansion_reveal');
        }
    } catch (e) { /* ignore */ }
}

async function handleBoardExpansionSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || (pending.type !== 'BOARD_EXPANSION_WILL' && pending.type !== 'BOARD_EXPANSION_GOD') || pending.stage !== 'selectTarget') return;
        const invalidTargetMessage = pending.type === 'BOARD_EXPANSION_GOD'
            ? '角マスを選んで盤面を拡張してください'
            : '左右端マスを選んで盤面を拡張してください';

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { expansionTarget: { row, col } })
            : { type: 'place', expansionTarget: { row, col } };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res || res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded(invalidTargetMessage);
            return;
        }

        const firstSelected = (res.rawEvents || []).find(e => e && e.type === 'board_expansion_first_selected' && e.applied);
        const selected = (res.rawEvents || []).find(e => e && e.type === 'board_expansion_selected' && e.applied && e.completed !== false);
        if (!firstSelected && !selected) {
            if (typeof emitLogAdded === 'function') emitLogAdded(invalidTargetMessage);
            return;
        }

        if (res.nextCardState) cardState = res.nextCardState;
        if (res.nextGameState) gameState = res.nextGameState;

        if (res.playbackEvents && res.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: res.playbackEvents,
                meta: { cause: pending.type, target: { row, col } }
            });
        }

        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        if (typeof emitGameStateChange === 'function') emitGameStateChange();
        // Board expansion currently has no visual playback phase, so play after sync requests.
        if (selected) playBoardExpansionRevealSound();
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
    module.exports = { handleBoardExpansionSelection };
}
