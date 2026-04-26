/**
 * @file turn-manager.js
 * Core turn wiring: user input, animation gate checks, player key helpers, and game reset entrypoint.
 */

// Shared timing constants for turn/animation sequencing
var getAnimationTiming;
if (typeof require === 'function') {
    try { ({ getAnimationTiming } = require('../constants/animation-constants')); } catch (e) { /* ignore */ }
}
if (typeof getAnimationTiming !== 'function' && typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming === 'function') {
    getAnimationTiming = globalThis.getAnimationTiming;
}
const FLIP_ANIMATION_DURATION_MS = (typeof getAnimationTiming === 'function' ? getAnimationTiming('FLIP_ANIMATION_DURATION') : 600) || 600;
const CPU_TURN_DELAY_MS = (typeof globalThis !== 'undefined' && globalThis.__BENCH_FAST_MODE === true) ? 0 : 600;
const ANIMATION_RETRY_DELAY_MS = 80;
const DOUBLE_PLACE_PASS_DELAY_MS = 250;
const BLACK_PASS_DELAY_MS = 1000;

// Presentation emission via centralized helper
var BoardPresentation = null;
if (typeof require === 'function') {
    try { BoardPresentation = require('./logic/presentation'); } catch (e) { /* ignore */ }
}
if (!BoardPresentation && typeof globalThis !== 'undefined' && globalThis.PresentationHelper) {
    BoardPresentation = globalThis.PresentationHelper;
}
// TurnPipeline UI adapter (for mapping presentation events to playback events)
var TurnPipelineUIAdapter = (typeof globalThis !== 'undefined' && globalThis.TurnPipelineUIAdapter)
    ? globalThis.TurnPipelineUIAdapter
    : null;
if (typeof require === 'function') {
    try { TurnPipelineUIAdapter = require('./turn/pipeline_ui_adapter'); } catch (e) { /* ignore */ }
}
if (!TurnPipelineUIAdapter && typeof globalThis !== 'undefined' && globalThis.TurnPipelineUIAdapter) {
    TurnPipelineUIAdapter = globalThis.TurnPipelineUIAdapter;
}
var CpuTurnHandlerModule = null;
var PendingCoordinatorForTurnManager = null;

function getTurnPipelineUIAdapter() {
    if (TurnPipelineUIAdapter) {
        return TurnPipelineUIAdapter;
    }
    if (typeof require === 'function') {
        try { TurnPipelineUIAdapter = require('./turn/pipeline_ui_adapter'); } catch (e) { /* ignore */ }
    }
    if (!TurnPipelineUIAdapter && typeof globalThis !== 'undefined' && globalThis.TurnPipelineUIAdapter) {
        TurnPipelineUIAdapter = globalThis.TurnPipelineUIAdapter;
    }
    return TurnPipelineUIAdapter;
}

function getCpuTurnHandlerModule() {
    if (CpuTurnHandlerModule && typeof CpuTurnHandlerModule === 'object') {
        return CpuTurnHandlerModule;
    }
    try {
        if (typeof resetCpuTurnHandlerState === 'function') {
            CpuTurnHandlerModule = { resetCpuTurnHandlerState };
            return CpuTurnHandlerModule;
        }
    } catch (e) { /* ignore */ }
    if (typeof require === 'function') {
        try { CpuTurnHandlerModule = require('./cpu-turn-handler'); } catch (e) { /* ignore */ }
    }
    return CpuTurnHandlerModule;
}

function resetCpuTurnSchedulingStateForTurnManager() {
    const cpuTurnHandler = getCpuTurnHandlerModule();
    if (cpuTurnHandler && typeof cpuTurnHandler.resetCpuTurnHandlerState === 'function') {
        cpuTurnHandler.resetCpuTurnHandlerState();
    }
}

var OwnerHelpersModule = null;
if (typeof require === 'function') {
    try { OwnerHelpersModule = require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!OwnerHelpersModule && typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) {
    OwnerHelpersModule = globalThis.OwnerHelpers;
}

function getPlaybackStateForTurnManager() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) {
            return globalThis.PlaybackStateManager;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readTurnManagerProcessing() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.getProcessing === 'function') {
        return playbackState.getProcessing() === true;
    }
    const localProcessing = (typeof __uiImpl !== 'undefined' && typeof __uiImpl.isProcessing !== 'undefined')
        ? __uiImpl.isProcessing
        : (typeof isProcessing !== 'undefined' ? isProcessing : false);
    const globalProcessing = (typeof globalThis !== 'undefined') ? !!globalThis.isProcessing : false;
    return localProcessing || globalProcessing;
}

function readTurnManagerCardAnimating() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
        return playbackState.getCardAnimating() === true;
    }
    const localCardAnimating = (typeof __uiImpl !== 'undefined' && typeof __uiImpl.isCardAnimating !== 'undefined')
        ? __uiImpl.isCardAnimating
        : (typeof isCardAnimating !== 'undefined' ? isCardAnimating : false);
    const globalCardAnimating = (typeof globalThis !== 'undefined') ? !!globalThis.isCardAnimating : false;
    return localCardAnimating || globalCardAnimating;
}

