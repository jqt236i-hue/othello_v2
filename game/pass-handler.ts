/**
 * Pass and game-end handling utilities extracted from turn-manager
 * Refactored to use TurnPipeline exclusively (no legacy path)
 */

declare let cardState: any;
declare let gameState: any;
declare const BLACK: any;
declare const WHITE: any;
declare const EMPTY: any;
declare const Core: any;
declare const CoreLogic: any;
declare const CardLogic: any;
declare const TurnPipeline: any;
declare const processCpuTurn: any;
declare const getPlayerName: any;
declare const onTurnStart: any;
declare const isGameOver: any;
declare const getLegalMoves: any;
declare const CPU_TURN_DELAY_MS: any;
declare const BLACK_PASS_DELAY_MS: any;
declare const DOUBLE_PLACE_PASS_DELAY_MS: any;

const PASS_HANDLER_VERSION = '2.0'; // TurnPipeline-only version

// TimerService DI
let passHandlerTimerService: any = null;
function setPassHandlerTimerService(service: any) { passHandlerTimerService = service; }
function getPassHandlerTimerService() {
    return passHandlerTimerService || null;
}

// Timers abstraction (injected by UI)
let timers: any = null;
let OwnerHelpersModule: any = null;
let passHandlerNetworkTurnHandoff: any = null;
let passHandlerPendingCoordinator: any = null;
let passHandlerTurnPipelineModule: any = null;
let passHandlerCardEffectsHelpers: any = null;
let passHandlerSpecialEffectsHelpers: any = null;
if (typeof require === 'function') {
    try { timers = require('./timers'); } catch (e) { /* ignore */ }
    try { OwnerHelpersModule = require('../utils/owner-helpers.js'); } catch (e) { /* ignore */ }
    try { passHandlerNetworkTurnHandoff = require('./network-turn-handoff.js'); } catch (e) { /* ignore */ }
    try { passHandlerPendingCoordinator = require('./turn/pending-coordinator.js'); } catch (e) { /* ignore */ }
    try { passHandlerTurnPipelineModule = require('./turn/turn_pipeline.js'); } catch (e) { /* ignore */ }
    try { passHandlerCardEffectsHelpers = require('./card-effects/helpers'); } catch (e) { /* ignore */ }
    try { passHandlerSpecialEffectsHelpers = require('./special-effects/helpers'); } catch (e) { /* ignore */ }
}
const PassHandlerControllerEvents = require('./controller-events');
// DI imports for UI-cross-boundary modules (graceful degradation via try/catch)
let cpuTurnHandlerModule: any = null;
let passHandlerRuntime: any = null;
if (typeof require === 'function') {
    try { cpuTurnHandlerModule = require('./cpu-turn-handler'); } catch (e) { /* ignore */ }
}

function setPassHandlerRuntime(runtime: any) {
    passHandlerRuntime = (runtime && typeof runtime === 'object') ? runtime : null;
}

function resolvePassHandlerRuntimeFunction(name: string) {
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.resolveRuntimeFunction === 'function') {
            const candidate = passHandlerRuntime.resolveRuntimeFunction(name);
            if (typeof candidate === 'function') return candidate;
        }
        if (passHandlerRuntime && typeof passHandlerRuntime[name] === 'function') {
            return passHandlerRuntime[name];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolvePassHandlerRuntimeValue(name: string): any {
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.resolveRuntimeValue === 'function') {
            const value = passHandlerRuntime.resolveRuntimeValue(name);
            if (typeof value !== 'undefined') return value;
        }
        if (passHandlerRuntime && Object.prototype.hasOwnProperty.call(passHandlerRuntime, name)) {
            return passHandlerRuntime[name];
        }
    } catch (e) { /* ignore */ }
    return undefined;
}

function resolvePassHandlerGameState(): any {
    const runtimeGameState = resolvePassHandlerRuntimeValue('gameState');
    if (runtimeGameState && typeof runtimeGameState === 'object') return runtimeGameState;
    return gameState || null;
}

function showPassHandlerResultIfAvailable() {
    const showResultFn = resolvePassHandlerRuntimeFunction('showResult');
    if (typeof showResultFn !== 'function') return false;
    try {
        showResultFn();
        return true;
    } catch (e) { /* ignore */ }
    return false;
}

