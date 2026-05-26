
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
declare const handleBuoyancySelection: any;
declare const handleSuperBuoyancySelection: any;
declare const handleGravitySelection: any;
declare const handleSuperGravitySelection: any;
declare const handleSuperAttractionSelection: any;
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
let OwnerHelpersModule: any = null;
try {
    OwnerHelpersModule = _require('../utils/owner-helpers');
} catch (e) {
    OwnerHelpersModule = null;
}
const MoveGeneratorModule = _require('./move-generator');
const MoveExecutorModule = _require('./move-executor');
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
// Note: debugLog is a legacy function set by UI bootstrap; use with typeof guard

/**
 * @file turn-manager.js
 * Core turn wiring: user input, animation gate checks, player key helpers, and game reset entrypoint.
 */

// Shared timing constants for turn/animation sequencing
var getAnimationTiming: any;
if (typeof require === 'function') {
    try { ({ getAnimationTiming } = _require('../constants/animation-constants')); } catch (e) { /* ignore */ }
}
const FLIP_ANIMATION_DURATION_MS = (typeof getAnimationTiming === 'function' ? getAnimationTiming('FLIP_ANIMATION_DURATION') : 600) || 600;
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
        const playbackState = readTurnManagerRuntimeValue('PlaybackStateManager');
        if (playbackState) return playbackState;
    } catch (e) { /* ignore */ }
    return null;
}

function readTurnManagerProcessing() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.getProcessing === 'function') {
        return playbackState.getProcessing() === true;
    }
    const runtimeProcessing = typeof readTurnManagerRuntimeValue('isProcessing') !== 'undefined'
        ? readTurnManagerRuntimeValue('isProcessing')
        : undefined;
    const localProcessing = (typeof __uiImpl !== 'undefined' && typeof __uiImpl.isProcessing !== 'undefined')
        ? __uiImpl.isProcessing
        : (typeof isProcessing !== 'undefined' ? isProcessing : runtimeProcessing);
    return localProcessing;
}

function readTurnManagerCardAnimating() {
    const playbackState = getPlaybackStateForTurnManager();
    if (playbackState && typeof playbackState.getCardAnimating === 'function') {
        return playbackState.getCardAnimating() === true;
    }
    const runtimeCardAnimating = typeof readTurnManagerRuntimeValue('isCardAnimating') !== 'undefined'
        ? readTurnManagerRuntimeValue('isCardAnimating')
        : undefined;
    const localCardAnimating = (typeof __uiImpl !== 'undefined' && typeof __uiImpl.isCardAnimating !== 'undefined')
        ? __uiImpl.isCardAnimating
        : (typeof isCardAnimating !== 'undefined' ? isCardAnimating : runtimeCardAnimating);
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
        if (hasProcessing) writeTurnManagerRuntimeValue('isProcessing', nextProcessing);
    } catch (e) { /* ignore */ }
    try {
        if (hasCardAnimating) isCardAnimating = nextCardAnimating;
    } catch (e) { /* ignore */ }
    try {
        if (hasCardAnimating) writeTurnManagerRuntimeValue('isCardAnimating', nextCardAnimating);
    } catch (e) { /* ignore */ }
    try {
        if (hasPlaybackActive) {
            VisualPlaybackActive = nextPlaybackActive;
            writeTurnManagerRuntimeValue('VisualPlaybackActive', nextPlaybackActive);
            if (nextPlaybackActive) {
                if (!Number.isFinite(Number(__playbackActiveSince))) {
                    __playbackActiveSince = Date.now();
                }
                if (!Number.isFinite(Number(readTurnManagerRuntimeValue('__playbackActiveSince')))) {
                    writeTurnManagerRuntimeValue('__playbackActiveSince', __playbackActiveSince);
                }
            } else {
                __playbackActiveSince = null;
                writeTurnManagerRuntimeValue('__playbackActiveSince', null);
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
    try {
        const runtimePlaybackActive = readTurnManagerRuntimeValue('VisualPlaybackActive');
        if (typeof runtimePlaybackActive !== 'undefined') {
            return runtimePlaybackActive === true;
        }
    } catch (e) { /* ignore */ }
    return VisualPlaybackActive === true;
}

function emitLogAddedForTurnManager(message: any, level?: any) {
    try {
        const emitLogAddedRuntime = readTurnManagerRuntimeFunction('emitLogAdded');
        if (emitLogAddedRuntime) return emitLogAddedRuntime(message, level);
    } catch (e) { /* ignore */ }
    return emitLogAdded(message, level);
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
        const startedAt = Number(typeof __playbackActiveSince !== 'undefined' ? __playbackActiveSince : readTurnManagerRuntimeValue('__playbackActiveSince'));
        return Number.isFinite(startedAt) ? startedAt : null;
    } catch (e) { /* ignore */ }
    return null;
}

function isPlaybackRunningForTurnManager() {
    try {
        const animationEngine = readTurnManagerRuntimeValue('AnimationEngine');
        if (animationEngine && typeof animationEngine.isPlaying === 'boolean') {
            return animationEngine.isPlaying === true;
        }
    } catch (e) { /* ignore */ }
    return null;
}

// @compat - PASS_STALE_PLAYBACK_MS local constant (was previously read from runtime root)
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
        const ops = readTurnManagerRuntimeValue('BoardOps');
        if (ops) {
            ops.emitPresentationEvent(cardState, ev);
            return true;
        }
    } catch (e) { /* ignore */ }
    // Silent fallback: presentation helper may not be available during early bootstrap.
    return false;
} 