function setTurnManagerBusyState(options) {
    const config = (options && typeof options === 'object')
        ? options
        : {
            processing: options === true,
            cardAnimating: options === true
        };
    const playbackState = getPlaybackStateForTurnManager();
    const hasProcessing = Object.prototype.hasOwnProperty.call(config, 'processing');
    const hasCardAnimating = Object.prototype.hasOwnProperty.call(config, 'cardAnimating');
    const hasPlaybackActive = Object.prototype.hasOwnProperty.call(config, 'playbackActive');
    const nextProcessing = hasProcessing ? (config.processing === true) : null;
    const nextCardAnimating = hasCardAnimating ? (config.cardAnimating === true) : null;
    const nextPlaybackActive = hasPlaybackActive ? (config.playbackActive === true) : null;

    if (playbackState) {
        if (typeof playbackState.setBusyState === 'function') {
            playbackState.setBusyState(config);
        } else {
            if (hasProcessing && typeof playbackState.setProcessing === 'function') {
                playbackState.setProcessing(nextProcessing);
            }
            if (hasCardAnimating && typeof playbackState.setCardAnimating === 'function') {
                playbackState.setCardAnimating(nextCardAnimating);
            }
            if (hasPlaybackActive && typeof playbackState.setPlaybackActive === 'function') {
                playbackState.setPlaybackActive(nextPlaybackActive);
            }
        }
        if (nextPlaybackActive === false && typeof playbackState.setPlaybackStartedAt === 'function') {
            playbackState.setPlaybackStartedAt(null);
        }
    }

    try {
        if (hasProcessing) isProcessing = nextProcessing;
    } catch (e) { /* ignore */ }
    try {
        if (hasCardAnimating) isCardAnimating = nextCardAnimating;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined') {
            if (hasProcessing) globalThis.isProcessing = nextProcessing;
            if (hasCardAnimating) globalThis.isCardAnimating = nextCardAnimating;
            if (hasPlaybackActive) {
                globalThis.VisualPlaybackActive = nextPlaybackActive;
                if (nextPlaybackActive) {
                    if (!Number.isFinite(Number(globalThis.__playbackActiveSince))) {
                        globalThis.__playbackActiveSince = Date.now();
                    }
                } else {
                    globalThis.__playbackActiveSince = null;
                }
            }
        }
    } catch (e) { /* ignore */ }

    return {
        isProcessing: readTurnManagerProcessing(),
        isCardAnimating: readTurnManagerCardAnimating(),
        playbackActive: isVisualPlaybackActiveForTurnManager()
    };
}

function isVisualPlaybackActiveForTurnManager() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
        return playbackState.getPlaybackActive() === true;
    }
    return (typeof globalThis !== 'undefined') ? (globalThis.VisualPlaybackActive === true) : false;
}

function clearPlaybackLockForTurnManager() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.abortPlayback === 'function') {
        playbackState.abortPlayback();
    } else if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
        playbackState.clearPlaybackLock();
    } else {
        setTurnManagerBusyState({
            cardAnimating: false,
            playbackActive: false
        });
    }
}

