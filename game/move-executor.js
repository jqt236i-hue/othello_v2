(function () {
// Move execution and flip animations extracted from turn-manager
// Refactored to use Shared Logic via wrappers

let __uiImpl_move_executor = {};
function setUIImpl(obj) {
    const prev = __uiImpl_move_executor || {};
    __uiImpl_move_executor = Object.assign({}, prev, obj || {});
}

function getTimeNow() {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.now === 'function') {
        return __uiImpl_move_executor.now();
    }
    return null;
}
// Centralized presentation helper
var BoardPresentation = null;
if (typeof require === 'function') {
    try { BoardPresentation = require('./logic/presentation'); } catch (e) { /* ignore */ }
}
if (!BoardPresentation && typeof globalThis !== 'undefined' && globalThis.PresentationHelper) {
    BoardPresentation = globalThis.PresentationHelper;
}
function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('./logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    try {
        const ops = (typeof globalThis !== 'undefined' && globalThis.BoardOps && typeof globalThis.BoardOps.emitPresentationEvent === 'function')
            ? globalThis.BoardOps
            : null;
        if (ops) {
            ops.emitPresentationEvent(cardState, ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    // Silent fallback: presentation helper may not be available during early bootstrap.
    return false;
} 

if (typeof CardLogic === 'undefined') {
    console.error('CardLogic/CoreLogic is not loaded.');
}

async function executeMove(move) {
    try {
        const hadSelection = cardState.selectedCardId !== null;
        cardState.selectedCardId = null;
        const playerKey = getPlayerKey(move.player);
        const debugUsePipeline = !!(__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_USE_TURN_PIPELINE) && typeof TurnPipeline !== 'undefined' && typeof TurnPipeline.applyTurn === 'function';
        const pipelineSnapshot = debugUsePipeline ? runPipelineDebugSnapshot(move, playerKey) : null;
        let adapter = (typeof TurnPipelineUIAdapter !== 'undefined') ? TurnPipelineUIAdapter : null;
        if (!adapter && typeof require === 'function') {
            try { adapter = require('./turn/pipeline_ui_adapter'); } catch (e) { /* ignore */ }
        }
        if (!adapter && typeof globalThis !== 'undefined' && globalThis.TurnPipelineUIAdapter) {
            adapter = globalThis.TurnPipelineUIAdapter;
        }
        let pipeline = (typeof TurnPipeline !== 'undefined') ? TurnPipeline : null;
        if (!pipeline && typeof require === 'function') {
            try { pipeline = require('./turn/turn_pipeline'); } catch (e) { /* ignore */ }
        }
        if (!pipeline && typeof globalThis !== 'undefined' && globalThis.TurnPipeline) {
            pipeline = globalThis.TurnPipeline;
        }
        const pipelineAvailable = (adapter && pipeline);

        const safeIsProcessing = (typeof isProcessing !== 'undefined') ? isProcessing : undefined;
        const safeIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined;
        console.log('[DEBUG][executeMove] enter', { playerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, USE_TURN_PIPELINE: !!(__uiImpl_move_executor && __uiImpl_move_executor.USE_TURN_PIPELINE), DEBUG_HUMAN_VS_HUMAN: !!(__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN), pendingEffectByPlayer: cardState.pendingEffectByPlayer });

        if (!pipelineAvailable) {
            throw new Error('TurnPipeline/TurnPipelineUIAdapter is not available. Legacy path has been removed.');
        }

        await executeMoveViaPipeline(move, hadSelection, playerKey, adapter, pipeline);
        if (pipelineSnapshot) {
            comparePipelineSnapshot(pipelineSnapshot, cardState, gameState);
        }

    } catch (error) {
        console.error('[CRITICAL] Error in executeMove:', error);
        isProcessing = false;
    } finally {
        const safeIsProcessing = (typeof isProcessing !== 'undefined') ? isProcessing : undefined;
        const safeIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined;
        console.log('[DEBUG][executeMove] exit', { isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, uiIsProcessing: (__uiImpl_move_executor && typeof __uiImpl_move_executor.isProcessing !== 'undefined' ? __uiImpl_move_executor.isProcessing : undefined), uiIsCardAnimating: (__uiImpl_move_executor && typeof __uiImpl_move_executor.isCardAnimating !== 'undefined' ? __uiImpl_move_executor.isCardAnimating : undefined), gameStateCurrentPlayer: gameState && gameState.currentPlayer });
    }
}

async function executeMoveViaPipeline(move, hadSelection, playerKey, adapter, pipeline) {
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('place', playerKey, { row: move.row, col: move.col })
        : { type: 'place', row: move.row, col: move.col };

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);

    // Check if action was rejected (explicit false check, not truthy check)
    if (res.ok === false) {
        console.warn('[MoveExecutor] Action rejected:', res.rejectedReason, 'events:', JSON.stringify(res.events || res, null, 2));
        // Do not record, do not increment turnIndex
        // Important: reset isProcessing to allow auto-loop to continue
        isProcessing = false;
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
        return;
    }

    if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
        try {
            ActionManager.ActionManager.recordAction(action);
            ActionManager.ActionManager.incrementTurnIndex();
        } catch (e) {
            console.warn('[MoveExecutor] Failed to record action:', e);
        }
    }

    // Update canonical states. Preserve existing object references where possible so
    // modules that keep a reference to the old cardState object see updates immediately.
    gameState = res.nextGameState;
    if (res.nextCardState) {
        try {
            let applied = false;
            try {
                let cs = null;
                if (typeof require === 'function') {
                    try { cs = require('../card-system'); } catch (e) { cs = null; }
                }
                if (cs && typeof cs.applyCardStateSnapshot === 'function') {
                    cs.applyCardStateSnapshot(res.nextCardState);
                    applied = true;
                } else if (typeof globalThis !== 'undefined' && typeof globalThis.applyCardStateSnapshot === 'function') {
                    globalThis.applyCardStateSnapshot(res.nextCardState);
                    applied = true;
                }
            } catch (e) { applied = false; }

            if (!applied) {
                const snapshot = res.nextCardState;
                if (typeof globalThis !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object') {
                    for (const k in globalThis.cardState) delete globalThis.cardState[k];
                    Object.assign(globalThis.cardState, snapshot);
                }
                if (cardState && typeof cardState === 'object') {
                    for (const k in cardState) delete cardState[k];
                    Object.assign(cardState, snapshot);
                } else {
                    cardState = snapshot;
                    try { if (typeof globalThis !== 'undefined') globalThis.cardState = cardState; } catch (e) { /* ignore */ }
                }
            }
        } catch (e) {
            cardState = res.nextCardState;
            try { if (typeof globalThis !== 'undefined') globalThis.cardState = cardState; } catch (e2) { /* ignore */ }
        }
        try { if (typeof emitCardStateChange === 'function') emitCardStateChange(); } catch (e) { /* ignore */ }
        try { if (typeof renderCardUI === 'function') renderCardUI(); } catch (e) { /* ignore */ }
    }

    const safeIsProcessing = (typeof isProcessing !== 'undefined') ? isProcessing : undefined;
    const safeIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined;
    console.log('[DEBUG][executeMoveViaPipeline] after apply', { gameStateCurrentPlayer: gameState.currentPlayer, playerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });

    const phases = res.phases || {};
    const effects = res.placementEffects || {};
    const immediate = res.immediate || {};

    // Request UI-side playback by emitting a presentation event (Playback should be performed by UI's PlaybackEngine)
    if (res.playbackEvents && res.playbackEvents.length) {
        emitPresentationEventViaBoardOps({ type: 'PLAYBACK_EVENTS', events: res.playbackEvents, meta: { move, phases, effects, immediate } });
        // Ensure UI has a chance to consume and start playback BEFORE we advance the turn.
        // Otherwise, onTurnStart may flush/transform the buffer and the move playback gets lost.
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    } else {
        // No playback events produced; nothing for the UI to play
    }

    // Finalize turn: pipeline handles the turn-end logic (do NOT call the CardLogic turn-end writer from UI)
    if (typeof isGameOver === 'function' && isGameOver(gameState)) { if (typeof showResult === 'function') { showResult(); } isProcessing = false; return; }

    // Wait for move playback to finish before advancing the turn.
    // In some browser builds, DI bootstrap may not be active; fall back to the global helper if present.
    if (res.playbackEvents && res.playbackEvents.length) {
        const waitForPlaybackFn = (__uiImpl_move_executor && typeof __uiImpl_move_executor.waitForPlayback === 'function')
            ? __uiImpl_move_executor.waitForPlayback
            : ((typeof globalThis !== 'undefined' && typeof globalThis.waitForPlaybackIdle === 'function') ? globalThis.waitForPlaybackIdle : null);
        if (typeof waitForPlaybackFn === 'function') {
            await waitForPlaybackFn();
        }
    }

    await onTurnStartLogic(gameState.currentPlayer);
    // Record completion timestamp so CPU turns invoked immediately after can be deferred by CPU handler if necessary
    try {
        const now = getTimeNow();
        if (typeof now === 'number') global.__lastMoveCompletedAt = now;
    } catch (e) { /* ignore environments without global */ }
    console.log('[DEBUG][executeMoveViaPipeline] after onTurnStart', { gameStateCurrentPlayer: gameState.currentPlayer, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });
    const debugHvH = (__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN) ||
        (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
    const safeCpuDelay = (typeof CPU_TURN_DELAY_MS !== 'undefined') ? CPU_TURN_DELAY_MS : 600;
    if (typeof WHITE !== 'undefined' && gameState.currentPlayer === WHITE && !debugHvH) {
        isProcessing = true;
        console.log('[DEBUG][executeMoveViaPipeline] scheduling CPU', { CPU_DELAY: safeCpuDelay });
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.scheduleCpuTurn === 'function') {
            __uiImpl_move_executor.scheduleCpuTurn(safeCpuDelay, () => {
                console.log('[DEBUG][executeMoveViaPipeline] scheduled CPU callback firing, isProcessing, isCardAnimating', { isProcessing: (typeof isProcessing !== 'undefined') ? isProcessing : undefined, isCardAnimating: (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined });
                try { processCpuTurn(); } catch (e) { console.error('[DEBUG][executeMoveViaPipeline] processCpuTurn threw', e); }
            });
        } else {
            // Try a direct global fallback first: if the CPU handler registered itself as a global
            // (via cpu-turn-handler setting globalThis.processCpuTurn) we can schedule it directly
            // instead of relying on the UI to consume a presentation event. This makes the game
            // robust to boot-order issues where UI registration happens after a move completes.
            try {
                const globalCpu = (typeof globalThis !== 'undefined' && typeof globalThis.processCpuTurn === 'function') ? globalThis.processCpuTurn : null;
                if (globalCpu) {
                    console.log('[DEBUG][executeMoveViaPipeline] global processCpuTurn available; scheduling via setTimeout', { delay: safeCpuDelay });
                    setTimeout(() => {
                        try { globalCpu(); } catch (err) { console.error('[DEBUG][executeMoveViaPipeline] global processCpuTurn threw', err); }
                    }, safeCpuDelay);
                } else {
                    // Fallback: do not call time APIs in game layer. Emit a presentation event so UI can schedule the CPU turn.
                    console.log('[DEBUG][executeMoveViaPipeline] scheduleCpuTurn not available; emitting SCHEDULE_CPU_TURN presentation event');
                    try {
                        emitPresentationEventViaBoardOps({ type: 'SCHEDULE_CPU_TURN', delayMs: safeCpuDelay, reason: 'CPU_TURN' });
                        // Ensure UI gets a chance to consume the scheduling request.
                        // In some browser flows, the last BOARD_UPDATED may have fired before this event is appended.
                        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
                    } catch (e) {
                        console.error('[DEBUG][executeMoveViaPipeline] failed to emit SCHEDULE_CPU_TURN event', e);
                    }
                }
            } catch (e) {
                console.error('[DEBUG][executeMoveViaPipeline] error while trying CPU fallback', e);
            }
        }
    } else {
        if (typeof WHITE !== 'undefined' && gameState.currentPlayer === WHITE && debugHvH) {
            console.log('[DEBUG][executeMoveViaPipeline] DEBUG_HUMAN_VS_HUMAN: skip CPU scheduling');
        }
        isProcessing = false;
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    }
}

let deepClone = (obj) => (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') ? globalThis.structuredClone(obj) : JSON.parse(JSON.stringify(obj));
if (typeof require === 'function') {
  try { deepClone = require('../utils/deepClone'); } catch (e) { /* ignore in browser-like env */ }
}

function runPipelineDebugSnapshot(move, playerKey) {
    try {
        const action = { type: 'place', row: move.row, col: move.col };
        return TurnPipeline.applyTurn(deepClone(cardState), deepClone(gameState), playerKey, action);
    } catch (e) { return null; }
}

function comparePipelineSnapshot(snapshot, actualCardState, actualGameState) { }

async function onTurnStartLogic(player) {
    if (typeof onTurnStart === 'function') await onTurnStart(player);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        executeMove,
        executeMoveViaPipeline,
        setUIImpl
    };
}

// Exposing `executeMove` to browser globals is a UI responsibility to avoid direct browser-global references in `game/**`.
if (typeof globalThis !== 'undefined') {
    try { globalThis.executeMove = executeMove; } catch (e) { /* ignore */ }
}
})();