// Configuration and UI-DI (module-level config, no runtime-root writes)
let __uiImpl_turn_manager: any = {};
function setUIImpl(obj: any) {
    __uiImpl_turn_manager = Object.assign({}, __uiImpl_turn_manager, obj || {});
    return getUIImpl();
}
function replaceUIImpl(obj: any) {
    const previous = __uiImpl_turn_manager || {};
    const next = Object.assign({}, obj || {});
    for (const key of ['getRuntimeRoot', 'readRuntimeValue', 'writeRuntimeValue', 'runtimeRoot']) {
        if (typeof next[key] === 'undefined' && typeof previous[key] !== 'undefined') {
            next[key] = previous[key];
        }
    }
    __uiImpl_turn_manager = next;
    return getUIImpl();
}
function getUIImpl() {
    return Object.assign({}, __uiImpl_turn_manager);
}

function readTurnManagerRuntimeValue(key: string): any {
    const impl = __uiImpl_turn_manager || {};
    try {
        if (Object.prototype.hasOwnProperty.call(impl, key)) {
            return impl[key];
        }
        if (typeof impl.readRuntimeValue === 'function') {
            return impl.readRuntimeValue(key);
        }
        if (impl.runtimeRoot && Object.prototype.hasOwnProperty.call(impl.runtimeRoot, key)) {
            return impl.runtimeRoot[key];
        }
    } catch (e) { /* ignore */ }
    return undefined;
}

function writeTurnManagerRuntimeValue(key: string, value: any): void {
    const impl = __uiImpl_turn_manager || {};
    try {
        if (typeof impl.writeRuntimeValue === 'function') {
            impl.writeRuntimeValue(key, value);
            return;
        }
        if (impl.runtimeRoot) {
            impl.runtimeRoot[key] = value;
        }
    } catch (e) { /* ignore */ }
}

function readTurnManagerRuntimeFunction(key: string): any {
    const value = readTurnManagerRuntimeValue(key);
    return typeof value === 'function' ? value : null;
}

function callTurnManagerRuntimeFunction(key: string, ...args: any[]): any {
    const fn = readTurnManagerRuntimeFunction(key);
    if (!fn) return undefined;
    return fn(...args);
}

function getTurnManagerRuntimeRoot(): any {
    const impl = __uiImpl_turn_manager || {};
    try {
        if (typeof impl.getRuntimeRoot === 'function') return impl.getRuntimeRoot();
        if (impl.runtimeRoot) return impl.runtimeRoot;
    } catch (e) { /* ignore */ }
    return null;
}

