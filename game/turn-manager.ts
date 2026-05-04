
import type { CardState, GameState, PlayerKey } from '../src/types';

declare const debugLog: any;
declare const executeMove: any;
declare const updateCpuCharacter: any;
declare const initCardState: any;
declare const dealInitialCards: any;
declare const getGamePrng: any;
// Card effect selection handlers (injected by UI bootstrap / card-effects modules)
declare const handleDestroySelection: any;
declare const handleStrongWindSelection: any;
declare const handleSuperBuoyancySelection: any;
declare const handleSuperGravitySelection: any;
declare const handleTeleportSelection: any;
declare const handleTemptSelection: any;
declare const handleCaptureSelection: any;
declare const handleTrapSelection: any;
declare const handleGuardSelection: any;
declare const handleLivingWillSelection: any;
declare const handleHyperactiveInheritSelection: any;
declare const handleExtendLifeSelection: any;
declare const handleCorrosionSelection: any;
declare const handleTimeBombSelection: any;
declare const handleSwapSelection: any;
declare const handlePositionSwapSelection: any;
declare const handleBoardExpansionSelection: any;
declare const handleBoardShrinkSelection: any;
declare const handleBlockadeSelection: any;
declare const handleMeteorSelection: any;
declare const handleFreezeSelection: any;
declare const handleSeedSelection: any;
declare const handleCloneSelection: any;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

// ===== Explicit imports (replacing free variable references) =====
const { BLACK, WHITE } = _require('../shared-constants');
const ControllerEvents = _require('./controller-events');
const { emitBoardUpdate, emitGameStateChange, emitCardStateChange, emitLogAdded, emitGameReset, emitEffectLog } = ControllerEvents;
const cardEffectsHelpers = _require('./card-effects/helpers');
const { getActiveProtectionForPlayer } = cardEffectsHelpers;
const { getFlipBlockers } = _require('./special-effects/helpers');
const CardLogic = _require('./logic/cards');
const Core = _require('./logic/core');
const { createGameState, isGameOver } = Core;
const TurnPipelinePhases = _require('./turn/turn_pipeline_phases');
const { isDebugLogAvailable } = _require('../is-env-capable');
const { ensureCurrentPlayerCanActOrPass } = _require('./pass-handler');
const OwnerHelpersModule = _require('../utils/owner-helpers');
const MoveGeneratorModule = _require('./move-generator');
const BoardPresentation = _require('./logic/presentation');
const TurnPipelineUIAdapter = _require('./turn/pipeline_ui_adapter');
const PendingCoordinatorForTurnManager = _require('./turn/pending-coordinator');
const ActionManagerModule = _require('./schema/action_manager');
const BombsModule = _require('./special-effects/bombs');
const UDGModule = _require('./special-effects/udg');
const DragonsModule = _require('./special-effects/dragons');
const BreedingModule = _require('./special-effects/breeding');
const HyperactiveModule = _require('./special-effects/hyperactive');
const { resetCpuTurnHandlerState } = _require('./cpu-turn-handler');
// Note: debugLog is a global function set by UI bootstrap; use with typeof guard

/**
 * @file turn-manager.js
 * Core turn wiring: user input, animation gate checks, player key helpers, and game reset entrypoint.
 */

// Shared timing constants for turn/animation sequencing
var getAnimationTiming;
if (typeof require === 'function') {
    try { ({ getAnimationTiming } = _require('../constants/animation-constants')); } catch (e) { /* ignore */ }
}
const FLIP_ANIMATION_DURATION_MS = (typeof getAnimationTiming === 'function' ? getAnimationTiming('FLIP_ANIMATION_DURATION') : 600) || 600;
// @compat - __BENCH_FAST_MODE set by test scripts / run-ui-level-match.ts via globalThis
const CPU_TURN_DELAY_MS = (typeof globalThis !== 'undefined' && (globalThis as any).__BENCH_FAST_MODE === true) ? 0 : 600;
const ANIMATION_RETRY_DELAY_MS = 80;
const DOUBLE_PLACE_PASS_DELAY_MS = 250;
const BLACK_PASS_DELAY_MS = 1000;