function getActiveProtectionForPlayer(playerValue: any) {
    try {
        if (
            passHandlerCardEffectsHelpers &&
            typeof passHandlerCardEffectsHelpers.getActiveProtectionForPlayer === 'function'
        ) {
            return passHandlerCardEffectsHelpers.getActiveProtectionForPlayer(playerValue) || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function getFlipBlockers() {
    try {
        if (
            passHandlerSpecialEffectsHelpers &&
            typeof passHandlerSpecialEffectsHelpers.getFlipBlockers === 'function'
        ) {
            return passHandlerSpecialEffectsHelpers.getFlipBlockers() || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function setPassHandlerProcessing(active: boolean) {
    const next = active === true;
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.setProcessing === 'function') {
            passHandlerRuntime.setProcessing(next);
        }
    } catch (e) { /* ignore */ }
    return next;
}

function resolvePassHandlerActionManager() {
    if (passHandlerRuntime && passHandlerRuntime.actionManager) {
        return passHandlerRuntime.actionManager;
    }
    if (passHandlerRuntime && typeof passHandlerRuntime.getActionManager === 'function') {
        try {
            const actionManager = passHandlerRuntime.getActionManager();
            if (actionManager && typeof actionManager === 'object') return actionManager;
        } catch (e) { /* ignore */ }
    }
    return null;
}

function getPassHandlerActionApi() {
    const actionManager = resolvePassHandlerActionManager();
    return actionManager && actionManager.ActionManager ? actionManager.ActionManager : actionManager;
}

function recordPassHandlerAction(action: any) {
    const actionApi = getPassHandlerActionApi();
    if (!actionApi) return;
    try {
        if (typeof actionApi.recordAction === 'function') actionApi.recordAction(action);
        if (typeof actionApi.incrementTurnIndex === 'function') actionApi.incrementTurnIndex();
    } catch (e) {
        console.warn('[PASS-HANDLER] Failed to record pass action:', e);
    }
}

function resolvePassHandlerNetworkTurnHandoff() {
    if (passHandlerRuntime && passHandlerRuntime.networkTurnHandoff) {
        return passHandlerRuntime.networkTurnHandoff;
    }
    if (passHandlerRuntime && typeof passHandlerRuntime.getNetworkTurnHandoff === 'function') {
        try {
            const handoff = passHandlerRuntime.getNetworkTurnHandoff();
            if (handoff && typeof handoff === 'object') return handoff;
        } catch (e) { /* ignore */ }
    }
    return passHandlerNetworkTurnHandoff;
}

function emitPassHandlerBoardUpdate() {
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.emitBoardUpdate === 'function') {
            return passHandlerRuntime.emitBoardUpdate() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitPassHandlerGameStateChange() {
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.emitGameStateChange === 'function') {
            return passHandlerRuntime.emitGameStateChange() === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function emitPassHandlerLog(message: any, kind?: string) {
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.emitLogAdded === 'function') {
            if (typeof kind === 'undefined') passHandlerRuntime.emitLogAdded(message);
            else passHandlerRuntime.emitLogAdded(message, kind);
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (PassHandlerControllerEvents && typeof PassHandlerControllerEvents.emitLogAdded === 'function') {
            PassHandlerControllerEvents.emitLogAdded(message, kind);
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function normalizePlayerKeyOptional(value: any) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            return OwnerHelpersModule.normalizePlayerKeyOptional(value);
        }
    } catch (e) { /* ignore */ }
    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return null;
}

function normalizePlayerKey(value: any, fallbackKey: string) {
    const normalized = normalizePlayerKeyOptional(value);
    if (normalized) return normalized;
    return fallbackKey === 'white' ? 'white' : 'black';
}

function readPendingForPassHandler(playerKey: string) {
    if (passHandlerPendingCoordinator && typeof passHandlerPendingCoordinator.readPendingEffect === 'function') {
        return passHandlerPendingCoordinator.readPendingEffect(cardState, playerKey);
    }
    return (cardState && cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey])
        ? cardState.pendingEffectByPlayer[playerKey]
        : null;
}

function resolvePlayerValue(playerKey: string, fallbackValue: any) {
    const normalized = normalizePlayerKey(playerKey, 'black');
    if (normalized === 'white') {
        return (typeof WHITE !== 'undefined') ? WHITE : fallbackValue;
    }
    return (typeof BLACK !== 'undefined') ? BLACK : fallbackValue;
}

function getFateWillControllerForTurnOwner(turnOwnerKey: any) {
    const ownerKey = normalizePlayerKeyOptional(turnOwnerKey);
    if (!ownerKey || !cardState || typeof cardState !== 'object') return null;
    const controllerMap = (cardState.fateWillControllerByTurnOwner && typeof cardState.fateWillControllerByTurnOwner === 'object')
        ? cardState.fateWillControllerByTurnOwner
        : null;
    if (!controllerMap) return null;
    return normalizePlayerKeyOptional(controllerMap[ownerKey]);
}

function getEffectiveTurnOperatorKey(turnOwnerKey: any) {
    const ownerKey = normalizePlayerKey(turnOwnerKey, 'black');
    return getFateWillControllerForTurnOwner(ownerKey) || ownerKey;
}

function hasUsableWaitMs(t: any) {
    if (!t || typeof t.waitMs !== 'function') return false;
    // game/timers default waitMs() is immediate unless UI impl is injected.
    if (typeof t.hasTimerImpl === 'function' && !t.hasTimerImpl()) return false;
    return true;
}

function scheduleWithDelay(delayMs: number, callback: () => void, immediateWithoutTimers?: boolean) {
    const safeDelay = Number.isFinite(delayMs) ? delayMs : 0;
    if (hasUsableWaitMs(timers)) {
        timers.waitMs(safeDelay).then(callback);
        return;
    }
    const timerService = getPassHandlerTimerService();
    if (timerService) {
        const tid = timerService.setTimeout(callback, safeDelay);
        if (tid && typeof tid.unref === 'function') tid.unref();
        return;
    }
    if (immediateWithoutTimers) {
        callback();
        return;
    }
}

const WHITE_CPU_TURN_RETRY_DELAY_MS = 32;
const WHITE_CPU_TURN_MAX_RETRIES = 2;

function resolveCpuTurnFnForPass() {
    if (passHandlerRuntime && typeof passHandlerRuntime.processCpuTurn === 'function') {
        return passHandlerRuntime.processCpuTurn;
    }
    if (cpuTurnHandlerModule && typeof cpuTurnHandlerModule.processCpuTurn === 'function') {
        return cpuTurnHandlerModule.processCpuTurn;
    }
    try {
        if (typeof processCpuTurn === 'function') return processCpuTurn;
    } catch (e) { /* ignore */ }
    return null;
}

function scheduleWhiteCpuTurnGuarded(delayMs: number, options: any) {
    if (isHumanVsHumanModeEnabled()) return;
    const opts = options || {};
    const expectedTurnNumber = Number.isFinite(opts.expectedTurnNumber)
        ? opts.expectedTurnNumber
        : ((gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null);
    const expectedPlayerKey = normalizePlayerKeyOptional(opts.nextPlayerKey);
    const retryCount = Number.isFinite(opts.retryCount) ? Math.max(0, opts.retryCount) : 0;
    scheduleWithDelay(delayMs, () => {
        const releaseCpuHandoffProcessing = () => {
            setPassHandlerProcessing(false);
        };
        const currentGameState = resolvePassHandlerGameState();
        const currentPlayerKey = normalizePlayerKeyOptional(currentGameState ? currentGameState.currentPlayer : null);
        if (!currentPlayerKey) {
            releaseCpuHandoffProcessing();
            return;
        }
        if (expectedPlayerKey && currentPlayerKey !== expectedPlayerKey) {
            releaseCpuHandoffProcessing();
            return;
        }
        if (!isCpuControlledPlayer(currentPlayerKey)) {
            releaseCpuHandoffProcessing();
            return;
        }
        const currentTurnNumber = (currentGameState && Number.isFinite(currentGameState.turnNumber)) ? currentGameState.turnNumber : null;
        const cpuFn = resolveCpuTurnFnForPass();
        if (!cpuFn) {
            if (retryCount < WHITE_CPU_TURN_MAX_RETRIES) {
                scheduleWhiteCpuTurnGuarded(WHITE_CPU_TURN_RETRY_DELAY_MS, {
                    nextPlayerKey: expectedPlayerKey || currentPlayerKey,
                    expectedTurnNumber: currentTurnNumber !== null ? currentTurnNumber : expectedTurnNumber,
                    retryCount: retryCount + 1
                });
            } else {
                releaseCpuHandoffProcessing();
            }
            return;
        }
        // Pass resolution can advance bookkeeping before the delayed callback fires.
        // If it is still white's turn, continue with the latest white turn instead of dropping the handoff.
        if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) {
            releaseCpuHandoffProcessing();
            cpuFn();
            return;
        }
        releaseCpuHandoffProcessing();
        cpuFn();
    });
}

function getCurrentMatchModeSafe() {
    if (passHandlerRuntime && typeof passHandlerRuntime.readMatchMode === 'function') {
        try {
            const mode = passHandlerRuntime.readMatchMode();
            if (mode) return mode;
        } catch (e) { /* ignore */ }
    }
    if (passHandlerRuntime && typeof passHandlerRuntime.getCurrentMatchMode === 'function') {
        try {
            const mode = passHandlerRuntime.getCurrentMatchMode();
            if (mode) return mode;
        } catch (e) { /* ignore */ }
    }
    if (passHandlerRuntime && typeof passHandlerRuntime.MATCH_MODE !== 'undefined') {
        return passHandlerRuntime.MATCH_MODE;
    }
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.getCurrentMatchMode === 'function') {
            return OwnerHelpersModule.getCurrentMatchMode(passHandlerRuntime || {});
        }
    } catch (e) { /* ignore */ }
    return null;
}

function isExplicitNetworkMatchMode() {
    return String(getCurrentMatchModeSafe() || '').trim().toLowerCase() === 'network';
}

function isHumanVsHumanModeEnabled() {
    let debugHvH = false;
    if (passHandlerRuntime && typeof passHandlerRuntime.readHumanVsHumanMode === 'function') {
        try { debugHvH = passHandlerRuntime.readHumanVsHumanMode() === true; } catch (e) { /* ignore */ }
    } else if (passHandlerRuntime && typeof passHandlerRuntime.DEBUG_HUMAN_VS_HUMAN !== 'undefined') {
        debugHvH = passHandlerRuntime.DEBUG_HUMAN_VS_HUMAN === true;
    }
    const matchMode = String(getCurrentMatchModeSafe() || '').trim().toLowerCase();
    return debugHvH || matchMode === 'network';
}

function isOthelloModeEnabled() {
    const matchMode = String(getCurrentMatchModeSafe() || '').trim().toLowerCase();
    if (matchMode === 'reversi' || matchMode === 'othello') return true;
    if (matchMode && matchMode !== 'cpu' && matchMode !== 'network') return false;
    const modeContext = passHandlerRuntime || {};
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isReversiMode === 'function') {
            return OwnerHelpersModule.isReversiMode(modeContext);
        }
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isOthelloMode === 'function') {
            return OwnerHelpersModule.isOthelloMode(modeContext);
        }
    } catch (e) { /* ignore */ }
    return false;
}