function getPlaybackStartedAtForTurnManager() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.getPlaybackStartedAt === 'function') {
        const startedAt = Number(playbackState.getPlaybackStartedAt());
        return Number.isFinite(startedAt) ? startedAt : null;
    }
    try {
        if (typeof globalThis !== 'undefined') {
            const startedAt = Number(globalThis.__playbackActiveSince);
            return Number.isFinite(startedAt) ? startedAt : null;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function isPlaybackRunningForTurnManager() {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.AnimationEngine &&
            typeof globalThis.AnimationEngine.isPlaying === 'boolean'
        ) {
            return globalThis.AnimationEngine.isPlaying === true;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function getStalePlaybackTimeoutMsForTurnManager() {
    try {
        if (typeof globalThis !== 'undefined') {
            const timeoutMs = Number(globalThis.PASS_STALE_PLAYBACK_MS);
            if (Number.isFinite(timeoutMs) && timeoutMs > 0) return timeoutMs;
        }
    } catch (e) { /* ignore */ }
    return 3500;
}

function isStalePlaybackLockForTurnManager(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const visualPlayback = opts.visualPlayback === true ? true : isVisualPlaybackActiveForTurnManager();
    if (!visualPlayback) return false;
    if (opts.processingActive === true) return false;
    if (opts.queuedPresentation === true) return false;

    const playbackRunning = isPlaybackRunningForTurnManager();
    if (playbackRunning === true) return false;
    if (playbackRunning === false) return true;

    const startedAt = getPlaybackStartedAtForTurnManager();
    if (startedAt === null) return false;
    return (Date.now() - startedAt) > getStalePlaybackTimeoutMsForTurnManager();
}

function releaseStalePlaybackLockForTurnManager(options) {
    if (!isStalePlaybackLockForTurnManager(options)) return false;
    clearPlaybackLockForTurnManager();
    return true;
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

// Configuration and UI-DI
if (typeof __uiImpl_turn_manager === 'undefined') { try { globalThis.__uiImpl_turn_manager = globalThis.__uiImpl_turn_manager || {}; } catch (e) { this.__uiImpl_turn_manager = this.__uiImpl_turn_manager || {}; } }
function setUIImpl(obj) {
    try {
        const prev = globalThis.__uiImpl_turn_manager || {};
        globalThis.__uiImpl_turn_manager = Object.assign({}, prev, obj || {});
    } catch (e) {
        const prev = this.__uiImpl_turn_manager || {};
        this.__uiImpl_turn_manager = Object.assign({}, prev, obj || {});
    }
}

// Module-scoped UI locks (local state; UI may mirror these via UI bootstrap if desired)
if (typeof isProcessing === 'undefined') { setTurnManagerBusyState({ processing: false }); }
if (typeof isCardAnimating === 'undefined') { setTurnManagerBusyState({ cardAnimating: false }); }
if (typeof cpuSmartness === 'undefined') { try { globalThis.cpuSmartness = { black: 1, white: 1 }; } catch (e) { this.cpuSmartness = { black: 1, white: 1 }; } }
var resetGameGeneration = 0;

// TimerService DI
let turnManagerTimerService = null;
function setTurnManagerTimerService(service) { turnManagerTimerService = service; }
function getTurnManagerTimerService() {
    if (turnManagerTimerService) return turnManagerTimerService;
    try {
        const { createTimerService } = require('./timer-service');
        turnManagerTimerService = createTimerService('browser');
        return turnManagerTimerService;
    } catch (e) {
        return null;
    }
}

// Prefer shared scheduling helper when available; fallback to TimerService or setTimeout
let scheduleRetry = null;
if (typeof require === 'function') {
    try { const tu = require('./timer-utils'); if (tu && typeof tu.scheduleRetry === 'function') scheduleRetry = tu.scheduleRetry; } catch (e) { /* ignore */ }
}
if (!scheduleRetry) {
    scheduleRetry = (fn, delayMs) => {
        try {
            if (globalThis && globalThis.timers && typeof globalThis.timers.waitMs === 'function') {
                globalThis.timers.waitMs(delayMs).then(fn);
                return;
            }
        } catch (e) { /* ignore */ }
        const timerService = getTurnManagerTimerService();
        if (timerService) {
            timerService.setTimeout(fn, delayMs);
            return;
        }
        setTimeout(fn, delayMs);
    };
}



function hasQueuedPresentationEventsForTurnManager() {
    try {
        if (!cardState || typeof cardState !== 'object') return false;
        const hasQueuedPlaybackEvents = (queue) => Array.isArray(queue)
            && queue.some((event) => event && event.type === 'PLAYBACK_EVENTS');
        return hasQueuedPlaybackEvents(cardState.presentationEvents)
            || hasQueuedPlaybackEvents(cardState._presentationEventsPersist);
    } catch (e) { /* ignore */ }
    return false;
}
function handleCellClick(row, col) {
    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[CELL-CLICK] User clicked (${row},${col})`, 'debug', {
            currentPlayer: gameState.currentPlayer,
            isAnimationInProgress: isAnimationInProgress()
        });
    }



    // Auto mode owns progression; ignore manual board input.
    if (typeof globalThis !== 'undefined' && globalThis.AUTO_MODE_ACTIVE === true) return;

    const playerKey = getPlayerKey(gameState.currentPlayer);
    if (!canLocalUserOperateCurrentTurn()) return;
    const pending = readPendingForTurnManager(playerKey);
    const pendingDispatchKey = (pending && pending.stage === 'selectTarget')
        ? resolvePendingSelectionDispatchKeyForTurnManager(pending.type)
        : null;
    const allowPendingSelectionDuringAnimation = shouldAllowPendingSelectionDuringAnimation(playerKey, pending, pendingDispatchKey);

    // Block while animations are running
    if (isAnimationInProgress() && !allowPendingSelectionDuringAnimation) return;

    if (pendingDispatchKey) {
        const pendingSelectionHandler = resolveBoardPendingSelectionHandlerForTurnManager(pendingDispatchKey);
        if (typeof pendingSelectionHandler === 'function') {
            pendingSelectionHandler(row, col, playerKey);
        }
        return;
    }

    // Human move: BLACK always, WHITE when network human mode is enabled, or FATE_WILL controlled.
    const currentPlayerKey = getPlayerKey(gameState.currentPlayer);
    const isFateWillControlled = !!((cardState && cardState.fateWillControllerByTurnOwner || {})[currentPlayerKey]);
    const isHumanTurn = (currentPlayerKey === 'black') || (isHumanVsHumanModeEnabled() && currentPlayerKey === 'white') || isFateWillControlled;
    if (!isHumanTurn) return;

    const protection = getActiveProtectionForPlayer(gameState.currentPlayer);
    const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
    const move = findMoveForCell(gameState.currentPlayer, row, col, pending, protection, perma);
    if (!move) {
        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
            debugLog(`[MOVE] Invalid move attempted at (${row},${col})`, 'warn', {
                currentPlayer: gameState.currentPlayer,
                hasPending: !!pending
            });
        }
        return;
    }

    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[MOVE] Valid move found at (${row},${col})`, 'info', {
            flips: move.flips ? move.flips.length : 0,
            currentPlayer: gameState.currentPlayer,
            playerKey
        });
    }

    if (isNetworkModeForTurnManager()) {
        executeMove(move);
        return;
    }

    // Hand animation is handled by the UI's PlaybackEngine through pipeline playback events
    if (!Array.isArray(cardState.presentationEvents)) cardState.presentationEvents = [];
    cardState.presentationEvents.push({ type: 'PLAY_HAND_ANIMATION', player: playerKey, row, col });
    executeMove(move);
}

function isAnimationInProgress() {
    const processingActive = readTurnManagerProcessing();
    // UI render is deferred while presentation events are queued, so board clicks must
    // remain locked until the queue is consumed to avoid stale legal-hint clicks.
    const queuedPresentation = hasQueuedPresentationEventsForTurnManager();
    let visualPlayback = isVisualPlaybackActiveForTurnManager();
    if (visualPlayback) {
        visualPlayback = !releaseStalePlaybackLockForTurnManager({
            processingActive,
            queuedPresentation,
            visualPlayback
        });
    }
    const cardAnimatingActive = readTurnManagerCardAnimating();
    return processingActive || cardAnimatingActive || visualPlayback || queuedPresentation;
}

function shouldAllowPendingSelectionDuringAnimation(playerKey, pending, pendingDispatchKey) {
    if (!pending || !pendingDispatchKey || pending.stage !== 'selectTarget') return false;
    if (readTurnManagerProcessing()) return false;
    const playbackState = getPlaybackStateForTurnManager();
    if (!playbackState || typeof playbackState.shouldAllowSelectionEntryDuringPlayback !== 'function') {
        return false;
    }
    try {
        return playbackState.shouldAllowSelectionEntryDuringPlayback({
            playerKey,
            pendingType: pending.type
        }) === true;
    } catch (e) {
        return false;
    }
}

function isHumanVsHumanModeEnabled() {
    const debugHvH = !!(__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN);
    let matchMode = null;
    try {
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return debugHvH || matchMode === 'network';
}

function isNetworkModeForTurnManager() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            return OwnerHelpersModule.isNetworkMode(typeof globalThis !== 'undefined' ? globalThis : null);
        }
    } catch (e) { /* ignore */ }
    try {
        const matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
        return matchMode === 'network';
    } catch (e) { /* ignore */ }
    return false;
}