function cloneTurnManagerTemplateValue(value: any): any {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === 'object') {
        const next: Record<string, any> = {};
        for (const key of Object.keys(value)) {
            next[key] = cloneTurnManagerTemplateValue(value[key]);
        }
        return next;
    }
    return value;
}

function mergeTurnManagerMissingState(target: any, template: any): void {
    if (!target || typeof target !== 'object' || !template || typeof template !== 'object') return;
    for (const key of Object.keys(template)) {
        const templateValue = template[key];
        const targetValue = target[key];
        if (Array.isArray(templateValue)) {
            if (!Array.isArray(targetValue)) {
                target[key] = templateValue.slice();
            }
            continue;
        }
        if (templateValue && typeof templateValue === 'object') {
            if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
                target[key] = cloneTurnManagerTemplateValue(templateValue);
                continue;
            }
            mergeTurnManagerMissingState(targetValue, templateValue);
            continue;
        }
        if (typeof targetValue === 'undefined') {
            target[key] = templateValue;
        }
    }
}

function createTurnManagerCardStateTemplate(options?: any) {
    if (CardLogic && typeof CardLogic.createCardState === 'function') {
        try {
            const prngStub = {
                next: () => 0.5,
                random: () => 0.5,
                _seed: 1,
                shuffle: (array: any[]) => array
            };
            return CardLogic.createCardState(prngStub, options || {});
        } catch (e) { /* ignore */ }
    }
    return {
        pendingEffectByPlayer: { black: null, white: null },
        presentationEvents: [],
        _presentationEventsPersist: [],
        hands: { black: [], white: [] },
        decks: { black: [], white: [] },
        charge: { black: 0, white: 0 },
        markers: [],
        discard: [],
        turnIndex: 0,
        turnCountByPlayer: { black: 0, white: 0 },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        extraPlaceRemainingByPlayer: { black: 0, white: 0 },
        infinitePlaceActiveByPlayer: { black: false, white: false },
        multiPlaceSourceTypeByPlayer: { black: null, white: null },
        breedingSproutByOwner: { black: [], white: [] },
        _breedingSproutClearedTokenByOwner: { black: null, white: null }
    };
}

function hasTurnManagerCardStateMinimums(cardStateRef: any): boolean {
    return !!(
        cardStateRef
        && typeof cardStateRef === 'object'
        && cardStateRef.pendingEffectByPlayer && typeof cardStateRef.pendingEffectByPlayer === 'object'
        && Array.isArray(cardStateRef.presentationEvents)
        && Array.isArray(cardStateRef._presentationEventsPersist)
        && cardStateRef.hands && typeof cardStateRef.hands === 'object'
        && Array.isArray(cardStateRef.hands.black)
        && Array.isArray(cardStateRef.hands.white)
        && cardStateRef.turnCountByPlayer && typeof cardStateRef.turnCountByPlayer === 'object'
        && cardStateRef.hasUsedCardThisTurnByPlayer && typeof cardStateRef.hasUsedCardThisTurnByPlayer === 'object'
        && cardStateRef.hasDestroyedCardThisTurnByPlayer && typeof cardStateRef.hasDestroyedCardThisTurnByPlayer === 'object'
        && cardStateRef.extraPlaceRemainingByPlayer && typeof cardStateRef.extraPlaceRemainingByPlayer === 'object'
        && cardStateRef.infinitePlaceActiveByPlayer && typeof cardStateRef.infinitePlaceActiveByPlayer === 'object'
        && cardStateRef.multiPlaceSourceTypeByPlayer && typeof cardStateRef.multiPlaceSourceTypeByPlayer === 'object'
    );
}