function isNetworkModeEnabled() {
    if (isExplicitNetworkMatchMode()) return true;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            return OwnerHelpersModule.isNetworkMode(passHandlerRuntime || undefined);
        }
    } catch (e) { /* ignore */ }
    return false;
}

function isCpuControlledPlayer(playerKey: string) {
    if (!playerKey) return false;
    if (isHumanVsHumanModeEnabled() || isNetworkModeEnabled()) return false;
    const effectiveOperatorKey = getEffectiveTurnOperatorKey(playerKey);
    // Browser match defaults: white seat is the local CPU controller.
    return effectiveOperatorKey === 'white';
}

function publishNetworkSnapshot(meta: any) {
    try {
        if (!passHandlerRuntime || typeof passHandlerRuntime.publishSnapshot !== 'function') return;
        return passHandlerRuntime.publishSnapshot(meta || {});
    } catch (e) { /* ignore */ }
}

function createPassNetworkAction(playerKey: string, cardStateValue: any, options?: any) {
    const normalizedPlayerKey = normalizePlayerKey(playerKey, 'black');
    const action: any = { type: 'pass', playerKey: normalizedPlayerKey };
    if (cardStateValue && Number.isFinite(Number(cardStateValue.turnIndex))) {
        action.turnIndex = Math.trunc(Number(cardStateValue.turnIndex));
    }
    if (options && options.autoNoActionPass === true) {
        action.autoNoActionPass = true;
    }
    return action;
}