function resolveNetworkLocalPlayerKey() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(typeof globalThis !== 'undefined' ? globalThis : null);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined') {
            if (globalThis.NetworkMatchClient && typeof globalThis.NetworkMatchClient.getSeatKey === 'function') {
                const seatKey = globalThis.NetworkMatchClient.getSeatKey();
                if (seatKey === 'white' || seatKey === 'black') return seatKey;
            }
            const directKeys = [globalThis.LOCAL_PLAYER_KEY, globalThis.__LOCAL_PLAYER_KEY, globalThis.BOARD_VIEWER_KEY];
            for (const key of directKeys) {
                if (key === 'white' || key === 'black') return key;
            }
        }
    } catch (e) { /* ignore */ }
    return 'black';
}

function canLocalUserOperateCurrentTurn() {
    const currentPlayerKey = getPlayerKey(gameState.currentPlayer);
    const isNetworkMode = isNetworkModeForTurnManager();
    const isHvH = !!(__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN);
    // FATE_WILL: if another player controls this turn, only the controller can operate.
    // Applies in network mode and in local non-HvH mode.
    if (isNetworkMode || !isHvH) {
        const cs = (typeof cardState !== 'undefined' && cardState) ? cardState : null;
        const fwc = cs && cs.fateWillControllerByTurnOwner;
        const controller = fwc && fwc[currentPlayerKey];
        if (controller) {
            const localPlayerKey = resolveNetworkLocalPlayerKey();
            return controller === localPlayerKey;
        }
    }
    if (!isNetworkMode) return true;
    const localPlayerKey = resolveNetworkLocalPlayerKey();
    return currentPlayerKey === localPlayerKey;
}

function createNetworkResetAction(playerKey) {
    const normalizedPlayerKey = playerKey === 'white' ? 'white' : 'black';
    return {
        type: 'reset_game',
        playerKey: normalizedPlayerKey
    };
}

function publishNetworkResetSnapshot() {
    try {
        if (!isNetworkModeForTurnManager()) return;

        if (typeof globalThis === 'undefined' || !globalThis.NetworkMatchClient) return;
        if (typeof globalThis.NetworkMatchClient.publishSnapshot !== 'function') return;
        if (typeof globalThis.NetworkMatchClient.isActive === 'function' && !globalThis.NetworkMatchClient.isActive()) return;

        const playerKey = resolveNetworkLocalPlayerKey();
        globalThis.NetworkMatchClient.publishSnapshot({
            playerKey,
            actionType: 'reset_game',
            action: createNetworkResetAction(playerKey),
            playbackEvents: []
        });
    } catch (e) { /* ignore */ }
}

function getPlayerKey(player) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKey === 'function') {
            return OwnerHelpersModule.normalizePlayerKey(player, 'black');
        }
    } catch (e) { /* ignore */ }

    if (player === 1 || player === '1') return 'black';
    if (player === -1 || player === '-1') return 'white';

    const normalized = (player === null || typeof player === 'undefined')
        ? ''
        : String(player).trim().toLowerCase();

    if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
    if (normalized === 'white' || normalized === '-1') return 'white';

    try {
        if (typeof BLACK !== 'undefined' && player === BLACK) return 'black';
        if (typeof WHITE !== 'undefined' && player === WHITE) return 'white';
    } catch (e) { /* ignore */ }
    return 'black';
}

function getPlayerName(player) {
    return getPlayerKey(player) === 'black' ? '黒' : '白';
}

// Request a UI render via event (no direct UI calls)
function requestUIRender() {
    if (typeof emitBoardUpdate === 'function') {
        try { emitBoardUpdate(); } catch (e) { /* ignore UI errors */ }
    }
}

function resolvePendingCoordinatorForTurnManager() {
    if (PendingCoordinatorForTurnManager && typeof PendingCoordinatorForTurnManager === 'object') {
        return PendingCoordinatorForTurnManager;
    }
    if (typeof require === 'function') {
        try { PendingCoordinatorForTurnManager = require('./turn/pending-coordinator'); } catch (e) { /* ignore */ }
    }
    if (!PendingCoordinatorForTurnManager && typeof globalThis !== 'undefined' && globalThis.PendingCoordinator) {
        PendingCoordinatorForTurnManager = globalThis.PendingCoordinator;
    }
    return (PendingCoordinatorForTurnManager && typeof PendingCoordinatorForTurnManager === 'object')
        ? PendingCoordinatorForTurnManager
        : null;
}

function resolvePendingSelectionDispatchKeyForTurnManager(pendingType) {
    var pendingCoordinator = resolvePendingCoordinatorForTurnManager();
    if (!pendingCoordinator || typeof pendingCoordinator.resolvePendingSelectionDispatchKey !== 'function') {
        return null;
    }
    return pendingCoordinator.resolvePendingSelectionDispatchKey(pendingType);
}

function readPendingForTurnManager(playerKey) {
    var pendingCoordinator = resolvePendingCoordinatorForTurnManager();
    if (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function') {
        return pendingCoordinator.readPendingEffect(cardState, playerKey);
    }
    return (cardState && cardState.pendingEffectByPlayer)
        ? (cardState.pendingEffectByPlayer[playerKey] || null)
        : null;
}