// BoardPresentation and TurnPipelineUIAdapter are imported directly at top of file
// TurnPipelineUIAdapter accessor (returns imported module)
function getTurnPipelineUIAdapter() {
    return TurnPipelineUIAdapter;
}

// resetCpuTurnHandlerState is imported directly at top of file
function resetCpuTurnSchedulingStateForTurnManager() {
    if (resetCpuTurnHandlerState) {
        // resetCpuTurnHandlerState imported directly
        resetCpuTurnHandlerState();
    }
}

function getPlaybackStateForTurnManager() {
    try {
        // globalThis read — UI/bootstrap dependency, keep
            if (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackStateManager) {
            return (globalThis as any).PlaybackStateManager;
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
    return localProcessing;
}

function readTurnManagerCardAnimating() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
        return playbackState.getCardAnimating() === true;
    }
    const localCardAnimating = (typeof __uiImpl !== 'undefined' && typeof __uiImpl.isCardAnimating !== 'undefined')
        ? __uiImpl.isCardAnimating
        : (typeof isCardAnimating !== 'undefined' ? isCardAnimating : false);
    return localCardAnimating;
}

function setTurnManagerBusyState(options: any) {
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
    // Write to module-level variables instead of globalThis
    try {
        if (hasPlaybackActive) {
            VisualPlaybackActive = nextPlaybackActive;
            if (nextPlaybackActive) {
                if (!Number.isFinite(Number(__playbackActiveSince))) {
                    __playbackActiveSince = Date.now();
                }
            } else {
                __playbackActiveSince = null;
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
    return VisualPlaybackActive === true;
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
        const startedAt = Number(__playbackActiveSince);
        return Number.isFinite(startedAt) ? startedAt : null;
    } catch (e) { /* ignore */ }
    return null;
}

function isPlaybackRunningForTurnManager() {
    try {
        // globalThis read — UI/bootstrap dependency, keep
        if (
            typeof globalThis !== 'undefined' &&
            (globalThis as any).AnimationEngine &&
            typeof (globalThis as any).AnimationEngine.isPlaying === 'boolean'
        ) {
            return (globalThis as any).AnimationEngine.isPlaying === true;
        }
    } catch (e) { /* ignore */ }
    return null;
}

// @compat - PASS_STALE_PLAYBACK_MS local constant (was previously read from globalThis)
const PASS_STALE_PLAYBACK_MS = 3500;

function getStalePlaybackTimeoutMsForTurnManager() {
    return PASS_STALE_PLAYBACK_MS;
}

function isStalePlaybackLockForTurnManager(options: any) {
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

function releaseStalePlaybackLockForTurnManager(options: any) {
    if (!isStalePlaybackLockForTurnManager(options)) return false;
    clearPlaybackLockForTurnManager();
    return true;
}

function emitPresentationEventViaBoardOps(ev: any) {
    try {
        // BoardPresentation is imported directly at top of file
        if (BoardPresentation && typeof BoardPresentation.emitPresentationEvent === 'function') return BoardPresentation.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    try {
        // globalThis read — UI/bootstrap dependency, keep
        const ops = (typeof globalThis !== 'undefined' && (globalThis as any).BoardOps && typeof (globalThis as any).BoardOps.emitPresentationEvent === 'function')
            ? (globalThis as any).BoardOps
            : null;
        if (ops) {
            ops.emitPresentationEvent(cardState, ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    // Silent fallback: presentation helper may not be available during early bootstrap.
    return false;
} 

// Configuration and UI-DI (module-level config, no globalThis writes)
let __uiImpl_turn_manager: any = {};
function setUIImpl(obj: any) {
    __uiImpl_turn_manager = Object.assign({}, __uiImpl_turn_manager, obj || {});
}

// Module-scoped UI locks (local state; replaces globalThis writes)
let isProcessing: any;
let isCardAnimating: any;
let VisualPlaybackActive: any;
let __playbackActiveSince: any;
let cpuSmartness = { black: 1, white: 1 }; // @compat - read by some modules via globalThis, keep until Wave F
var resetGameGeneration = 0;

// TimerService DI
let turnManagerTimerService: any = null;
function setTurnManagerTimerService(service: any) { turnManagerTimerService = service; }
function getTurnManagerTimerService() {
    if (turnManagerTimerService) return turnManagerTimerService;
    try {
        const { createTimerService } = _require('./timer-service');
        turnManagerTimerService = createTimerService('browser');
        return turnManagerTimerService;
    } catch (e) {
        return null;
    }
}

// Prefer shared scheduling helper when available; fallback to TimerService or setTimeout
let scheduleRetry = null;
const tu = _require('./timer-utils'); if (tu && typeof tu.scheduleRetry === 'function') scheduleRetry = tu.scheduleRetry; 
if (!scheduleRetry) {
    scheduleRetry = (fn: any, delayMs: any) => {
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
        const hasQueuedPlaybackEvents = (queue: any) => Array.isArray(queue)
            && queue.some((event) => event && event.type === 'PLAYBACK_EVENTS');
        return hasQueuedPlaybackEvents(cardState.presentationEvents)
            || hasQueuedPlaybackEvents(cardState._presentationEventsPersist);
    } catch (e) { /* ignore */ }
    return false;
}
function handleCellClick(row: number, col: number) {
    if (isDebugLogAvailable()) {
        debugLog(`[CELL-CLICK] User clicked (${row},${col})`, 'debug', {
            currentPlayer: gameState.currentPlayer,
            isAnimationInProgress: isAnimationInProgress()
        });
    }



    // Auto mode owns progression; ignore manual board input.
    // globalThis read — UI/bootstrap dependency, keep
    if (typeof globalThis !== 'undefined' && (globalThis as any).AUTO_MODE_ACTIVE === true) return;

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
    const perma = getFlipBlockers();  // getFlipBlockers imported directly
    const _findMoveForCell = MoveGeneratorModule && MoveGeneratorModule.findMoveForCell;
    const move = _findMoveForCell ? _findMoveForCell(gameState.currentPlayer, row, col, pending, protection, perma) : null;
    if (!move) {
        if (isDebugLogAvailable()) {
            debugLog(`[MOVE] Invalid move attempted at (${row},${col})`, 'warn', {
                currentPlayer: gameState.currentPlayer,
                hasPending: !!pending
            });
        }
        return;
    }

    if (isDebugLogAvailable()) {
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

function shouldAllowPendingSelectionDuringAnimation(playerKey: any, pending: any, pendingDispatchKey: any) {
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
        // globalThis read — UI/bootstrap dependency, keep
        matchMode = (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function')
            ? (globalThis as any).getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? (globalThis as any).MATCH_MODE : null);
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
        // globalThis read — UI/bootstrap dependency, keep
        const matchMode = (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function')
            ? (globalThis as any).getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? (globalThis as any).MATCH_MODE : null);
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
        const nmClient = getNetworkMatchClientForTurnManager();
        if (nmClient && typeof nmClient.getSeatKey === 'function') {
            const seatKey = nmClient.getSeatKey();
            if (seatKey === 'white' || seatKey === 'black') return seatKey;
        }
        // LOCAL_PLAYER_KEY / BOARD_VIEWER_KEY via DI (setUIImpl)
        const impl = __uiImpl_turn_manager;
        if (impl) {
            const directKeys = [impl.LOCAL_PLAYER_KEY, impl.__LOCAL_PLAYER_KEY, impl.BOARD_VIEWER_KEY];
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

// globalThis read — UI/bootstrap dependency, keep (consolidated accessor)
function getNetworkMatchClientForTurnManager() {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).NetworkMatchClient) {
            return (globalThis as any).NetworkMatchClient;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function createNetworkResetAction(playerKey: any) {
    const normalizedPlayerKey = playerKey === 'white' ? 'white' : 'black';
    return {
        type: 'reset_game',
        playerKey: normalizedPlayerKey
    };
}

function publishNetworkResetSnapshot() {
    try {
        if (!isNetworkModeForTurnManager()) return;

        const client = getNetworkMatchClientForTurnManager();
        if (!client || typeof client.publishSnapshot !== 'function') return;
        if (typeof client.isActive === 'function' && !client.isActive()) return;

        const playerKey = resolveNetworkLocalPlayerKey();
        client.publishSnapshot({
            playerKey,
            actionType: 'reset_game',
            action: createNetworkResetAction(playerKey),
            playbackEvents: []
        });
    } catch (e) { /* ignore */ }
}

function getPlayerKey(player: any) {
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
        if (player === BLACK) return 'black';
        if (player === WHITE) return 'white';
    } catch (e) { /* ignore */ }
    return 'black';
}

function getPlayerName(player: any) {
    return getPlayerKey(player) === 'black' ? '黒' : '白';
}

// Request a UI render via event (no direct UI calls)
function requestUIRender() {
    try { emitBoardUpdate(); } catch (e) { /* ignore UI errors */ }
}

function resolvePendingCoordinatorForTurnManager() {
    // PendingCoordinatorForTurnManager is imported directly at top of file
    return (PendingCoordinatorForTurnManager && typeof PendingCoordinatorForTurnManager === 'object')
        ? PendingCoordinatorForTurnManager
        : null;
}

function resolvePendingSelectionDispatchKeyForTurnManager(pendingType: any) {
    var pendingCoordinator = resolvePendingCoordinatorForTurnManager();
    if (!pendingCoordinator || typeof pendingCoordinator.resolvePendingSelectionDispatchKey !== 'function') {
        return null;
    }
    return pendingCoordinator.resolvePendingSelectionDispatchKey(pendingType);
}

function readPendingForTurnManager(playerKey: any) {
    var pendingCoordinator = resolvePendingCoordinatorForTurnManager();
    if (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function') {
        return pendingCoordinator.readPendingEffect(cardState, playerKey);
    }
    return (cardState && cardState.pendingEffectByPlayer)
        ? (cardState.pendingEffectByPlayer[playerKey] || null)
        : null;
}

function resolveBoardPendingSelectionHandlerForTurnManager(dispatchKey: any) {
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

    const clampCpuLevel = (value: any) => {
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

    let cardInitOptions: any = {};
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.buildCardInitOptions === 'function') {
        try {
            const built = __uiImpl_turn_manager.buildCardInitOptions();
            cardInitOptions = (built && typeof built === 'object') ? built : {};
        } catch (e) {
            console.warn('[resetGame] buildCardInitOptions failed:', e && (e as any).message ? (e as any).message : e);
            cardInitOptions = {};
        }
    } else if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.readActiveDeckSpec === 'function') {
        try {
            const activeDeckSpec = __uiImpl_turn_manager.readActiveDeckSpec();
            if (activeDeckSpec) {
                cardInitOptions = { initialDeckSpec: activeDeckSpec };
            }
        } catch (e) {
            console.warn('[resetGame] readActiveDeckSpec failed:', e && (e as any).message ? (e as any).message : e);
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
            console.warn('[resetGame] readBoardConfig failed:', e && (e as any).message ? (e as any).message : e);
        }
    }

    (globalThis as any).gameState = createGameState(boardConfig);
    try {
        // initCardState may rely on PRNG; if unavailable, tests should mock or skip
        if (typeof initCardState === 'function') initCardState(undefined, cardInitOptions);
    } catch (e) {
        // In test environments without PRNG, allow fallback to a minimal cardState via CardLogic
        console.warn('[resetGame] initCardState failed (test environment):', (e as any).message);
        if (typeof CardLogic.createCardState === 'function') {  // CardLogic imported directly
            const prngStub = { next: () => 0.5, _seed: 1, shuffle: (array: any[]) => array };
            const newState = CardLogic.createCardState(prngStub, cardInitOptions);
            // Wipe and copy properties to maintain global reference pattern
            if (typeof cardState !== 'undefined') {
                for (const k in cardState) delete cardState[k];
                Object.assign(cardState, newState);
            } else if (typeof global !== 'undefined') {
                (global as any).cardState = (global as any).cardState || newState;
            }
        }
    }

    // Reset ActionManager for new game
    if (ActionManagerModule && ActionManagerModule.ActionManager) {
        ActionManagerModule.ActionManager.reset();
        try { ActionManagerModule.ActionManager.clearStorage(); } catch (e) { /* ignore */ }
        console.log('[resetGame] ActionManager reset and cleared storage');
    }

    // Clear UI log via helper if available (game/ must not touch DOM)
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.clearLogUI === 'function') {
        __uiImpl_turn_manager.clearLogUI();
    }

    try {
        emitGameReset({ turnNumber: 0 });
    } catch (e) { /* ignore */ }

    emitLogAdded(`ゲーム開始 (黒: Lv${cpuSmartness.black}, 白: Lv${cpuSmartness.white})`, 'normal');
    try { emitBoardUpdate(); } catch (e) { /* ignore */ }
    try { emitGameStateChange(); } catch (e) { /* ignore */ }

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
                emitLogAdded('カード配布完了', 'normal');

    })
    .catch((err: any) => {
                if (!isCurrentResetGeneration()) return;
                console.error('Deal animation error:', err);
                emitLogAdded('エラー: カード配布に失敗しました', 'normal');
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
        emitLogAdded('カード配布完了', 'normal');
    }

}

/**
 * ターン開始処理
 * Turn Start Logic coordination
 * @param {number} player - BLACK (1) or WHITE (-1)
 */
async function onTurnStart(player: number) {
    const playerKey = getPlayerKey(player);

    const safeIsProcessing = (typeof isProcessing !== 'undefined') ? isProcessing : undefined;
    const safeIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? isCardAnimating : undefined;
    if (isDebugLogAvailable()) console.log('[DEBUG][onTurnStart] enter', { player, playerKey, isProcessing: safeIsProcessing, isCardAnimating: safeIsCardAnimating, USE_TURN_PIPELINE: !!(__uiImpl_turn_manager && __uiImpl_turn_manager.USE_TURN_PIPELINE) });

    // Record hand size before turn start to detect if a draw happened
    const handSizeBefore = cardState.hands[playerKey].length;

    if (isDebugLogAvailable()) {
        debugLog(`[TURN-START] onTurnStart called for ${playerKey}, handBefore: ${handSizeBefore}, turnCount: ${cardState.turnCountByPlayer[playerKey]}`, 'info');
    }

    // 1. Shared Logic Turn Start (Reset flags, tick active effect durations, Draw)
    // Migrate turn-start logic into the turn pipeline phases and invoke the pipeline phase here
    // so that the *pipeline* (not UI) is the single writer of rule state.
    const _startEvents: any[] = [];
    let turnStartPlaybackEvents = [];
    if (typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {  // TurnPipelinePhases imported directly
        try {
            if (!Core) {
                console.error('[CRITICAL][onTurnStart] Core is undefined; TurnPipelinePhases.applyTurnStartPhase may fail');
            }
            // Provide runtime PRNG to pipeline so start-of-turn effects that need randomness can run in browser
            const runtimePrng = (typeof getGamePrng === 'function') ? getGamePrng() : ((typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.getGamePrng === 'function') ? __uiImpl.getGamePrng() : undefined);
            if (isDebugLogAvailable()) console.log('[onTurnStart] runtimePrng available:', !!runtimePrng);
            TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, _startEvents, runtimePrng);
            // Convert any presentation events emitted during turn-start into PlaybackEvents
            const adapter = getTurnPipelineUIAdapter();
            if (adapter && typeof adapter.mapToPlaybackEvents === 'function'
                && typeof CardLogic.flushPresentationEvents === 'function') {  // CardLogic imported directly
                const pres = CardLogic.flushPresentationEvents(cardState) || [];
                turnStartPlaybackEvents = adapter.mapToPlaybackEvents(pres, cardState, gameState) || [];
                if (typeof adapter.appendSoundEffectPlaybackEvents === 'function') {
                    turnStartPlaybackEvents = adapter.appendSoundEffectPlaybackEvents(turnStartPlaybackEvents, _startEvents, pres) || turnStartPlaybackEvents;
                }
                if (typeof adapter.mapEffectLogsFromPipeline === 'function') {  // emitEffectLog imported directly
                    const effectMsgs = adapter.mapEffectLogsFromPipeline(_startEvents, pres, playerKey) || [];
                    for (const m of effectMsgs) {
                        if (m) emitEffectLog(m);
                    }
                }
            }
        } catch (e) {
            console.error('[CRITICAL][onTurnStart] TurnPipelinePhases.applyTurnStartPhase threw', e && (e as any).stack || e);
            // Continue gracefully - avoid bubbling exception to caller
        }
    } else {
        // Fail-fast: TurnPipelinePhases must be present in production (pipeline-only policy)
        // Browser builds without the pipeline are misconfigured; throw to surface the issue immediately.
        throw new Error('TurnPipelinePhases not available (pipeline-only policy)');
    }

    const handSizeAfter = cardState.hands[playerKey].length;
    const newTurnCount = cardState.turnCountByPlayer[playerKey];

    if (isDebugLogAvailable()) {
        debugLog(`[TURN-START] After turn-start phase: handAfter: ${handSizeAfter}, newTurnCount: ${newTurnCount}`, 'info');
    }

    if (isDebugLogAvailable()) console.log('[DEBUG][onTurnStart] exit', { playerKey, handSizeBefore, handSizeAfter, newTurnCount, isProcessing, isCardAnimating, pendingEffect: cardState.pendingEffectByPlayer });

    // 2. Log
    const turnCount = gameState.turnNumber + 1;
    emitLogAdded(`== ${getPlayerName(player)}のターン (${turnCount}手目) ==`, 'normal');

    // 3. Draw Animation (if draw happened during the turn-start phase)
    if (handSizeAfter > handSizeBefore) {
        // A card was drawn - convert to playback event and let AnimationEngine own the visuals.
        console.log(`[DRAW] Card drawn for ${playerKey}! handBefore=${handSizeBefore}, handAfter=${handSizeAfter}`);
        try {
            const drawnCardId = cardState.hands[playerKey][cardState.hands[playerKey].length - 1];
            if (drawnCardId !== null && drawnCardId !== undefined) {
                emitLogAdded(`${getPlayerName(player)}がドローしました`, 'normal');
                const drawPresentation = { type: 'DRAW_CARD', player: playerKey, cardId: drawnCardId, count: 1 };
                const adapter = getTurnPipelineUIAdapter();
                if (adapter && typeof adapter.mapToPlaybackEvents === 'function') {
                    const drawPlayback = adapter.mapToPlaybackEvents([drawPresentation], cardState, gameState) || [];
                    if (drawPlayback.length > 0) {
                        const basePhase = turnStartPlaybackEvents.reduce((maxP: any, ev: any) => {
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
    // processBombs etc. are accessed via imported modules
    if (typeof BombsModule.processBombs === 'function') {
        await BombsModule.processBombs(_startEvents);
    }
    if (typeof UDGModule.processUltimateDestroyGodsAtTurnStart === 'function') {
        await UDGModule.processUltimateDestroyGodsAtTurnStart(player, null, _startEvents);
    }
    if (typeof DragonsModule.processUltimateReverseDragonsAtTurnStart === 'function') {
        await DragonsModule.processUltimateReverseDragonsAtTurnStart(player, _startEvents);
    }
    if (typeof BreedingModule.processBreedingEffectsAtTurnStart === 'function') {
        await BreedingModule.processBreedingEffectsAtTurnStart(player, _startEvents);
    }
    if (typeof HyperactiveModule.processHyperactiveMovesAtTurnStart === 'function') {
        await HyperactiveModule.processHyperactiveMovesAtTurnStart(player, null, _startEvents);
    }

    // 5. Update UI — queue a STATE_UPDATED presentation event; UI should consume and perform actual emits/renders
    try {
        const Notifier = _require('./turn/notifier');
        Notifier.notifyUI(cardState, gameState, { stateChanged: true, cardStateChanged: true, render: true });
    } catch (e) {
        // As a safe fallback in unusual environments, keep the old behavior
        try { emitGameStateChange(); } catch (e2) { /* Intentionally empty: safe fallback emission */ }
        try { emitCardStateChange(); } catch (e2) { /* Intentionally empty: safe fallback emission */ }
        requestUIRender();
    }

    if (isGameOver(gameState)) {  // isGameOver imported from Core
        if (typeof showResult === 'function') showResult();
        setTurnManagerBusyState({ processing: false });
        return {
            playbackEvents: Array.isArray(turnStartPlaybackEvents) ? turnStartPlaybackEvents : []
        };
    }

    // Human-side safety: if no legal move and no usable card, force pass progression.
    // CPU side already has its own pass path, so limit this check to black / HvH.
    if (player === BLACK || isHumanVsHumanModeEnabled()) {
        try { ensureCurrentPlayerCanActOrPass({ useBlackDelay: true }); } catch (e) { /* ignore */ }  // ensureCurrentPlayerCanActOrPass imported directly
    }

    // 7. DEBUG: Shared Hand Logic (opt-in only)
    if (typeof __uiImpl !== 'undefined' && __uiImpl && __uiImpl.DEBUG_SHARED_HAND) {
        if (cardState.hands.white.length > 0) {
            console.log('[DEBUG] Transferring White cards to Black for Shared Hand mode', cardState.hands.white);
            cardState.hands.black.push(...cardState.hands.white);
            cardState.hands.white = [];
            // Update UI again to reflect transfer
            // globalThis read — UI/bootstrap dependency, keep
            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).requestCardUiSync === 'function') {
                (globalThis as any).requestCardUiSync('turn-manager:shared-hand-debug');
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
var lastFlagActiveTime: any = null;
const WATCHDOG_TIMEOUT_MS = 10000;

// Watchdog timing moved to UI; expose a ping function so UI can schedule checks using its timing APIs
function watchdogPing(nowMs: any) {
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
            emitLogAdded('警告: 処理が長時間停滞したため強制解除しました', 'normal');
            try { emitBoardUpdate(); } catch (e) { /* ignore */ }
        }
    } else {
        lastFlagActiveTime = null;
    }
}

// UI attachment note:
// Legacy code previously exported helpers directly onto global scope. That behavior has been
// moved to UI layer (e.g., `ui/bootstrap.js`) which may attach these or call into the
// functions exported by this module. The functions remain available via CommonJS via
// `_require('../game/turn-manager')`. 

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

// @compat - legacy UI entry points; keep until Wave F (entry-browser.js provides these via Object.assign(window, mod))
try {
    if (typeof globalThis !== 'undefined') {
        try { (globalThis as any).resetGame = resetGame; } catch (e) { /* ignore */ }
        try { (globalThis as any).handleCellClick = handleCellClick; } catch (e) { /* ignore */ }
    }
    // @compat - registerUIGlobals notification; keep until Wave F
    try {
        const uiBootstrap = _require('../shared/ui-bootstrap-shared');
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

export = {
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
    requestUIRender
};