function ensureTurnManagerCardStateShape(cardStateRef: any, options?: any) {
    if (!cardStateRef || typeof cardStateRef !== 'object') return cardStateRef;
    if (hasTurnManagerCardStateMinimums(cardStateRef)) return cardStateRef;
    const template = createTurnManagerCardStateTemplate(options);
    mergeTurnManagerMissingState(cardStateRef, template);
    return cardStateRef;
}

function getTurnManagerCardStateRef(): any {
    const runtimeCardState = readTurnManagerRuntimeValue('cardState');
    if (runtimeCardState && typeof runtimeCardState === 'object') return runtimeCardState;
    try {
        if (cardState && typeof cardState === 'object') return cardState;
    } catch (e) { /* ignore */ }
    return null;
}

// Module-scoped UI locks (local state; replaces runtime-root writes)
let isProcessing: any;
let isCardAnimating: any;
let VisualPlaybackActive: any;
let __playbackActiveSince: any;
let cpuSmartness = { black: 1, white: 1 }; // @compat - read by some modules through UI runtime, keep until Wave F
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

function captureServerAuthoredCardUseBoardClickForTurnManager(row: number, col: number, playerKey: string) {
    try {
        const captureFn = readTurnManagerRuntimeFunction('__captureServerAuthoredCardUseBoardClick');
        if (captureFn && captureFn(row, col, playerKey) === true) return true;
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
    if (readTurnManagerRuntimeValue('AUTO_MODE_ACTIVE') === true) return;

    const playerKey = getPlayerKey(gameState.currentPlayer);
    if (!canLocalUserOperateCurrentTurn()) return;
    const pending = readPendingForTurnManager(playerKey);
    const pendingDispatchKey = (pending && pending.stage === 'selectTarget')
        ? resolvePendingSelectionDispatchKeyForTurnManager(pending.type)
        : null;
    const allowPendingSelectionDuringAnimation = shouldAllowPendingSelectionDuringAnimation(playerKey, pending, pendingDispatchKey);

    // Block while animations are running
    if (isAnimationInProgress() && !allowPendingSelectionDuringAnimation) {
        captureServerAuthoredCardUseBoardClickForTurnManager(row, col, playerKey);
        return;
    }

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
    const _findMoveForCell = readTurnManagerRuntimeFunction('findMoveForCell') || (MoveGeneratorModule && MoveGeneratorModule.findMoveForCell);
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
        const executeMoveFn = readTurnManagerRuntimeFunction('executeMove') || (MoveExecutorModule && MoveExecutorModule.executeMove) || (typeof executeMove === 'function' ? executeMove : null);
        if (executeMoveFn) executeMoveFn(move);
        return;
    }

    // Hand animation is handled by the UI's PlaybackEngine through pipeline playback events.
    const executeMoveFn = readTurnManagerRuntimeFunction('executeMove') || (MoveExecutorModule && MoveExecutorModule.executeMove) || (typeof executeMove === 'function' ? executeMove : null);
    if (executeMoveFn) executeMoveFn(move);
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

function readTurnManagerMatchMode() {
    const impl = __uiImpl_turn_manager || {};
    try {
        if (typeof impl.readMatchMode === 'function') return impl.readMatchMode();
        if (typeof impl.getCurrentMatchMode === 'function') return impl.getCurrentMatchMode();
        if (typeof impl.MATCH_MODE !== 'undefined') return impl.MATCH_MODE;
    } catch (e) { /* ignore */ }
    try {
        const getCurrentMatchMode = readTurnManagerRuntimeFunction('getCurrentMatchMode');
        if (getCurrentMatchMode) return getCurrentMatchMode();
        const runtimeMatchMode = readTurnManagerRuntimeValue('MATCH_MODE');
        if (typeof runtimeMatchMode !== 'undefined') return runtimeMatchMode;
    } catch (e) { /* @compat fallback */ }
    return null;
}

function isTurnManagerHumanVsHumanFlagEnabled() {
    const impl = __uiImpl_turn_manager || {};
    try {
        if (typeof impl.readHumanVsHumanMode === 'function') return impl.readHumanVsHumanMode() === true;
        if (typeof impl.DEBUG_HUMAN_VS_HUMAN !== 'undefined') return impl.DEBUG_HUMAN_VS_HUMAN === true;
    } catch (e) { /* ignore */ }
    try {
        return readTurnManagerRuntimeValue('DEBUG_HUMAN_VS_HUMAN') === true;
    } catch (e) { /* @compat fallback */ }
    return false;
}

function isHumanVsHumanModeEnabled() {
    const debugHvH = isTurnManagerHumanVsHumanFlagEnabled();
    const matchMode = readTurnManagerMatchMode();
    return debugHvH || matchMode === 'network';
}

function isNetworkModeForTurnManager() {
    try {
        const matchMode = readTurnManagerMatchMode();
        if (matchMode === 'network') return true;
    } catch (e) { /* ignore */ }
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            return OwnerHelpersModule.isNetworkMode(getTurnManagerRuntimeRoot());
        }
    } catch (e) { /* ignore */ }
    return false;
}