function resolveBoardPendingSelectionHandlerForTurnManager(dispatchKey) {
    switch (String(dispatchKey || '')) {
    case 'destroy':
        return (typeof handleDestroySelection === 'function') ? handleDestroySelection : null;
    case 'strong_wind':
        return (typeof handleStrongWindSelection === 'function') ? handleStrongWindSelection : null;
    case 'super_buoyancy':
        return (typeof handleSuperBuoyancySelection === 'function') ? handleSuperBuoyancySelection : null;
    case 'super_gravity':
        return (typeof handleSuperGravitySelection === 'function') ? handleSuperGravitySelection : null;
    case 'teleport':
    case 'cell_teleport':
        return (typeof handleTeleportSelection === 'function') ? handleTeleportSelection : null;
    case 'tempt':
        return (typeof handleTemptSelection === 'function') ? handleTemptSelection : null;
    case 'capture':
        return (typeof handleCaptureSelection === 'function') ? handleCaptureSelection : null;
    case 'trap':
        return (typeof handleTrapSelection === 'function') ? handleTrapSelection : null;
    case 'guard':
        return (typeof handleGuardSelection === 'function') ? handleGuardSelection : null;
    case 'living_will':
        return (typeof handleLivingWillSelection === 'function') ? handleLivingWillSelection : null;
    case 'hyperactive_inherit':
        return (typeof handleHyperactiveInheritSelection === 'function') ? handleHyperactiveInheritSelection : null;
    case 'extend_life':
        return (typeof handleExtendLifeSelection === 'function') ? handleExtendLifeSelection : null;
    case 'corrosion':
        return (typeof handleCorrosionSelection === 'function') ? handleCorrosionSelection : null;
    case 'time_bomb':
        return (typeof handleTimeBombSelection === 'function') ? handleTimeBombSelection : null;
    case 'swap_with_enemy':
        return (typeof handleSwapSelection === 'function') ? handleSwapSelection : null;
    case 'position_swap':
        return (typeof handlePositionSwapSelection === 'function') ? handlePositionSwapSelection : null;
    case 'board_expansion':
        return (typeof handleBoardExpansionSelection === 'function') ? handleBoardExpansionSelection : null;
    case 'board_shrink':
        return (typeof handleBoardShrinkSelection === 'function') ? handleBoardShrinkSelection : null;
    case 'blockade':
        return (typeof handleBlockadeSelection === 'function') ? handleBlockadeSelection : null;
    case 'meteor':
        return (typeof handleMeteorSelection === 'function') ? handleMeteorSelection : null;
    case 'freeze':
        return (typeof handleFreezeSelection === 'function') ? handleFreezeSelection : null;
    case 'seed':
        return (typeof handleSeedSelection === 'function') ? handleSeedSelection : null;
    case 'clone':
        return (typeof handleCloneSelection === 'function') ? handleCloneSelection : null;
    case 'split':
        return (typeof handleSplitSelection === 'function') ? handleSplitSelection : null;
    default:
        return null;
    }
}

function clearPendingSelectionActionCacheForTurnManager() {
    var pendingCoordinator = resolvePendingCoordinatorForTurnManager();
    if (!pendingCoordinator) return false;
    if (typeof pendingCoordinator.clearPendingSelectionActionCache === 'function') {
        pendingCoordinator.clearPendingSelectionActionCache();
        return true;
    }
    if (typeof pendingCoordinator.clearPendingSelectionAction === 'function') {
        pendingCoordinator.clearPendingSelectionAction('black');
        pendingCoordinator.clearPendingSelectionAction('white');
        return true;
    }
    return false;
}

