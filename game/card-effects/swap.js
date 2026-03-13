/**
 * @file swap.js
 * @description Swap With Enemy card handlers
 */

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

function captureNetworkPublishSnapshot(gameStateValue, cardStateValue) {
    if (!gameStateValue || !cardStateValue) return null;
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
            return {
                gameState: globalThis.structuredClone(gameStateValue),
                cardState: globalThis.structuredClone(cardStateValue)
            };
        }
    } catch (e) { /* ignore */ }

    try {
        return {
            gameState: JSON.parse(JSON.stringify(gameStateValue)),
            cardState: JSON.parse(JSON.stringify(cardStateValue))
        };
    } catch (e) {
        return null;
    }
}

function publishSwapNetworkSnapshot(playerKey, playbackEvents, snapshotOverride) {
    try {
        if (typeof globalThis === 'undefined' || !globalThis.NetworkMatchClient) return;
        if (typeof globalThis.NetworkMatchClient.publishSnapshot !== 'function') return;
        if (typeof globalThis.NetworkMatchClient.isActive === 'function' && !globalThis.NetworkMatchClient.isActive()) return;
        const meta = {
            playerKey: playerKey || 'black',
            actionType: 'place',
            playbackEvents: Array.isArray(playbackEvents) ? playbackEvents : []
        };
        if (snapshotOverride) meta.snapshot = snapshotOverride;
        globalThis.NetworkMatchClient.publishSnapshot(meta);
    } catch (e) { /* ignore */ }
}

function isSwapHumanVsHumanModeEnabled() {
    const debugHvH = (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
    let matchMode = null;
    try {
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return debugHvH || matchMode === 'network';
}

async function waitForSwapPlaybackIdle(playbackEvents) {
    if (!Array.isArray(playbackEvents) || !playbackEvents.length) return;

    const waitForPlaybackFn = (typeof waitForPlaybackIdle === 'function')
        ? waitForPlaybackIdle
        : ((typeof globalThis !== 'undefined' && typeof globalThis.waitForPlaybackIdle === 'function')
            ? globalThis.waitForPlaybackIdle
            : null);

    if (typeof waitForPlaybackFn !== 'function') return;

    try {
        await waitForPlaybackFn();
    } catch (e) { /* ignore */ }
}

function scheduleSwapWhiteCpuTurn(delayMs, expectedTurnNumber) {
    const safeDelay = Number.isFinite(delayMs) ? delayMs : 0;
    const tid = setTimeout(() => {
        const currentPlayer = gameState ? gameState.currentPlayer : null;
        const currentTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
        const isWhiteTurn = currentPlayer === 'white' || currentPlayer === -1 || currentPlayer === '-1' ||
            (typeof WHITE !== 'undefined' && currentPlayer === WHITE);
        if (!isWhiteTurn) return;
        if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) return;
        if (typeof processCpuTurn === 'function') processCpuTurn();
    }, safeDelay);
    if (tid && typeof tid.unref === 'function') tid.unref();
}

async function continueAfterSwapTurnHandoff(playerKey, playbackEvents) {
    const basePlaybackEvents = Array.isArray(playbackEvents) ? playbackEvents : [];
    const publishSnapshotOverride = captureNetworkPublishSnapshot(gameState, cardState);

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        publishSwapNetworkSnapshot(playerKey, basePlaybackEvents, publishSnapshotOverride);
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return;
    }

    await waitForSwapPlaybackIdle(basePlaybackEvents);

    let turnStartPlaybackEvents = [];
    if (typeof onTurnStart === 'function') {
        try {
            const turnStartResult = await onTurnStart(gameState.currentPlayer);
            if (turnStartResult && Array.isArray(turnStartResult.playbackEvents)) {
                turnStartPlaybackEvents = turnStartResult.playbackEvents;
            }
        } catch (e) { /* ignore */ }
    }

    const combinedPlaybackEvents = basePlaybackEvents.slice();
    if (turnStartPlaybackEvents.length) {
        combinedPlaybackEvents.push(...turnStartPlaybackEvents);
    }
    publishSwapNetworkSnapshot(playerKey, combinedPlaybackEvents, publishSnapshotOverride);

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return;
    }

    const currentPlayer = gameState ? gameState.currentPlayer : null;
    const isWhiteTurn = currentPlayer === 'white' || currentPlayer === -1 || currentPlayer === '-1' ||
        (typeof WHITE !== 'undefined' && currentPlayer === WHITE);
    const humanMode = isSwapHumanVsHumanModeEnabled();

    if (isWhiteTurn) {
        isProcessing = !humanMode;
        if (!humanMode) {
            const expectedTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
            const safeCpuDelay = (typeof CPU_TURN_DELAY_MS !== 'undefined') ? CPU_TURN_DELAY_MS : 600;
            scheduleSwapWhiteCpuTurn(safeCpuDelay, expectedTurnNumber);
        }
        return;
    }

    isProcessing = false;
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
}

async function handleSwapSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;
    let shouldContinueTurnHandoff = false;
    let swapPlaybackEvents = [];

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'SWAP_WITH_ENEMY' || pending.stage !== 'selectTarget') return;

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { swapTarget: { row, col }, deferNetworkPublish: true })
            : { type: 'place', swapTarget: { row, col }, deferNetworkPublish: true };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res || res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.swapSelectPrompt());
            return;
        }

        const selected = (res.rawEvents || []).find(e => e && e.type === 'swap_selected');
        if (!selected || !selected.swapped) {
            if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.swapSelectPrompt());
            return;
        }

        if (res.nextCardState) cardState = res.nextCardState;
        if (res.nextGameState) gameState = res.nextGameState;

        swapPlaybackEvents = Array.isArray(res.playbackEvents) ? res.playbackEvents : [];

        if (swapPlaybackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: swapPlaybackEvents,
                meta: { cause: 'SWAP_WITH_ENEMY', target: { row, col } }
            });
        }

        if (typeof emitLogAdded === 'function') {
            emitLogAdded(LOG_MESSAGES.swapApplied(playerKey === 'black' ? '黒' : '白', posToNotation(row, col)));
        }

        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        if (typeof emitGameStateChange === 'function') emitGameStateChange();
        shouldContinueTurnHandoff = true;
    } finally {
        isProcessing = false;
        isCardAnimating = false;
        if (shouldContinueTurnHandoff) {
            try {
                await continueAfterSwapTurnHandoff(playerKey, swapPlaybackEvents);
            } catch (e) {
                if (typeof ensureCurrentPlayerCanActOrPass === 'function') {
                    try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (ignore) { /* ignore */ }
                }
            }
        } else if (shouldCheckAutoPass && typeof ensureCurrentPlayerCanActOrPass === 'function') {
            try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleSwapSelection };
}