function resolvePassPublishPlayerKey(turnOwnerKey: string) {
    const normalizedTurnOwnerKey = normalizePlayerKey(turnOwnerKey, 'black');
    const effectiveOperatorKey = getEffectiveTurnOperatorKey(normalizedTurnOwnerKey);
    return normalizePlayerKey(effectiveOperatorKey, normalizedTurnOwnerKey);
}

function resolveNetworkSeatKeyForPassHandler() {
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.readNetworkSeatKey === 'function') {
            const seatKey = normalizePlayerKeyOptional(passHandlerRuntime.readNetworkSeatKey());
            if (seatKey) return seatKey;
        }
    } catch (e) { /* ignore */ }
    try {
        if (passHandlerRuntime && typeof passHandlerRuntime.LOCAL_PLAYER_KEY !== 'undefined') {
            const seatKey = normalizePlayerKeyOptional(passHandlerRuntime.LOCAL_PLAYER_KEY);
            if (seatKey) return seatKey;
        }
        if (passHandlerRuntime && typeof passHandlerRuntime.__LOCAL_PLAYER_KEY !== 'undefined') {
            const seatKey = normalizePlayerKeyOptional(passHandlerRuntime.__LOCAL_PLAYER_KEY);
            if (seatKey) return seatKey;
        }
        if (passHandlerRuntime && typeof passHandlerRuntime.BOARD_VIEWER_KEY !== 'undefined') {
            const seatKey = normalizePlayerKeyOptional(passHandlerRuntime.BOARD_VIEWER_KEY);
            if (seatKey) return seatKey;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function canPublishNetworkPassForTurnOwner(turnOwnerKey: string) {
    const publishPlayerKey = resolvePassPublishPlayerKey(turnOwnerKey || 'black');
    const localSeatKey = resolveNetworkSeatKeyForPassHandler();
    return !!localSeatKey && localSeatKey === publishPlayerKey;
}

function publishPassSnapshot(playerKey: string, actionOverride?: any, options?: any) {
    const normalizedPlayerKey = normalizePlayerKey(playerKey, 'black');
    const action = (actionOverride && typeof actionOverride === 'object')
        ? actionOverride
        : createPassNetworkAction(normalizedPlayerKey, cardState, options);
    const meta = {
        playerKey: normalizedPlayerKey,
        actionType: 'pass',
        action,
        playbackEvents: []
    };
    return publishNetworkSnapshot(meta);
}

async function publishNetworkPassCommand(turnOwnerKey: string, options?: any) {
    const publishPlayerKey = resolvePassPublishPlayerKey(turnOwnerKey || 'black');
    const publishAction = createPassNetworkAction(publishPlayerKey, cardState, options);
    const publishResult = publishPassSnapshot(publishPlayerKey, publishAction, options);
    if (publishResult && typeof publishResult.then === 'function') {
        const awaitedResult = await publishResult;
        return !(awaitedResult && typeof awaitedResult === 'object' && awaitedResult.ok === false);
    }
    return !(publishResult && typeof publishResult === 'object' && publishResult.ok === false);
}

function hasUsableCardFor(playerKey: string) {
    if (isOthelloModeEnabled()) return false;
    try {
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.hasUsableCard === 'function') {
            return CardLogic.hasUsableCard(cardState, gameState, playerKey);
        }
    } catch (e) { /* ignore */ }
    return false;
}

function isPlacementLockedForPlayerKey(playerKey: string) {
    try {
        return typeof CardLogic !== 'undefined'
            && CardLogic
            && typeof CardLogic.isPlacementLockedForPlayer === 'function'
            && CardLogic.isPlacementLockedForPlayer(cardState, playerKey) === true;
    } catch (e) { /* ignore */ }
    return false;
}

function resolveCoreApi() {
    if (typeof Core !== 'undefined' && Core && typeof Core.getLegalMoves === 'function') return Core;
    if (typeof CoreLogic !== 'undefined' && CoreLogic && typeof CoreLogic.getLegalMoves === 'function') return CoreLogic;
    if (typeof require === 'function') {
        try {
            const coreModule = require('./logic/core');
            if (coreModule && typeof coreModule.getLegalMoves === 'function') return coreModule;
        } catch (e) { /* ignore */ }
    }
    return null;
}

function getLegalMovesForPlayer(playerValue: any, playerKeyOverride?: string) {
    if (!gameState) return [];
    const playerKey = normalizePlayerKey(playerKeyOverride || playerValue, 'black');
    const corePlayerValue = resolvePlayerValue(playerKey, playerValue);

    const core = resolveCoreApi();
    if (core) {
        try {
            const ctx = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardContext === 'function')
                ? CardLogic.getCardContext(cardState)
                : { protectedStones: [], permaProtectedStones: [], bombs: [] };
            return core.getLegalMoves(gameState, corePlayerValue, ctx) || [];
        } catch (e) { /* ignore */ }
    }

    if (typeof getLegalMoves !== 'function') return [];
    try {
        const probeState = Object.assign({}, gameState, { currentPlayer: corePlayerValue });
        const protection = (typeof getActiveProtectionForPlayer === 'function')
            ? getActiveProtectionForPlayer(corePlayerValue)
            : [];
        const perma = (typeof getFlipBlockers === 'function')
            ? getFlipBlockers()
            : [];
        return getLegalMoves(probeState, protection, perma) || [];
    } catch (e) {
        return [];
    }
}

