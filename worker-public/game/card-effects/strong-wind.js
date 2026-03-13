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

async function handleSuperBuoyancySelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'SUPER_BUOYANCY_WILL' || pending.stage !== 'selectTarget') return;

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { superBuoyancyTarget: { row, col } })
            : { type: 'place', superBuoyancyTarget: { row, col } };

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const result = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!result || result.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded('上へ移動させる石を選んでください');
            return;
        }

        const selected = (result.rawEvents || []).find(e => e && e.type === 'super_buoyancy_selected');
        if (!selected || !selected.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded('上へ移動させる石を選んでください');
            return;
        }

        if (result.nextCardState) cardState = result.nextCardState;
        if (result.nextGameState) gameState = result.nextGameState;

        if (result.playbackEvents && result.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: result.playbackEvents,
                meta: { cause: 'SUPER_BUOYANCY_WILL', target: { row, col } }
            });
        }

        const playerLabel = playerKey === 'black' ? '黒' : '白';
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${playerLabel}が超浮力を発動`);
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

async function handleSuperGravitySelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'SUPER_GRAVITY_WILL' || pending.stage !== 'selectTarget') return;

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { superGravityTarget: { row, col } })
            : { type: 'place', superGravityTarget: { row, col } };

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const result = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!result || result.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded('下へ移動させる石を選んでください');
            return;
        }

        const selected = (result.rawEvents || []).find(e => e && e.type === 'super_gravity_selected');
        if (!selected || !selected.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded('下へ移動させる石を選んでください');
            return;
        }

        if (result.nextCardState) cardState = result.nextCardState;
        if (result.nextGameState) gameState = result.nextGameState;

        if (result.playbackEvents && result.playbackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: result.playbackEvents,
                meta: { cause: 'SUPER_GRAVITY_WILL', target: { row, col } }
            });
        }

        const playerLabel = playerKey === 'black' ? '黒' : '白';
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${playerLabel}が超重力を発動`);
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
    module.exports = {
        handleStrongWindSelection,
        handleSuperBuoyancySelection,
        handleSuperGravitySelection
    };
}