function resetGame() {
    // Auto mode removed: nothing to stop or reset

    // Hard cleanup before rebuilding state (F5 相当の再起動に近づける)
    // - stale playback/presentation queues can block board refresh
    // - UI transient overlays/flags may survive without a full page reload
    resetGameGeneration += 1;
    const currentResetGeneration = resetGameGeneration;
    const isCurrentResetGeneration = () => currentResetGeneration === resetGameGeneration;
    resetCpuTurnSchedulingStateForTurnManager();
    setTurnManagerBusyState({
        processing: false,
        cardAnimating: false,
        playbackActive: false
    });
    clearPlaybackLockForTurnManager();
    clearPendingSelectionActionCacheForTurnManager();
    try {
        if (cardState && typeof cardState === 'object') {
            if (Array.isArray(cardState.presentationEvents)) cardState.presentationEvents.length = 0;
            if (Array.isArray(cardState._presentationEventsPersist)) cardState._presentationEventsPersist.length = 0;
        }
    } catch (e) { /* ignore */ }
    try {
        const adapter = getTurnPipelineUIAdapter();
        if (adapter && typeof adapter.clearDeferredGeneratedThrowChainPlayback === 'function') {
            adapter.clearDeferredGeneratedThrowChainPlayback();
        }
    } catch (e) { /* ignore */ }
    try {
        if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.resetTransientUIState === 'function') {
            __uiImpl_turn_manager.resetTransientUIState();
        }
    } catch (e) { /* ignore */ }

    const clampCpuLevel = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return 1;
        return Math.max(1, Math.min(6, Math.floor(n)));
    };

    // Read CPU smartness from UI helper if available (avoid direct DOM access in game/)
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.readCpuSmartness === 'function') {
        const vals = __uiImpl_turn_manager.readCpuSmartness();
        cpuSmartness.black = clampCpuLevel((vals && vals.black) || cpuSmartness.black || 1);
        cpuSmartness.white = clampCpuLevel((vals && vals.white) || cpuSmartness.white || 1);
    }

    if (typeof updateCpuCharacter === 'function') {
        updateCpuCharacter();
    }

    let cardInitOptions = {};
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.buildCardInitOptions === 'function') {
        try {
            const built = __uiImpl_turn_manager.buildCardInitOptions();
            cardInitOptions = (built && typeof built === 'object') ? built : {};
        } catch (e) {
            console.warn('[resetGame] buildCardInitOptions failed:', e && e.message ? e.message : e);
            cardInitOptions = {};
        }
    } else if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.readActiveDeckSpec === 'function') {
        try {
            const activeDeckSpec = __uiImpl_turn_manager.readActiveDeckSpec();
            if (activeDeckSpec) {
                cardInitOptions = { initialDeckSpec: activeDeckSpec };
            }
        } catch (e) {
            console.warn('[resetGame] readActiveDeckSpec failed:', e && e.message ? e.message : e);
            cardInitOptions = {};
        }
    }

    let boardConfig = (cardInitOptions && typeof cardInitOptions === 'object' && cardInitOptions.boardConfig)
        ? cardInitOptions.boardConfig
        : null;
    if (!boardConfig && __uiImpl_turn_manager && typeof __uiImpl_turn_manager.readBoardConfig === 'function') {
        try {
            boardConfig = __uiImpl_turn_manager.readBoardConfig() || null;
        } catch (e) {
            console.warn('[resetGame] readBoardConfig failed:', e && e.message ? e.message : e);
        }
    }

    gameState = createGameState(boardConfig);
    try {
        // initCardState may rely on PRNG; if unavailable, tests should mock or skip
        if (typeof initCardState === 'function') initCardState(undefined, cardInitOptions);
    } catch (e) {
        // In test environments without PRNG, allow fallback to a minimal cardState via CardLogic
        console.warn('[resetGame] initCardState failed (test environment):', e.message);
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.createCardState === 'function') {
            const prngStub = { next: () => 0.5, _seed: 1 };
            const newState = CardLogic.createCardState(prngStub, cardInitOptions);
            // Wipe and copy properties to maintain global reference pattern
            if (typeof cardState !== 'undefined') {
                for (const k in cardState) delete cardState[k];
                Object.assign(cardState, newState);
            } else if (typeof global !== 'undefined') {
                global.cardState = global.cardState || newState;
            }
        }
    }

    // Reset ActionManager for new game
    if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
        ActionManager.ActionManager.reset();
        try { ActionManager.ActionManager.clearStorage(); } catch (e) { /* ignore */ }
        console.log('[resetGame] ActionManager reset and cleared storage');
    }

    // Clear UI log via helper if available (game/ must not touch DOM)
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.clearLogUI === 'function') {
        __uiImpl_turn_manager.clearLogUI();
    }

    try {
        if (typeof emitGameReset === 'function') {
            emitGameReset({
                turnNumber: 0
            });
        }
    } catch (e) { /* ignore */ }

    if (typeof emitLogAdded === 'function') {
        emitLogAdded(`ゲーム開始 (黒: Lv${cpuSmartness.black}, 白: Lv${cpuSmartness.white})`, 'normal');
    }
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e) { /* ignore */ }

    const runTurnStartAfterReset = () => {
        if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.onTurnStart === 'function') {
            return __uiImpl.onTurnStart(BLACK);
        }
        return onTurnStart(BLACK);
    };

    const runTurnStartAndPublishResetSnapshot = () => {
        if (!isCurrentResetGeneration()) return Promise.resolve(false);
        Promise.resolve()
            .then(() => {
                if (!isCurrentResetGeneration()) return false;
                return runTurnStartAfterReset();
            })
            .catch((error) => {
                if (!isCurrentResetGeneration()) return;
                console.error('onTurnStart error during reset:', error);
            })
            .finally(() => {
                if (!isCurrentResetGeneration()) return;
                publishNetworkResetSnapshot();
            });
    };

    // Lock input during initial dealing animation
    setTurnManagerBusyState({
        processing: true,
        cardAnimating: true
    });

    if (typeof dealInitialCards === 'function') {
        dealInitialCards()
            .then(() => {
                if (!isCurrentResetGeneration()) return;
                setTurnManagerBusyState({ processing: false });
                runTurnStartAndPublishResetSnapshot();
                if (typeof emitLogAdded === 'function') emitLogAdded('カード配布完了', 'normal');

            })
            .catch((err) => {
                if (!isCurrentResetGeneration()) return;
                console.error('Deal animation error:', err);
                if (typeof emitLogAdded === 'function') emitLogAdded('エラー: カード配布に失敗しました', 'normal');
            })
            .finally(() => {
                if (!isCurrentResetGeneration()) return;
                setTurnManagerBusyState({
                    cardAnimating: false,
                    processing: false
                });
            });
    } else {
        // No animation path (Phase2 safe-guard): continue immediately
        if (!isCurrentResetGeneration()) return;
        setTurnManagerBusyState({
            cardAnimating: false,
            processing: false
        });
        runTurnStartAndPublishResetSnapshot();
        if (typeof emitLogAdded === 'function') emitLogAdded('カード配布完了', 'normal');
    }

}

/**
 * ターン開始処理
 * Turn Start Logic coordination
 * @param {number} player - BLACK (1) or WHITE (-1)
 */