function hasEffectiveLegalPlacementForPlayer(playerValue: any, playerKeyOverride?: string) {
    const playerKey = normalizePlayerKey(playerKeyOverride || playerValue, 'black');
    if (isPlacementLockedForPlayerKey(playerKey)) return false;
    return getLegalMovesForPlayer(playerValue, playerKey).length > 0;
}

function playerHasAnyAvailableAction(playerValue: any) {
    const playerKey = normalizePlayerKey(playerValue, 'black');
    if (readPendingForPassHandler(playerKey)) return true;
    if (hasEffectiveLegalPlacementForPlayer(playerValue, playerKey)) return true;
    return hasUsableCardFor(playerKey);
}

function isNoActionTerminalState() {
    const safeBlack = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const safeWhite = (typeof WHITE !== 'undefined') ? WHITE : -1;
    return !playerHasAnyAvailableAction(safeBlack) && !playerHasAnyAvailableAction(safeWhite);
}

function resolveCorePassApi() {
    if (typeof Core !== 'undefined' && Core && typeof Core.applyPass === 'function') return Core;
    if (typeof CoreLogic !== 'undefined' && CoreLogic && typeof CoreLogic.applyPass === 'function') return CoreLogic;
    if (typeof require === 'function') {
        try {
            const coreModule = require('./logic/core');
            if (coreModule && typeof coreModule.applyPass === 'function') return coreModule;
        } catch (e) { /* ignore */ }
    }
    return null;
}

function normalizePassCount(value: any) {
    return Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
}

function normalizeProcessPassTurnOptions(value: any) {
    if (value && typeof value === 'object') {
        return {
            autoMode: value.autoMode === true,
            autoNoActionPass: value.autoNoActionPass === true
        };
    }
    return {
        autoMode: value === true,
        autoNoActionPass: value === true
    };
}