function isOthelloModeForTurnManager() {
    const matchMode = readTurnManagerMatchMode();
    if (matchMode === 'reversi' || matchMode === 'othello') return true;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isReversiMode === 'function' && __uiImpl_turn_manager) {
            return OwnerHelpersModule.isReversiMode(__uiImpl_turn_manager);
        }
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isOthelloMode === 'function' && __uiImpl_turn_manager) {
            return OwnerHelpersModule.isOthelloMode(__uiImpl_turn_manager);
        }
    } catch (e) { /* ignore */ }
    return false;
}

function resolveNetworkLocalPlayerKey() {
    try {
        const impl = __uiImpl_turn_manager;
        if (impl && typeof impl.readNetworkSeatKey === 'function') {
            const seatKey = impl.readNetworkSeatKey();
            if (seatKey === 'white' || seatKey === 'black') return seatKey;
        }
        const runtimeKeys = [
            readTurnManagerRuntimeValue('LOCAL_PLAYER_KEY'),
            readTurnManagerRuntimeValue('__LOCAL_PLAYER_KEY'),
            readTurnManagerRuntimeValue('BOARD_VIEWER_KEY')
        ];
        for (const key of runtimeKeys) {
            if (key === 'white' || key === 'black') return key;
        }
        // LOCAL_PLAYER_KEY / BOARD_VIEWER_KEY via DI (setUIImpl)
        const directImpl = __uiImpl_turn_manager;
        if (directImpl) {
            const directKeys = [directImpl.LOCAL_PLAYER_KEY, directImpl.__LOCAL_PLAYER_KEY, directImpl.BOARD_VIEWER_KEY];
            for (const key of directKeys) {
                if (key === 'white' || key === 'black') return key;
            }
        }
    } catch (e) { /* ignore */ }
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(getTurnManagerRuntimeRoot());
        }
    } catch (e) { /* ignore */ }
    return 'black';
}

function canLocalUserOperateCurrentTurn() {
    const currentPlayerKey = getPlayerKey(gameState.currentPlayer);
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveNetworkInputPermissions === 'function') {
            return OwnerHelpersModule.resolveNetworkInputPermissions({
                rootRef: getTurnManagerRuntimeRoot(),
                cardState,
                gameState,
                currentPlayer: gameState.currentPlayer,
                localPlayerKey: resolveNetworkLocalPlayerKey(),
                matchMode: readTurnManagerMatchMode(),
                debugHumanVsHuman: isTurnManagerHumanVsHumanFlagEnabled()
            }).canOperateBoard === true;
        }
    } catch (e) { /* fallback to legacy local checks */ }
    try {
        const controllerMap = cardState && cardState.fateWillControllerByTurnOwner;
        const controllerKey = controllerMap && controllerMap[currentPlayerKey];
        const explicitLocalKey = readTurnManagerRuntimeValue('LOCAL_PLAYER_KEY')
            || readTurnManagerRuntimeValue('__LOCAL_PLAYER_KEY')
            || readTurnManagerRuntimeValue('BOARD_VIEWER_KEY');
        if ((controllerKey === 'black' || controllerKey === 'white') && (explicitLocalKey === 'black' || explicitLocalKey === 'white')) {
            return controllerKey === explicitLocalKey;
        }
    } catch (e) { /* ignore */ }
    const isNetworkMode = isNetworkModeForTurnManager();
    const isHvH = isTurnManagerHumanVsHumanFlagEnabled();
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