async function onTurnStart(player) {
    const playerKey = getPlayerKey(player);

    const safeIsProcessing = (typeof isProcessing !== 'undefined') ? isProcessing : undefined;
    const safeIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined;
    console.log('[DEBUG][onTurnStart] enter', { player, playerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, USE_TURN_PIPELINE: !!(__uiImpl_turn_manager && __uiImpl_turn_manager.USE_TURN_PIPELINE) });

    // Record hand size before turn start to detect if a draw happened
    const handSizeBefore = cardState.hands[playerKey].length;

    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[TURN-START] onTurnStart called for ${playerKey}, handBefore: ${handSizeBefore}, turnCount: ${cardState.turnCountByPlayer[playerKey]}`, 'info');
    }

    // 1. Shared Logic Turn Start (Reset flags, tick active effect durations, Draw)
    // Migrate turn-start logic into the turn pipeline phases and invoke the pipeline phase here
    // so that the *pipeline* (not UI) is the single writer of rule state.
    const _startEvents = [];
    let turnStartPlaybackEvents = [];
    if (typeof TurnPipelinePhases !== 'undefined' && typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {
        try {
            if (typeof Core === 'undefined') {
                console.error('[CRITICAL][onTurnStart] Core is undefined; TurnPipelinePhases.applyTurnStartPhase may fail');
            }
            // Provide runtime PRNG to pipeline so start-of-turn effects that need randomness can run in browser
            const runtimePrng = (typeof getGamePrng === 'function') ? getGamePrng() : ((typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.getGamePrng === 'function') ? __uiImpl.getGamePrng() : undefined);
            if (typeof console !== 'undefined' && console.log) console.log('[onTurnStart] runtimePrng available:', !!runtimePrng);
            TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, _startEvents, runtimePrng);
            // Convert any presentation events emitted during turn-start into PlaybackEvents
            const adapter = getTurnPipelineUIAdapter();
            if (adapter && typeof adapter.mapToPlaybackEvents === 'function'
                && typeof CardLogic !== 'undefined' && typeof CardLogic.flushPresentationEvents === 'function') {
                const pres = CardLogic.flushPresentationEvents(cardState) || [];
                turnStartPlaybackEvents = adapter.mapToPlaybackEvents(pres, cardState, gameState) || [];
                if (typeof adapter.appendSoundEffectPlaybackEvents === 'function') {
                    turnStartPlaybackEvents = adapter.appendSoundEffectPlaybackEvents(turnStartPlaybackEvents, _startEvents, pres) || turnStartPlaybackEvents;
                }
                if (typeof adapter.mapEffectLogsFromPipeline === 'function' && typeof emitEffectLog === 'function') {
                    const effectMsgs = adapter.mapEffectLogsFromPipeline(_startEvents, pres, playerKey) || [];
                    for (const m of effectMsgs) {
                        if (m) emitEffectLog(m);
                    }
                }
            }
        } catch (e) {
            console.error('[CRITICAL][onTurnStart] TurnPipelinePhases.applyTurnStartPhase threw', e && e.stack || e);
            // Continue gracefully - avoid bubbling exception to caller
        }
    } else {
        // Fail-fast: TurnPipelinePhases must be present in production (pipeline-only policy)
        // Browser builds without the pipeline are misconfigured; throw to surface the issue immediately.
        throw new Error('TurnPipelinePhases not available (pipeline-only policy)');
    }

    const handSizeAfter = cardState.hands[playerKey].length;
    const newTurnCount = cardState.turnCountByPlayer[playerKey];

    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[TURN-START] After turn-start phase: handAfter: ${handSizeAfter}, newTurnCount: ${newTurnCount}`, 'info');
    }

    console.log('[DEBUG][onTurnStart] exit', { playerKey, handSizeBefore, handSizeAfter, newTurnCount, isProcessing, isCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });

    // 2. Log
    const turnCount = gameState.turnNumber + 1;
    if (typeof emitLogAdded === 'function') emitLogAdded(`== ${getPlayerName(player)}のターン (${turnCount}手目) ==`, 'normal');

    // 3. Draw Animation (if draw happened during the turn-start phase)
    if (handSizeAfter > handSizeBefore) {
        // A card was drawn - convert to playback event and let AnimationEngine own the visuals.
        console.log(`[DRAW] Card drawn for ${playerKey}! handBefore=${handSizeBefore}, handAfter=${handSizeAfter}`);
        try {
            const drawnCardId = cardState.hands[playerKey][cardState.hands[playerKey].length - 1];
            if (drawnCardId !== null && drawnCardId !== undefined) {
                if (typeof emitLogAdded === 'function') emitLogAdded(`${getPlayerName(player)}がドローしました`, 'normal');
                const drawPresentation = { type: 'DRAW_CARD', player: playerKey, cardId: drawnCardId, count: 1 };
                const adapter = getTurnPipelineUIAdapter();
                if (adapter && typeof adapter.mapToPlaybackEvents === 'function') {
                    const drawPlayback = adapter.mapToPlaybackEvents([drawPresentation], cardState, gameState) || [];
                    if (drawPlayback.length > 0) {
                        const basePhase = turnStartPlaybackEvents.reduce((maxP, ev) => {
                            const p = Number(ev && ev.phase || 0);
                            return Number.isFinite(p) && p > maxP ? p : maxP;
                        }, 0);
                        for (const ev of drawPlayback) {
                            const srcPhase = Number(ev && ev.phase || 1);
                            ev.phase = basePhase + (Number.isFinite(srcPhase) ? srcPhase : 1);
                        }
                        turnStartPlaybackEvents.push(...drawPlayback);
                    } else {
                        // Fallback for unusual adapter behavior: persist as a presentation event.
                        try { emitPresentationEventViaBoardOps(drawPresentation); } catch (e) { /* ignore */ }
                    }
                } else {
                    // Fallback when adapter is unavailable.
                    try { emitPresentationEventViaBoardOps(drawPresentation); } catch (e) { /* ignore */ }
                }
            }
        } catch (err) {
            console.error('Draw animation error:', err);
        }
    }

    // 4. Special Effects (Bombs & Dragons & Breeding)
    // Use the precomputed _startEvents produced by TurnPipelinePhases.applyTurnStartPhase
    // so UI handlers do not re-run the pipeline nor mutate rule state directly.
    if (turnStartPlaybackEvents.length > 0) {
        try { emitPresentationEventViaBoardOps({ type: 'PLAYBACK_EVENTS', events: turnStartPlaybackEvents, meta: { source: 'turn_start' } }); } catch (e) { /* ignore */ }
        // Ensure UI consumes the playback events
        requestUIRender();
    }
    if (typeof processBombs === 'function') {
        await processBombs(_startEvents);
    }
    if (typeof processUltimateDestroyGodsAtTurnStart === 'function') {
        await processUltimateDestroyGodsAtTurnStart(player, null, _startEvents);
    }
    if (typeof processUltimateReverseDragonsAtTurnStart === 'function') {
        await processUltimateReverseDragonsAtTurnStart(player, _startEvents);
    }
    if (typeof processBreedingEffectsAtTurnStart === 'function') {
        await processBreedingEffectsAtTurnStart(player, _startEvents);
    }
    if (typeof processHyperactiveMovesAtTurnStart === 'function') {
        await processHyperactiveMovesAtTurnStart(player, null, _startEvents);
    }

    // 5. Update UI — queue a STATE_UPDATED presentation event; UI should consume and perform actual emits/renders
    try {
        const Notifier = require('./turn/notifier');
        Notifier.notifyUI(cardState, gameState, { stateChanged: true, cardStateChanged: true, render: true });
    } catch (e) {
        // As a safe fallback in unusual environments, keep the old behavior
        try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e2) {}
        try { if (typeof emitCardStateChange === 'function') emitCardStateChange(); } catch (e2) {}
        requestUIRender();
    }

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        setTurnManagerBusyState({ processing: false });
        return {
            playbackEvents: Array.isArray(turnStartPlaybackEvents) ? turnStartPlaybackEvents : []
        };
    }

    // Human-side safety: if no legal move and no usable card, force pass progression.
    // CPU side already has its own pass path, so limit this check to black / HvH.
    if ((player === BLACK || isHumanVsHumanModeEnabled()) && typeof ensureCurrentPlayerCanActOrPass === 'function') {
        try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }
    }

    // 7. DEBUG: Shared Hand Logic (opt-in only)
    if (typeof __uiImpl !== 'undefined' && __uiImpl && __uiImpl.DEBUG_SHARED_HAND) {
        if (cardState.hands.white.length > 0) {
            console.log('[DEBUG] Transferring White cards to Black for Shared Hand mode', cardState.hands.white);
            cardState.hands.black.push(...cardState.hands.white);
            cardState.hands.white = [];
            // Update UI again to reflect transfer
            if (typeof globalThis !== 'undefined' && typeof globalThis.requestCardUiSync === 'function') {
                globalThis.requestCardUiSync('turn-manager:shared-hand-debug');
            } else if (typeof renderCardUI === 'function') {
                renderCardUI();
            }
        }
    }

    return {
        playbackEvents: Array.isArray(turnStartPlaybackEvents) ? turnStartPlaybackEvents : []
    };
}

