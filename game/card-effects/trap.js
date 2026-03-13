/**
 * @file trap.js
 * @description Trap Will card handlers
 */

let __uiImpl_trap = {};
function setUIImpl(obj) {
    __uiImpl_trap = Object.assign({}, __uiImpl_trap || {}, obj || {});
}

function getTrapBoardElement() {
    try {
        if (__uiImpl_trap && typeof __uiImpl_trap.getBoardElement === 'function') {
            return __uiImpl_trap.getBoardElement();
        }
    } catch (e) { /* ignore */ }
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.__uiImpl_trap &&
            typeof globalThis.__uiImpl_trap.getBoardElement === 'function'
        ) {
            return globalThis.__uiImpl_trap.getBoardElement();
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.boardEl && typeof globalThis.boardEl.querySelector === 'function') {
            return globalThis.boardEl;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    return false;
}

function _isTrapFlashVisibleForViewer(playerKey) {
    try {
        const root = (typeof globalThis !== 'undefined') ? globalThis : null;
        if (!root) return true;
        if (root.BOARD_VIEWER_KEY === 'black' || root.BOARD_VIEWER_KEY === 'white') {
            return root.BOARD_VIEWER_KEY === playerKey;
        }
        if (root.LOCAL_PLAYER_KEY === 'black' || root.LOCAL_PLAYER_KEY === 'white') {
            return root.LOCAL_PLAYER_KEY === playerKey;
        }
        // Local HvH: currently operating side is the viewer.
        if (root.DEBUG_HUMAN_VS_HUMAN === true) return true;
    } catch (e) { /* ignore */ }
    return true;
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

function publishTrapNetworkSnapshot(playerKey, playbackEvents, snapshotOverride) {
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

function isTrapHumanVsHumanModeEnabled() {
    const debugHvH = (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
    let matchMode = null;
    try {
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return debugHvH || matchMode === 'network';
}

async function waitForTrapPlaybackIdle(playbackEvents) {
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

function scheduleTrapWhiteCpuTurn(delayMs, expectedTurnNumber) {
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

async function continueAfterTrapTurnHandoff(playerKey, playbackEvents) {
    const basePlaybackEvents = Array.isArray(playbackEvents) ? playbackEvents : [];
    const publishSnapshotOverride = captureNetworkPublishSnapshot(gameState, cardState);

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        publishTrapNetworkSnapshot(playerKey, basePlaybackEvents, publishSnapshotOverride);
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return;
    }

    await waitForTrapPlaybackIdle(basePlaybackEvents);

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
    publishTrapNetworkSnapshot(playerKey, combinedPlaybackEvents, publishSnapshotOverride);

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return;
    }

    const currentPlayer = gameState ? gameState.currentPlayer : null;
    const isWhiteTurn = currentPlayer === 'white' || currentPlayer === -1 || currentPlayer === '-1' ||
        (typeof WHITE !== 'undefined' && currentPlayer === WHITE);
    const humanMode = isTrapHumanVsHumanModeEnabled();

    if (isWhiteTurn) {
        isProcessing = !humanMode;
        if (!humanMode) {
            const expectedTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
            const safeCpuDelay = (typeof CPU_TURN_DELAY_MS !== 'undefined') ? CPU_TURN_DELAY_MS : 600;
            scheduleTrapWhiteCpuTurn(safeCpuDelay, expectedTurnNumber);
        }
        return;
    }

    isProcessing = false;
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
}

function _playTrapPlacementFlash(row, col, playerKey) {
    if (!_isTrapFlashVisibleForViewer(playerKey)) return;

    const imagePath = playerKey === 'black'
        ? 'assets/images/stones/trap_stone-black.png'
        : 'assets/images/stones/trap_stone-white.png';
    const flashId = `trapflash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const durationMs = 760;
    const stepMs = 90;
    const endAt = Date.now() + durationMs;

    function ensureOverlay() {
        const board = getTrapBoardElement();
        if (!board || typeof board.querySelector !== 'function') return null;
        const cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return null;
        const baseDisc = cell.querySelector('.disc');
        if (!baseDisc) return null;
        const domDoc = cell.ownerDocument;
        if (!domDoc || typeof domDoc.createElement !== 'function') return null;

        let overlay = cell.querySelector(`.trap-place-overlay[data-trap-flash-id="${flashId}"]`);
        if (!overlay) {
            overlay = domDoc.createElement('div');
            overlay.className = 'disc special-stone trap-stone trap-place-flash trap-place-overlay';
            overlay.dataset.trapFlashId = flashId;
            cell.appendChild(overlay);
        }
        try {
            overlay.style.setProperty('--special-stone-image', `url('${imagePath}')`);
        } catch (e) { /* ignore */ }
        return overlay;
    }

    function clearOverlay() {
        const board = getTrapBoardElement();
        if (!board || typeof board.querySelector !== 'function') return;
        const cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return;
        const target = cell.querySelector(`.trap-place-overlay[data-trap-flash-id="${flashId}"]`);
        if (target && target.parentNode) {
            target.parentNode.removeChild(target);
        }
    }

    (function tick() {
        ensureOverlay();
        if (Date.now() >= endAt) {
            clearOverlay();
            return;
        }
        setTimeout(tick, stepMs);
    })();
}

async function handleTrapSelection(row, col, playerKey) {
    if (isProcessing || isCardAnimating) return;
    isProcessing = true;
    isCardAnimating = true;
    let shouldCheckAutoPass = false;
    let shouldContinueTurnHandoff = false;
    let trapPlaybackEvents = [];

    try {
        const pending = cardState.pendingEffectByPlayer[playerKey];
        if (!pending || pending.type !== 'TRAP_WILL' || pending.stage !== 'selectTarget') return;

        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('place', playerKey, { trapTarget: { row, col }, deferNetworkPublish: true })
            : { type: 'place', trapTarget: { row, col }, deferNetworkPublish: true };
        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = (typeof TurnPipelineUIAdapter !== 'undefined' && typeof TurnPipeline !== 'undefined')
            ? TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline)
            : null;

        if (!res || res.ok === false) {
            if (typeof emitLogAdded === 'function') emitLogAdded('罠石にする自分の石を選んでください');
            return;
        }

        const selected = (res.rawEvents || []).find(e => e && e.type === 'trap_selected');
        if (!selected || !selected.applied) {
            if (typeof emitLogAdded === 'function') emitLogAdded('罠石にする自分の石を選んでください');
            return;
        }

        if (res.nextCardState) cardState = res.nextCardState;
        if (res.nextGameState) gameState = res.nextGameState;

        trapPlaybackEvents = Array.isArray(res.playbackEvents) ? res.playbackEvents : [];

        if (trapPlaybackEvents.length) {
            emitPresentationEventViaBoardOps({
                type: 'PLAYBACK_EVENTS',
                events: trapPlaybackEvents,
                meta: { cause: 'TRAP_WILL', target: { row, col } }
            });
        }

        if (typeof emitCardStateChange === 'function') emitCardStateChange();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        if (typeof emitGameStateChange === 'function') emitGameStateChange();
        // Brief local-only reveal to make placement intent understandable, then hide as normal stone.
        try {
            requestAnimationFrame(() => _playTrapPlacementFlash(row, col, playerKey));
        } catch (e) {
            _playTrapPlacementFlash(row, col, playerKey);
        }
        shouldContinueTurnHandoff = true;
    } finally {
        isProcessing = false;
        isCardAnimating = false;
        if (shouldContinueTurnHandoff) {
            try {
                await continueAfterTrapTurnHandoff(playerKey, trapPlaybackEvents);
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
    module.exports = { handleTrapSelection, setUIImpl };
}