function getNetworkPublishAdapterForTurnManager() {
    try {
        const impl = __uiImpl_turn_manager;
        if (!impl) return null;
        if (impl.networkPublishAdapter && typeof impl.networkPublishAdapter === 'object') {
            return impl.networkPublishAdapter;
        }
        if (typeof impl.publishNetworkSnapshot === 'function' || typeof impl.isNetworkPublishActive === 'function') {
            return {
                publishSnapshot: impl.publishNetworkSnapshot,
                isActive: impl.isNetworkPublishActive
            };
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

        const client = getNetworkPublishAdapterForTurnManager();
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

function shouldPublishNetworkResetSnapshotAtResetStart(options?: any) {
    try {
        if (options && typeof options === 'object' && options.skipNetworkPublish === true) {
            return false;
        }
        if (!isNetworkModeForTurnManager()) return false;
        const client = getNetworkPublishAdapterForTurnManager();
        if (!client || typeof client.publishSnapshot !== 'function') return false;
        if (typeof client.isActive === 'function') {
            return client.isActive() === true;
        }
        return true;
    } catch (e) { /* ignore */ }
    return false;
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

function normalizeInitialBoardSetupPlayerValue(value: any): number {
    return getPlayerKey(value) === 'white' ? WHITE : BLACK;
}

function applyInitialBoardSetupForReset(targetGameState: any, initialBoardSetup: any): void {
    if (!targetGameState || !initialBoardSetup || typeof initialBoardSetup !== 'object') return;
    const sourceBoard = Array.isArray(initialBoardSetup.board) ? initialBoardSetup.board : null;
    if (!sourceBoard || !Array.isArray(targetGameState.board)) return;

    const rowCount = targetGameState.board.length;
    if (sourceBoard.length !== rowCount) return;
    for (let row = 0; row < rowCount; row += 1) {
        const targetRow = Array.isArray(targetGameState.board[row]) ? targetGameState.board[row] : null;
        const sourceRow = Array.isArray(sourceBoard[row]) ? sourceBoard[row] : null;
        if (!targetRow || !sourceRow || sourceRow.length !== targetRow.length) return;
    }

    targetGameState.board = sourceBoard.map((line: any[]) => line.map((cell: any) => {
        if (cell === WHITE || cell === 'white') return WHITE;
        if (cell === BLACK || cell === 'black') return BLACK;
        return 0;
    }));
    targetGameState.currentPlayer = normalizeInitialBoardSetupPlayerValue(initialBoardSetup.currentPlayer);
    targetGameState.consecutivePasses = 0;
    if (targetGameState.roundCompletionByPlayer && typeof targetGameState.roundCompletionByPlayer === 'object') {
        targetGameState.roundCompletionByPlayer.black = false;
        targetGameState.roundCompletionByPlayer.white = false;
    }
    targetGameState.pendingRoundBonus = null;
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
    case 'buoyancy':
        return (typeof handleBuoyancySelection === 'function') ? handleBuoyancySelection : null;
    case 'super_buoyancy':
        return (typeof handleSuperBuoyancySelection === 'function') ? handleSuperBuoyancySelection : null;
    case 'gravity':
        return (typeof handleGravitySelection === 'function') ? handleGravitySelection : null;
    case 'super_gravity':
        return (typeof handleSuperGravitySelection === 'function') ? handleSuperGravitySelection : null;
    case 'super_attraction':
        return (typeof handleSuperAttractionSelection === 'function') ? handleSuperAttractionSelection : null;
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

function resetGame(options?: any) {
    // Auto mode removed: nothing to stop or reset

    // Hard cleanup before rebuilding state (F5 相当の再起動に近づける)
    // - stale playback/presentation queues can block board refresh
    // - UI transient overlays/flags may survive without a full page reload
    resetGameGeneration += 1;
    const currentResetGeneration = resetGameGeneration;
    const isCurrentResetGeneration = () => currentResetGeneration === resetGameGeneration;
    const shouldPublishNetworkResetSnapshot = shouldPublishNetworkResetSnapshotAtResetStart(options);
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
    const cpuSmartnessRef = (typeof cpuSmartness !== 'undefined' && cpuSmartness && typeof cpuSmartness === 'object')
        ? cpuSmartness
        : { black: 1, white: 1 };
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.readCpuSmartness === 'function') {
        const vals = __uiImpl_turn_manager.readCpuSmartness();
        cpuSmartnessRef.black = clampCpuLevel((vals && vals.black) || cpuSmartnessRef.black || 1);
        cpuSmartnessRef.white = clampCpuLevel((vals && vals.white) || cpuSmartnessRef.white || 1);
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
    const plainReversiMode = isOthelloModeForTurnManager();
    if (plainReversiMode) {
        cardInitOptions = Object.assign({}, cardInitOptions, { plainReversi: true, plainOthello: true });
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

    const createGameStateForReset = readTurnManagerRuntimeFunction('createGameState') || createGameState;
    const nextGameState = createGameStateForReset(boardConfig);
    writeTurnManagerRuntimeValue('gameState', nextGameState);
    applyInitialBoardSetupForReset(nextGameState, cardInitOptions && cardInitOptions.initialBoardSetup);
    try {
        // initCardState may rely on PRNG; if unavailable, tests should mock or skip
        if (typeof initCardState === 'function') initCardState(undefined, cardInitOptions);
    } catch (e) {
        // In test environments without PRNG, allow fallback to a minimal cardState via CardLogic
        console.warn('[resetGame] initCardState failed (test environment):', (e as any).message);
        if (typeof CardLogic.createCardState === 'function') {  // CardLogic imported directly
            const prngStub = { next: () => 0.5, _seed: 1, shuffle: (array: any[]) => array };
            const newState = CardLogic.createCardState(prngStub, cardInitOptions);
            // Wipe and copy properties to maintain legacy reference pattern
            if (typeof cardState !== 'undefined') {
                for (const k in cardState) delete cardState[k];
                Object.assign(cardState, newState);
            } else if (!readTurnManagerRuntimeValue('cardState')) {
                writeTurnManagerRuntimeValue('cardState', newState);
            }
        }
    }
    const nextCardState = getTurnManagerCardStateRef();
    if (nextCardState && typeof nextCardState === 'object') {
        ensureTurnManagerCardStateShape(nextCardState, cardInitOptions);
        writeTurnManagerRuntimeValue('cardState', nextCardState);
    }

    // Reset ActionManager for new game
    if (ActionManagerModule && ActionManagerModule.ActionManager) {
        ActionManagerModule.ActionManager.reset();
        try { ActionManagerModule.ActionManager.clearStorage(); } catch (e) { /* ignore */ }
        if (isDebugLogAvailable()) console.log('[resetGame] ActionManager reset and cleared storage');
    }

    // Clear UI log via helper if available (game/ must not touch DOM)
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.clearLogUI === 'function') {
        __uiImpl_turn_manager.clearLogUI();
    }

    try {
        emitGameReset({ turnNumber: 0 });
    } catch (e) { /* ignore */ }

    emitLogAddedForTurnManager(`ゲーム開始 (黒: Lv${cpuSmartnessRef.black}, 白: Lv${cpuSmartnessRef.white})`, 'normal');
    try { emitBoardUpdate(); } catch (e) { /* ignore */ }
    try { emitGameStateChange(); } catch (e) { /* ignore */ }

    const runTurnStartAfterReset = () => {
        if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.onTurnStart === 'function') {
            return __uiImpl.onTurnStart(BLACK);
        }
        return onTurnStart(BLACK);
    };

    const handleResetTurnStartFailure = (error: any) => {
        setTurnManagerBusyState({
            processing: false,
            cardAnimating: false
        });
        console.error('onTurnStart error during reset:', error);
        try {
            emitLogAddedForTurnManager('エラー: ターン開始に失敗しました', 'normal');
        } catch (e) { /* ignore */ }
        try {
            const handler = (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.handleResetTurnStartError === 'function')
                ? __uiImpl_turn_manager.handleResetTurnStartError
                : readTurnManagerRuntimeFunction('handleResetTurnStartError');
            if (handler) handler(error);
        } catch (secondaryError) {
            console.error('[resetGame] handleResetTurnStartError failed:', secondaryError);
        }
    };

    const runTurnStartAndPublishResetSnapshot = () => {
        if (!isCurrentResetGeneration()) return Promise.resolve(false);
        let turnStartSucceeded = false;
        return Promise.resolve()
            .then(() => {
                if (!isCurrentResetGeneration()) return false;
                return runTurnStartAfterReset();
            })
            .then((result) => {
                if (!isCurrentResetGeneration()) return false;
                turnStartSucceeded = true;
                return result;
            })
            .catch((error) => {
                if (!isCurrentResetGeneration()) return false;
                handleResetTurnStartFailure(error);
                return false;
            })
            .finally(() => {
                if (!isCurrentResetGeneration()) return;
                if (turnStartSucceeded && shouldPublishNetworkResetSnapshot) {
                    publishNetworkResetSnapshot();
                }
            });
    };

    if (plainReversiMode) {
        setTurnManagerBusyState({
            cardAnimating: false,
            processing: false
        });
        runTurnStartAndPublishResetSnapshot();
        return;
    }

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
                emitLogAddedForTurnManager('カード配布完了', 'normal');

    })
    .catch((err: any) => {
                if (!isCurrentResetGeneration()) return;
                console.error('Deal animation error:', err);
                emitLogAddedForTurnManager('エラー: カード配布に失敗しました', 'normal');
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
        emitLogAddedForTurnManager('カード配布完了', 'normal');
    }

}

/**
 * ターン開始処理
 * Turn Start Logic coordination
 * @param {number} player - BLACK (1) or WHITE (-1)
 */
async function onTurnStart(player: number) {
    const playerKey = getPlayerKey(player);
    ensureTurnManagerCardStateShape(getTurnManagerCardStateRef());

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
    const othelloMode = isOthelloModeForTurnManager();
    if (othelloMode) {
        _startEvents.push({ type: 'turn_start', player: playerKey });
    } else if (typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {  // TurnPipelinePhases imported directly
        if (!Core) {
            throw new Error('[CRITICAL][onTurnStart] Core is undefined; TurnPipelinePhases.applyTurnStartPhase cannot run');
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
    if (!othelloMode) {
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
            if (readTurnManagerRuntimeFunction('requestCardUiSync')) {
                callTurnManagerRuntimeFunction('requestCardUiSync', 'turn-manager:shared-hand-debug');
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
// Legacy code previously exported helpers directly onto runtime root. That behavior has been
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
        replaceUIImpl,
        getUIImpl,
        startActionSaveInterval,
        stopActionSaveInterval,
        watchdogPing,
        canLocalUserOperateCurrentTurn,
        setTurnManagerTimerService,
        // Expose helper for testing / minimal UI integrations
        requestUIRender
    };
}

// @compat - legacy UI entry points are registered through UIBootstrap at the UI boundary.
try {
    const uiBootstrap = _require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') uiBootstrap.registerUIGlobals({ resetGame, handleCellClick });
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
    replaceUIImpl,
    getUIImpl,
    startActionSaveInterval,
    stopActionSaveInterval,
    watchdogPing,
    canLocalUserOperateCurrentTurn,
    setTurnManagerTimerService,
    requestUIRender
};