// ===== Watchdog: prevents permanent freeze if flags get stuck =====
var lastFlagActiveTime = null;
const WATCHDOG_TIMEOUT_MS = 10000;

// Watchdog timing moved to UI; expose a ping function so UI can schedule checks using its timing APIs
function watchdogPing(nowMs) {
    if (isAnimationInProgress()) {
        const now = (typeof nowMs === 'number') ? nowMs : null;
        if (now === null) return;
        if (lastFlagActiveTime === null) {
            lastFlagActiveTime = now;
        } else if (now - lastFlagActiveTime > WATCHDOG_TIMEOUT_MS) {
            console.warn('[WATCHDOG] Flags stuck for too long. Force clearing...', {
                isProcessing: readTurnManagerProcessing(),
                isCardAnimating: readTurnManagerCardAnimating()
            });
            setTurnManagerBusyState({
                processing: false,
                cardAnimating: false
            });
            clearPlaybackLockForTurnManager();
            lastFlagActiveTime = null;
            if (typeof emitLogAdded === 'function') emitLogAdded('警告: 処理が長時間停滞したため強制解除しました', 'normal');
            try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
        }
    } else {
        lastFlagActiveTime = null;
    }
}

// UI attachment note:
// Legacy code previously exported helpers directly onto global scope. That behavior has been
// moved to UI layer (e.g., `ui/bootstrap.js`) which may attach these or call into the
// functions exported by this module. The functions remain available via CommonJS via
// `require('../game/turn-manager')`. 

// Periodic action save moved to UI

// Module exports for tests / commonjs
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        resetGame,
        onTurnStart,
        handleCellClick,
        isAnimationInProgress,
        setUIImpl,
        startActionSaveInterval,
        stopActionSaveInterval,
        watchdogPing,
        canLocalUserOperateCurrentTurn,
        setTurnManagerTimerService,
        // Expose helper for testing / minimal UI integrations
        requestUIRender
    };
}

// Ensure resetGame is available to legacy UI handlers that call it directly (e.g., init.js click handlers)
try {
    if (typeof globalThis !== 'undefined') {
        try { globalThis.resetGame = resetGame; } catch (e) { /* ignore */ }
    }
    // Also register with UIBootstrap if available for more canonical UI registration
    try {
        const uiBootstrap = require('../shared/ui-bootstrap-shared');
        if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') uiBootstrap.registerUIGlobals({ resetGame });
    } catch (e) { /* ignore in headless/test env */ }
} catch (e) { /* ignore */ }
// Periodic ActionManager save: moved to UI. Expose start/stop functions so UI can opt-in.
var _actionSaveIntervalId = null;
function startActionSaveInterval() {
    // No-op in headless game module. UI should start periodic saves using its own timing APIs.
}
function stopActionSaveInterval() {
    // No-op
}