function applyNoActionTerminalPass(state: any) {
    const core = resolveCorePassApi();
    if (core && typeof core.applyPass === 'function') {
        try {
            return core.applyPass(state);
        } catch (e) {
            // Fall back to the minimal pass transition below for legacy tests and partial states.
        }
    }
    return Object.assign({}, state || {}, {
        currentPlayer: state && Number.isFinite(Number(state.currentPlayer))
            ? -Number(state.currentPlayer)
            : state && state.currentPlayer === 'black'
                ? 'white'
                : state && state.currentPlayer === 'white'
                    ? 'black'
                    : state ? state.currentPlayer : undefined,
        consecutivePasses: normalizePassCount(state && state.consecutivePasses) + 1,
        turnNumber: normalizePassCount(state && state.turnNumber) + 1
    });
}

function advanceNoActionTerminalPasses() {
    if (!gameState) return false;
    let guard = 0;
    while (normalizePassCount(gameState.consecutivePasses) < 2 && guard < 2) {
        if (playerHasAnyAvailableAction(gameState.currentPlayer)) return false;
        gameState = applyNoActionTerminalPass(gameState);
        guard += 1;
    }
    return normalizePassCount(gameState && gameState.consecutivePasses) >= 2;
}

function finalizeNoActionTerminal() {
    if (!isNoActionTerminalState()) return false;
    if (gameState && normalizePassCount(gameState.consecutivePasses) < 2) {
        if (!advanceNoActionTerminalPasses()) return false;
    }
    showPassHandlerResultIfAvailable();
    setPassHandlerProcessing(false);
    return true;
}

function handleRejectedPass() {
    if (finalizeNoActionTerminal()) return true;
    console.warn('[PASS-HANDLER] Pass was rejected; keeping current turn');
    setPassHandlerProcessing(false);
    return false;
}

function syncPassPipelineState(result: any) {
    if (!result || typeof result !== 'object') return;
    if (result.gameState) gameState = result.gameState;
    if (result.cardState) cardState = result.cardState;
}

function ensureCurrentPlayerCanActOrPass(options?: any) {
    if (!gameState || !cardState) return false;
    const opts = options || {};
    const currentPlayer = gameState.currentPlayer;
    const playerKey = normalizePlayerKey(currentPlayer, 'black');
    const pending = readPendingForPassHandler(playerKey);

    // Target selection is still an available action, so do not auto-pass.
    if (pending && pending.stage === 'selectTarget') return false;

    const hasLegalPlacement = hasEffectiveLegalPlacementForPlayer(currentPlayer, playerKey);
    const hasCard = hasUsableCardFor(playerKey);
    if (hasLegalPlacement || hasCard) return false;

    // With no legal move and no usable card, pass is the only available action.
    // Network mode must publish an authoritative pass command instead of applying a local delayed pass.
    const passArg = pending ? { autoMode: true } : true;
    if (isExplicitNetworkMatchMode()) {
        if (!canPublishNetworkPassForTurnOwner(playerKey)) return false;
        processPassTurn(playerKey, passArg);
        return true;
    }

    if (opts.useBlackDelay && typeof BLACK !== 'undefined' && currentPlayer === BLACK) {
        handleBlackPassWhenNoMoves();
        return true;
    }

    processPassTurn(playerKey, passArg);
    return true;
}

/**
 * Helper to apply pass via TurnPipeline with safe fallback.
 */
function applyPassViaPipeline(playerKey: string, options?: any) {
    const turnPipeline = (typeof TurnPipeline !== 'undefined')
        ? TurnPipeline
        : passHandlerTurnPipelineModule;
    if (!turnPipeline) {
        throw new Error('TurnPipeline is not available - cannot process pass');
    }

    // Create action via injected ActionManager for tracking
        const actionApi = getPassHandlerActionApi();
        const actionExtra = options && options.autoNoActionPass === true
            ? { autoNoActionPass: true }
            : {};
        const action = (actionApi && typeof actionApi.createAction === 'function')
            ? actionApi.createAction('pass', playerKey, actionExtra)
            : Object.assign({ type: 'pass' }, actionExtra);

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            (action as any).turnIndex = cardState.turnIndex;
        }

    // Use applyTurnSafe if available, fallback to applyTurn
    if (typeof turnPipeline.applyTurnSafe === 'function') {
        const result = turnPipeline.applyTurnSafe(cardState, gameState, playerKey, action);
        if (!result.ok) {
            console.error('[PASS-HANDLER] Pass rejected:', result.events);
            // Log rejected event but continue - do NOT record
            return { ok: false, events: result.events };
        }
        gameState = result.gameState;
        cardState = result.cardState;

        // Record successful action
        recordPassHandlerAction(action);

        return {
            ok: true,
            events: result.events,
            gameState: result.gameState,
            cardState: result.cardState
        };
    } else {
        // Fallback to regular applyTurn
        const res = turnPipeline.applyTurn(cardState, gameState, playerKey, action);
        gameState = res.gameState;
        cardState = res.cardState;

        // Record successful action
        recordPassHandlerAction(action);

        return {
            ok: true,
            events: res.events || [],
            gameState: res.gameState,
            cardState: res.cardState
        };
    }
}

