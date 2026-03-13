/**
 * @file destroy.js
 * @description Destroy card handlers
 */

// Use centralized presentation helper
var BoardPresentation = null;
if (typeof require === 'function') {
    try { BoardPresentation = require('../logic/presentation'); } catch (e) { /* ignore */ }
}
if (!BoardPresentation && typeof globalThis !== 'undefined' && globalThis.PresentationHelper) {
    BoardPresentation = globalThis.PresentationHelper;
}
function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    try { console.warn('[destroy] Presentation helper not available'); } catch (e) { }
    return false;
} 

function applyPipelineStateResult(result) {
    if (result && result.nextCardState) {
        if (cardState && typeof cardState === 'object') {
            for (const key in cardState) delete cardState[key];
            Object.assign(cardState, result.nextCardState);
        } else {
            cardState = result.nextCardState;
        }
        try {
            if (typeof globalThis !== 'undefined') globalThis.cardState = cardState;
        } catch (e) { /* ignore */ }
    }

    if (result && result.nextGameState) {
        if (gameState && typeof gameState === 'object') {
            for (const key in gameState) delete gameState[key];
            Object.assign(gameState, result.nextGameState);
        } else {
            gameState = result.nextGameState;
        }
        try {
            if (typeof globalThis !== 'undefined') globalThis.gameState = gameState;
        } catch (e) { /* ignore */ }
    }
}

async function handleDestroySelection(row, col, playerKey) {
    if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getSelectableTargets === 'function') {
        const targets = CardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
        const allowed = targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) {
            if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.destroySelectPrompt());
            return;
        }
    }
    await executeDestroy(row, col, playerKey);
}

async function executeDestroy(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        // Run destroy as an action through the TurnPipeline to ensure single writer
        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { destroyTarget: { row, col } })
            : { type: 'place', destroyTarget: { row, col } };

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res) {
            // Pipeline not available: cannot apply rule-side destroy from UI. Reject action.
            console.error('[DESTROY] TurnPipeline not available; destroy aborted');
            if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.destroyFailed());
            return;
        }

        if (res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.destroyFailed());
            return;
        }

        applyPipelineStateResult(res);

        // Emit playback request to UI via presentationEvents (UI/PlaybackEngine should consume and play)
        if (res.playbackEvents && res.playbackEvents.length) {
            emitPresentationEventViaBoardOps({ type: 'PLAYBACK_EVENTS', events: res.playbackEvents, meta: { row, col, cause: 'DESTROY' } });
        }

        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.destroyApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));
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

// UI attachments are now the responsibility of the UI layer (ui/handlers/*). Export functions for import by UI.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleDestroySelection, executeDestroy };
}
