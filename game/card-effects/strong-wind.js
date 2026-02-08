/**
 * @file strong-wind.js
 * @description Strong Wind Will card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    try { console.warn('[strong-wind] Presentation helper not available'); } catch (e) { /* ignore */ }
    return false;
}

async function handleStrongWindSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { strongWindTarget: { row, col } })
            : { type: 'place', strongWindTarget: { row, col } };

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const result = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!result || result.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded('移動可能な石を選んでください');
            return;
        }

        if (result.nextCardState) cardState = result.nextCardState;
        if (result.nextGameState) gameState = result.nextGameState;

        if (result.playbackEvents && result.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: result.playbackEvents,
                meta: { cause: 'STRONG_WIND_WILL', target: { row, col } }
            });
        }

        const playerLabel = playerKey === 'black' ? '黒' : '白';
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${playerLabel}が強風の意志を発動`);
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
    module.exports = { handleStrongWindSelection };
}