async function _postApplyPassCommon(lastPlayerKey: string, options?: any) {
    // Shared continuation logic after applyPassViaPipeline
    emitPassHandlerBoardUpdate();
    emitPassHandlerGameStateChange();

    const publishPlayerKey = resolvePassPublishPlayerKey(lastPlayerKey || 'black');
    const publishAction = createPassNetworkAction(publishPlayerKey, cardState, options);

    return finalizePassTurnHandoff(lastPlayerKey || 'black', publishPlayerKey, publishAction);
}

async function legacyFinalizePassTurnHandoff(lastPlayerKey: string, publishPlayerKey: string, publishAction: any) {
    const safePublishPlayerKey = normalizePlayerKey(publishPlayerKey, normalizePlayerKey(lastPlayerKey, 'black'));

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        showPassHandlerResultIfAvailable();
        setPassHandlerProcessing(false);
        publishPassSnapshot(safePublishPlayerKey, publishAction);
        return true;
    }

    const nextPlayer = gameState.currentPlayer;
    const nextProtection = (typeof getActiveProtectionForPlayer === 'function')
        ? getActiveProtectionForPlayer(nextPlayer)
        : [];

    const nextPerma = (typeof getFlipBlockers === 'function')
        ? getFlipBlockers()
        : [];

    const nextMoves = (typeof getLegalMoves === 'function')
        ? getLegalMoves(gameState, nextProtection, nextPerma)
        : [];
    const nextPlayerKey = normalizePlayerKey(nextPlayer, 'black');
    const nextHasPlacement = !isPlacementLockedForPlayerKey(nextPlayerKey) && nextMoves.length > 0;
    const nextHasCard = hasUsableCardFor(nextPlayerKey);
    const nextIsWhite = nextPlayerKey === 'white';
    const nextIsCpuControlled = isCpuControlledPlayer(nextPlayerKey);
    const humanMode = isHumanVsHumanModeEnabled();
    if (!nextHasPlacement && !nextHasCard) {
        if (typeof isGameOver === 'function' && isGameOver(gameState)) {
            showPassHandlerResultIfAvailable();
            setPassHandlerProcessing(false);
            publishPassSnapshot(safePublishPlayerKey, publishAction);
            return true;
        }

        if (!nextIsCpuControlled) {
            setPassHandlerProcessing(false);
            if (typeof onTurnStart === 'function') onTurnStart(nextPlayer);
        } else if (nextIsWhite) {
            setPassHandlerProcessing(!humanMode);
            if (typeof onTurnStart === 'function') onTurnStart(resolvePlayerValue('white', nextPlayer));
            if (!humanMode) {
                scheduleWhiteCpuTurnGuarded((typeof CPU_TURN_DELAY_MS !== 'undefined' ? CPU_TURN_DELAY_MS : 600), {
                    nextPlayerKey
                });
            }
        } else {
            // Delegate to black-pass handler for additional delays/flows
            handleBlackPassWhenNoMoves();
        }
        publishPassSnapshot(safePublishPlayerKey, publishAction);
        return true;
    }

    if (nextIsCpuControlled) {
        setPassHandlerProcessing(!humanMode);
        if (typeof onTurnStart === 'function') onTurnStart(resolvePlayerValue(nextPlayerKey, nextPlayer));
        if (!humanMode) {
            scheduleWhiteCpuTurnGuarded(CPU_TURN_DELAY_MS, {
                nextPlayerKey
            });
        }
    } else {
        setPassHandlerProcessing(false);
        if (typeof onTurnStart === 'function') onTurnStart(resolvePlayerValue('black', nextPlayer));
        emitPassHandlerBoardUpdate();
    }
    publishPassSnapshot(safePublishPlayerKey, publishAction);
    return true;
}

