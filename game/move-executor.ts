/**
 * Move execution and flip animations extracted from turn-manager
 * Refactored to use Shared Logic via wrappers
 */

declare let cardState: any;
declare let gameState: any;
declare const BLACK: any;
declare const WHITE: any;
declare const CardLogic: any;
declare const TurnPipeline: any;
declare const TurnPipelineUIAdapter: any;
declare const ActionManager: any;
declare let isProcessing: any;
declare const isCardAnimating: any;
declare const processCpuTurn: any;
declare const globalThis: any;
declare const onTurnStart: any;
declare const emitBoardUpdate: any;
declare const emitCardStateChange: any;
declare const emitLogAdded: any;
declare const CPU_TURN_DELAY_MS: any;
declare const isDebugLogAvailable: any;
declare const global: any;

let __uiImpl_move_executor: any = {};
function setUIImpl(obj: any) {
    const prev = __uiImpl_move_executor || {};
    __uiImpl_move_executor = Object.assign({}, prev, obj || {});
}

// Module-level variable for isProcessing (replaces globalThis write)

// Import event emitters from controller-events; fall back to global scope
let emitBoardUpdate_local: any;
let emitCardStateChange_local: any;
if (typeof require === 'function') {
    try {
        const _ce = require('./controller-events');
        if (_ce) {
            if (typeof _ce.emitBoardUpdate === 'function') emitBoardUpdate_local = _ce.emitBoardUpdate;
            if (typeof _ce.emitCardStateChange === 'function') emitCardStateChange_local = _ce.emitCardStateChange;
        }
    } catch (e) { /* ignore */ }
}
if (!emitBoardUpdate_local && typeof globalThis !== 'undefined' && typeof globalThis.emitBoardUpdate === 'function') {
    emitBoardUpdate_local = globalThis.emitBoardUpdate;
}
if (!emitCardStateChange_local && typeof globalThis !== 'undefined' && typeof globalThis.emitCardStateChange === 'function') {
    emitCardStateChange_local = globalThis.emitCardStateChange;
}

// TimerService DI
let moveExecutorTimerService: any = null;
function setMoveExecutorTimerService(service: any) { moveExecutorTimerService = service; }
function getMoveExecutorTimerService() {
    if (moveExecutorTimerService) return moveExecutorTimerService;
    try {
        const { createTimerService } = require('./timer-service');
        moveExecutorTimerService = createTimerService('browser');
        return moveExecutorTimerService;
    } catch (e) {
        return null;
    }
}

let moveExecutorNetworkTurnHandoff: any = null;
if (typeof require === 'function') {
    try { moveExecutorNetworkTurnHandoff = require('./network-turn-handoff'); } catch (e) { /* ignore */ }
}
if (!moveExecutorNetworkTurnHandoff && typeof globalThis !== 'undefined' && globalThis.NetworkTurnHandoff) {
    moveExecutorNetworkTurnHandoff = globalThis.NetworkTurnHandoff;
}

let MoveExecutorOwnerHelpersModule: any = null;
if (typeof require === 'function') {
    try { MoveExecutorOwnerHelpersModule = require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!MoveExecutorOwnerHelpersModule && typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) {
    MoveExecutorOwnerHelpersModule = globalThis.OwnerHelpers;
}

function normalizeMoveExecutorPlayerKey(value: any, fallbackValue: any) {
    if (MoveExecutorOwnerHelpersModule && typeof MoveExecutorOwnerHelpersModule.normalizePlayerKey === 'function') {
        return MoveExecutorOwnerHelpersModule.normalizePlayerKey(value, fallbackValue);
    }
    const normalized = (value === null || typeof value === 'undefined')
        ? ''
        : String(value).trim().toLowerCase();
    if (normalized === 'white' || normalized === '-1') return 'white';
    if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
    if (value === -1) return 'white';
    if (value === 1) return 'black';
    const fallback = (fallbackValue === null || typeof fallbackValue === 'undefined')
        ? ''
        : String(fallbackValue).trim().toLowerCase();
    if (fallback === 'white' || fallback === '-1') return 'white';
    if (fallback === 'black' || fallback === '1' || fallback === '+1') return 'black';
    if (fallbackValue === -1) return 'white';
    return 'black';
}

function resolveMoveExecutorTurnOwnerKey(move: any) {
    const currentPlayerValue = gameState ? gameState.currentPlayer : null;
    const movePlayerValue = move && (move.playerValue !== undefined ? move.playerValue : move.player);
    return normalizeMoveExecutorPlayerKey(movePlayerValue, currentPlayerValue);
}

function resolveMoveExecutorAuthPlayerKey(turnOwnerKey: string) {
    const rootRef = (typeof globalThis !== 'undefined') ? globalThis : null;
    const localPlayerKey = (MoveExecutorOwnerHelpersModule && typeof MoveExecutorOwnerHelpersModule.resolveLocalPlayerKey === 'function')
        ? MoveExecutorOwnerHelpersModule.resolveLocalPlayerKey(rootRef)
        : normalizeMoveExecutorPlayerKey(rootRef && rootRef.LOCAL_PLAYER_KEY, turnOwnerKey);
    const controlledTurnOwnerKey = (MoveExecutorOwnerHelpersModule && typeof MoveExecutorOwnerHelpersModule.getFateWillControlledTurnOwnerForPlayer === 'function')
        ? MoveExecutorOwnerHelpersModule.getFateWillControlledTurnOwnerForPlayer(cardState, gameState, localPlayerKey)
        : null;
    return controlledTurnOwnerKey === turnOwnerKey
        ? localPlayerKey
        : turnOwnerKey;
}

function getPlaybackStateForMoveExecutor() {
    try {
        if (__uiImpl_move_executor && __uiImpl_move_executor.PlaybackStateManager) {
            return __uiImpl_move_executor.PlaybackStateManager;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) {
            return globalThis.PlaybackStateManager;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function setMoveExecutorProcessing(active: boolean) {
    const next = active === true;
    const playbackState = getPlaybackStateForMoveExecutor();
    if (playbackState && typeof playbackState.setBusyState === 'function') {
        playbackState.setBusyState({ processing: next });
    } else if (playbackState && typeof playbackState.setProcessing === 'function') {
        playbackState.setProcessing(next);
    }
    try { isProcessing = next; } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined') {
            globalThis.isProcessing = next; // @compat
        }
    } catch (e) { /* ignore */ }
    return next;
}

function isMoveExecutorDebugEnabled() {
    try {
        if (__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_MOVE_EXEC_LOG === true) return true;
    } catch (e) { /* ignore */ }
    try {
        if (typeof isDebugLogAvailable === 'function') return !!isDebugLogAvailable();
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.DEBUG_MOVE_EXEC_LOG === true) return true;
    } catch (e) { /* ignore */ }
    return false;
}

function debugMoveExecutorLog(...args: any[]) {
    if (!isMoveExecutorDebugEnabled()) return;
    try { if (typeof console !== 'undefined' && console.log) console.log.apply(console, args); } catch (e) { /* ignore */ }
}

function debugMoveExecutorError(...args: any[]) {
    if (!isMoveExecutorDebugEnabled()) return;
    try { if (typeof console !== 'undefined' && console.error) console.error.apply(console, args); } catch (e) { /* ignore */ }
}

function getTimeNow() {
    if (__uiImpl_move_executor && typeof __uiImpl_move_executor.now === 'function') {
        return __uiImpl_move_executor.now();
    }
    return null;
}

function shouldRunScheduledCpuTurn(expected: any) {
    const exp = expected || {};
    try {
        const currentPlayer = gameState ? gameState.currentPlayer : null;
        const currentPlayerKey = (typeof WHITE !== 'undefined' && currentPlayer === WHITE)
            ? 'white'
            : (((typeof BLACK !== 'undefined' && currentPlayer === BLACK) || currentPlayer === 'black')
                ? 'black'
                : (currentPlayer === 'white' ? 'white' : null));
        const currentTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
        if (exp.playerKey && currentPlayerKey !== exp.playerKey) return false;
        if (exp.turnNumber !== null && currentTurnNumber !== exp.turnNumber) return false;
    } catch (e) { /* ignore */ }
    return true;
}

function isHumanVsHumanModeEnabled() {
    const debugHvH = (__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN) ||
        (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
    let matchMode = null;
    try {
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return !!debugHvH || matchMode === 'network';
}

function publishNetworkSnapshot(meta: any) {
    if (moveExecutorNetworkTurnHandoff && typeof moveExecutorNetworkTurnHandoff.publishNetworkSnapshot === 'function') {
        return moveExecutorNetworkTurnHandoff.publishNetworkSnapshot(meta);
    }
    try {
        if (typeof globalThis === 'undefined' || !globalThis.NetworkMatchClient) return;
        if (typeof globalThis.NetworkMatchClient.publishSnapshot !== 'function') return;
        if (typeof globalThis.NetworkMatchClient.isActive === 'function' && !globalThis.NetworkMatchClient.isActive()) return;
        globalThis.NetworkMatchClient.publishSnapshot(meta || {});
    } catch (e) { /* ignore */ }
}
// Centralized presentation helper
let BoardPresentation = null;
if (typeof require === 'function') {
    try { BoardPresentation = require('./logic/presentation'); } catch (e) { /* ignore */ }
}
if (!BoardPresentation && typeof globalThis !== 'undefined' && globalThis.PresentationHelper) {
    BoardPresentation = globalThis.PresentationHelper;
}
function emitPresentationEventViaBoardOps(ev: any) {
    try {
        if (__uiImpl_move_executor && typeof __uiImpl_move_executor.emitPresentationEvent === 'function') {
            const handled = __uiImpl_move_executor.emitPresentationEvent(ev);
            if (handled === true) return true;
        }
    } catch (e) { /* ignore */ }
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

async function executeMove(move: any) {
    try {
        const hadSelection = cardState.selectedCardId !== null;
        cardState.selectedCardId = null;
        const turnOwnerKey = resolveMoveExecutorTurnOwnerKey(move);
        const playerKey = resolveMoveExecutorAuthPlayerKey(turnOwnerKey);
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
        debugMoveExecutorLog('[DEBUG][executeMove] enter', { playerKey, turnOwnerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, USE_TURN_PIPELINE: !!(__uiImpl_move_executor && __uiImpl_move_executor.USE_TURN_PIPELINE), DEBUG_HUMAN_VS_HUMAN: !!(__uiImpl_move_executor && __uiImpl_move_executor.DEBUG_HUMAN_VS_HUMAN), pendingEffectByPlayer: cardState.pendingEffectByPlayer });

        if (!pipelineAvailable) {
            throw new Error('TurnPipeline/TurnPipelineUIAdapter is not available. Legacy path has been removed.');
        }

        await executeMoveViaPipeline(move, hadSelection, playerKey, adapter, pipeline);
        if (pipelineSnapshot) {
            comparePipelineSnapshot(pipelineSnapshot, cardState, gameState);
        }

    } catch (error) {
        console.error('[CRITICAL] Error in executeMove:', error);
        setMoveExecutorProcessing(false);
    } finally {
        const safeIsProcessing = (typeof isProcessing !== 'undefined') ? isProcessing : undefined;
        const safeIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined;
        debugMoveExecutorLog('[DEBUG][executeMove] exit', { isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, uiIsProcessing: (__uiImpl_move_executor && typeof __uiImpl_move_executor.isProcessing !== 'undefined' ? __uiImpl_move_executor.isProcessing : undefined), uiIsCardAnimating: (__uiImpl_move_executor && typeof __uiImpl_move_executor.isCardAnimating !== 'undefined' ? __uiImpl_move_executor.isCardAnimating : undefined), gameStateCurrentPlayer: gameState && gameState.currentPlayer });
    }
}

async function executeMoveViaPipeline(move: any, hadSelection: boolean, playerKey: string, adapter: any, pipeline: any) {
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('place', playerKey, { row: move.row, col: move.col })
        : { type: 'place', row: move.row, col: move.col };

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        (action as any).turnIndex = cardState.turnIndex;
    }

    const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);

    // Single Writer: network mode ではローカル実行がスキップされている
    if (res.skippedLocalExecution === true) {
        // サーバー応答の applySnapshot が state 更新と playback を担当する
        setMoveExecutorProcessing(false);
        return;
    }

    // Check if action was rejected (explicit false check, not truthy check)
    if (res.ok === false) {
        console.warn('[MoveExecutor] Action rejected:', res.rejectedReason, 'events:', JSON.stringify(res.events || res, null, 2));
        // Do not record, do not increment turnIndex
        // Important: reset isProcessing to allow auto-loop to continue
        setMoveExecutorProcessing(false);
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
    const hasPlaybackEvents = Array.isArray(res.playbackEvents) && res.playbackEvents.length > 0;
    const hasHandRemovePlayback = Array.isArray(res.playbackEvents)
        ? res.playbackEvents.some((ev: any) => ev && ev.type === 'hand_remove')
        : false;
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
                    for (const k in globalThis.cardState) delete globalThis.cardState[k]; // @compat
                    Object.assign(globalThis.cardState, snapshot); // @compat
                }
                if (cardState && typeof cardState === 'object') {
                    for (const k in cardState) delete (cardState as any)[k];
                    Object.assign(cardState, snapshot);
                } else {
                    cardState = snapshot;
                    try { if (typeof globalThis !== 'undefined') globalThis.cardState = cardState; } catch (e) { /* ignore */ } // @compat
                }
            }
        } catch (e) {
            cardState = res.nextCardState;
            try { if (typeof globalThis !== 'undefined') globalThis.cardState = cardState; } catch (e2) { /* ignore */ } // @compat
        }
        if (!hasPlaybackEvents) {
            let cardStateNotified = false;
            try { if (typeof emitCardStateChange === 'function') cardStateNotified = emitCardStateChange() === true; } catch (e) { /* ignore */ }
            if (!hasHandRemovePlayback && !cardStateNotified) {
                if (!Array.isArray(cardState.presentationEvents)) cardState.presentationEvents = [];
                cardState.presentationEvents.push({ type: 'cardAnimation', animationType: 'handSync', payload: { reason: 'move-executor:no-playback-fallback' } });
            }
        }
    }

    const safeIsProcessing = (typeof isProcessing !== 'undefined') ? isProcessing : undefined;
    const safeIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined;
    debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] after apply', { gameStateCurrentPlayer: gameState.currentPlayer, playerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });

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

    const humanMode = isHumanVsHumanModeEnabled();
    const safeCpuDelay = (typeof CPU_TURN_DELAY_MS !== 'undefined') ? CPU_TURN_DELAY_MS : 600;
    const finalizeTurn = (moveExecutorNetworkTurnHandoff && typeof moveExecutorNetworkTurnHandoff.finalizeNetworkTurnHandoff === 'function')
        ? moveExecutorNetworkTurnHandoff.finalizeNetworkTurnHandoff
        : null;

    if (typeof finalizeTurn === 'function') {
        await finalizeTurn({
            playerKey,
            actionType: (action && (action as any).type) ? (action as any).type : 'place',
            action,
            playbackEvents: Array.isArray(res.playbackEvents) ? res.playbackEvents : [],
            humanMode,
            cpuDelayMs: safeCpuDelay,
            resultOrder: 'beforePublish',
            setProcessing: (nextValue: boolean) => { setMoveExecutorProcessing(nextValue); },
            afterTurnStart: () => {
                try {
                    const now = getTimeNow();
                    if (typeof now === 'number') global.__lastMoveCompletedAt = now; // @compat
                } catch (e) { /* ignore environments without global */ }
                debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] after onTurnStart', { gameStateCurrentPlayer: gameState.currentPlayer, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });
            },
            publishSnapshot: publishNetworkSnapshot,
            onTurnStart: onTurnStartLogic,
            scheduleCpuTurn: ({ delayMs, expectedTurnNumber, nextPlayerKey }: any) => {
                const expectedCpuSchedule = {
                    playerKey: nextPlayerKey || 'white',
                    turnNumber: expectedTurnNumber
                };
                debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] scheduling CPU', { CPU_DELAY: delayMs });
                if (__uiImpl_move_executor && typeof __uiImpl_move_executor.scheduleCpuTurn === 'function') {
                    __uiImpl_move_executor.scheduleCpuTurn(delayMs, () => {
                        if (!shouldRunScheduledCpuTurn(expectedCpuSchedule)) {
                            setMoveExecutorProcessing(false);
                            debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] skip stale scheduled CPU callback', expectedCpuSchedule);
                            return;
                        }
                        debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] scheduled CPU callback firing, isProcessing, isCardAnimating', { isProcessing: (typeof isProcessing !== 'undefined') ? isProcessing : undefined, isCardAnimating: (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined });
                        try { processCpuTurn(); } catch (e) {
                            setMoveExecutorProcessing(false);
                            debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] processCpuTurn threw', e);
                        }
                    });
                    return true;
                }

                try {
                    const globalCpu = (typeof globalThis !== 'undefined' && typeof globalThis.processCpuTurn === 'function') ? globalThis.processCpuTurn : null;
                    const timerService = getMoveExecutorTimerService();
                    const scheduleFn = timerService ? timerService.setTimeout.bind(timerService) : setTimeout;
                    if (globalCpu) {
                        debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] global processCpuTurn available; scheduling via setTimeout', { delay: delayMs });
                        scheduleFn(() => {
                            if (!shouldRunScheduledCpuTurn(expectedCpuSchedule)) {
                                setMoveExecutorProcessing(false);
                                debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] skip stale global CPU callback', expectedCpuSchedule);
                                return;
                            }
                            try { globalCpu(); } catch (err) {
                                setMoveExecutorProcessing(false);
                                debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] global processCpuTurn threw', err);
                            }
                        }, delayMs);
                        return true;
                    }

                        debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] scheduleCpuTurn/processCpuTurn unavailable; retrying late global lookup');
                        scheduleFn(() => {
                            if (!shouldRunScheduledCpuTurn(expectedCpuSchedule)) {
                                setMoveExecutorProcessing(false);
                                debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] skip stale late CPU callback', expectedCpuSchedule);
                                return;
                            }
                            const lateGlobalCpu = (typeof globalThis !== 'undefined' && typeof globalThis.processCpuTurn === 'function')
                                ? globalThis.processCpuTurn
                                : null;
                            if (!lateGlobalCpu) {
                                setMoveExecutorProcessing(false);
                                debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] processCpuTurn unavailable in late fallback');
                                return;
                            }
                            try { lateGlobalCpu(); } catch (err) {
                                setMoveExecutorProcessing(false);
                                debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] late global processCpuTurn threw', err);
                            }
                        }, delayMs);
                        return true;
                } catch (e) {
                    setMoveExecutorProcessing(false);
                    debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] error while trying CPU fallback', e);
                    return false;
                }
            },
            onHumanTurnReady: ({ nextPlayerKey }: any) => {
                if (nextPlayerKey === 'white' && humanMode) {
                    debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] human-vs-human mode: skip CPU scheduling');
                }
                try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
            }
        });
        return;
    }

    if (typeof WHITE !== 'undefined' && gameState.currentPlayer === WHITE && humanMode) {
        debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] human-vs-human mode: skip CPU scheduling');
    }
    // In local mode (no finalizeTurn), onTurnStart for the next player must be called
    // to trigger card draw, effect ticks, game-over checks, and turn logging.
    // The pipeline runs with skipTurnStart:true, so turn-start is not handled there.
    try {
        const nextPlayer = gameState.currentPlayer;
        if (typeof nextPlayer !== 'undefined' && nextPlayer !== null) {
            debugMoveExecutorLog('[DEBUG][executeMoveViaPipeline] local mode: calling onTurnStart for next player', { nextPlayer });
            if (typeof onTurnStartLogic === 'function') {
                onTurnStartLogic(nextPlayer).catch((err: any) => {
                    debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] onTurnStart failed', err);
                });
            }
        }
    } catch (e) {
        debugMoveExecutorError('[DEBUG][executeMoveViaPipeline] error calling onTurnStart', e);
    }
    setMoveExecutorProcessing(false);
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
}

let deepClone = (obj: any) => (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') ? globalThis.structuredClone(obj) : JSON.parse(JSON.stringify(obj));
if (typeof require === 'function') {
  try { deepClone = require('../utils/deepClone'); } catch (e) { /* ignore in browser-like env */ }
}

function runPipelineDebugSnapshot(move: any, playerKey: string) {
    try {
        const action = { type: 'place', row: move.row, col: move.col };
        return TurnPipeline.applyTurn(deepClone(cardState), deepClone(gameState), playerKey, action);
    } catch (e) { return null; }
}

function comparePipelineSnapshot(snapshot: any, actualCardState: any, actualGameState: any) { }

async function onTurnStartLogic(player: any) {
    if (typeof onTurnStart === 'function') return await onTurnStart(player);
    return null;
}

export = {
    executeMove,
    executeMoveViaPipeline,
    setUIImpl,
    setMoveExecutorTimerService
};

// Exposing `executeMove` to browser globals is a UI responsibility to avoid direct browser-global references in `game/**`.
if (typeof globalThis !== 'undefined') {
    try { globalThis.executeMove = executeMove; } catch (e) { /* ignore */ } // @compat
}