async function finalizePassTurnHandoff(lastPlayerKey: string, publishPlayerKey: string, publishAction: any) {
    const safeLastPlayerKey = normalizePlayerKey(lastPlayerKey, 'black');
    const safePublishPlayerKey = normalizePlayerKey(publishPlayerKey, safeLastPlayerKey);
    if (isExplicitNetworkMatchMode()) {
        return legacyFinalizePassTurnHandoff(safeLastPlayerKey, safePublishPlayerKey, publishAction);
    }
    const handoff = resolvePassHandlerNetworkTurnHandoff();
    const finalizeTurn = (handoff && typeof handoff.finalizeNetworkTurnHandoff === 'function')
        ? handoff.finalizeNetworkTurnHandoff
        : null;

    if (typeof finalizeTurn !== 'function') {
        return legacyFinalizePassTurnHandoff(safeLastPlayerKey, safePublishPlayerKey, publishAction);
    }

    const humanMode = isHumanVsHumanModeEnabled();
    const safeCpuDelay = (typeof CPU_TURN_DELAY_MS !== 'undefined') ? CPU_TURN_DELAY_MS : 600;

    await finalizeTurn({
        playerKey: safePublishPlayerKey,
        actionType: 'pass',
        action: publishAction,
        playbackEvents: [],
        humanMode,
        cpuDelayMs: safeCpuDelay,
        resultOrder: 'beforePublish',
        setProcessing: (nextValue: boolean) => { setPassHandlerProcessing(nextValue); },
        publishSnapshot: publishNetworkSnapshot,
        onTurnStart: (player: any) => {
            if (typeof onTurnStart === 'function') return onTurnStart(player);
            return null;
        },
        scheduleCpuTurn: ({ delayMs, expectedTurnNumber, nextPlayerKey }: any) => {
            scheduleWhiteCpuTurnGuarded(delayMs, { expectedTurnNumber, nextPlayerKey });
        },
        onHumanTurnReady: () => {
            emitPassHandlerBoardUpdate();
        }
    });

    return true;
}

async function handleDoublePlaceNoSecondMove(move: any, passedPlayer: any) {
    const playerName = getPlayerName(passedPlayer);
    scheduleWithDelay(DOUBLE_PLACE_PASS_DELAY_MS, async () => {
        emitPassHandlerLog(`${playerName}: 追加配置の続きが無いため終了`);
        const playerKey = normalizePlayerKey(passedPlayer, 'black');

        const result = applyPassViaPipeline(playerKey);
        if (!result.ok) {
            return handleRejectedPass();
        }
        syncPassPipelineState(result);

        await _postApplyPassCommon(playerKey);
    });
}

async function handleBlackPassWhenNoMoves() {
    const safeBlackPassDelay = (typeof BLACK_PASS_DELAY_MS !== 'undefined') ? BLACK_PASS_DELAY_MS : 1000;
    const safeBlackName = (typeof BLACK !== 'undefined' && typeof getPlayerName === 'function') ? getPlayerName(BLACK) : '黒';
    const expectedPlayer = gameState ? gameState.currentPlayer : null;
    const expectedPlayerKey = normalizePlayerKeyOptional(expectedPlayer);
    const expectedTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
    scheduleWithDelay(safeBlackPassDelay, async () => {
        const currentGameState = resolvePassHandlerGameState();
        const currentPlayerKey = normalizePlayerKeyOptional(currentGameState ? currentGameState.currentPlayer : null);
        const currentTurnNumber = (currentGameState && Number.isFinite(currentGameState.turnNumber)) ? currentGameState.turnNumber : null;
        if (
            (expectedPlayerKey && currentPlayerKey !== expectedPlayerKey) ||
            (expectedTurnNumber !== null && currentTurnNumber !== expectedTurnNumber)
        ) {
            setPassHandlerProcessing(false);
            return;
        }
        emitPassHandlerLog(`${safeBlackName}: パス (置ける場所がありません)`);
        const passedPlayer = gameState.currentPlayer;
        const playerKey = normalizePlayerKey(passedPlayer, 'black');

        const pending = readPendingForPassHandler(playerKey);
        const passOptions = pending ? undefined : { autoNoActionPass: true };
        const result = applyPassViaPipeline(playerKey, passOptions);
        if (!result.ok) {
            return handleRejectedPass();
        }
        syncPassPipelineState(result);

        await _postApplyPassCommon(playerKey, passOptions);
    }, true);
}

async function processPassTurn(playerKey: string, autoMode?: boolean | { autoMode?: boolean; autoNoActionPass?: boolean }) {
    const passTurnOptions = normalizeProcessPassTurnOptions(autoMode);
    const normalizedRequestPlayerKey = normalizePlayerKey(playerKey, 'black');
    const selfName = normalizedRequestPlayerKey === 'white' ? '白' : '黒';
    emitPassHandlerLog(`${selfName}: パス${passTurnOptions.autoMode ? ' (AUTO)' : ''}`);
    const passedPlayer = gameState.currentPlayer;
    const passedPlayerKey = normalizePlayerKey(passedPlayer, normalizedRequestPlayerKey);

    const passOptions = passTurnOptions.autoNoActionPass === true ? { autoNoActionPass: true } : undefined;

    if (isExplicitNetworkMatchMode()) {
        return publishNetworkPassCommand(passedPlayerKey, passOptions);
    }

    const result = applyPassViaPipeline(passedPlayerKey, passOptions);
    if (!result.ok) {
        return handleRejectedPass();
    }
    syncPassPipelineState(result);

    return _postApplyPassCommon(passedPlayerKey, passOptions);
}

export = {
    applyPassViaPipeline,
    handleDoublePlaceNoSecondMove,
    handleBlackPassWhenNoMoves,
    processPassTurn,
    hasUsableCardFor,
    ensureCurrentPlayerCanActOrPass,
    setPassHandlerTimerService,
    setPassHandlerRuntime
};
