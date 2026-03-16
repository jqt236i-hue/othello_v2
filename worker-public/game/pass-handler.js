(function () {
// Pass and game-end handling utilities extracted from turn-manager
// Refactored to use TurnPipeline exclusively (no legacy path)

const PASS_HANDLER_VERSION = '2.0'; // TurnPipeline-only version

// Timers abstraction (injected by UI)
let timers = null;
let OwnerHelpersModule = null;
let passHandlerNetworkTurnHandoff = null;
if (typeof require === 'function') {
    try { timers = require('./timers'); } catch (e) { /* ignore */ }
    try { OwnerHelpersModule = require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
    try { passHandlerNetworkTurnHandoff = require('./network-turn-handoff'); } catch (e) { /* ignore */ }
}
if (!OwnerHelpersModule && typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) {
    OwnerHelpersModule = globalThis.OwnerHelpers;
}
if (!passHandlerNetworkTurnHandoff && typeof globalThis !== 'undefined' && globalThis.NetworkTurnHandoff) {
    passHandlerNetworkTurnHandoff = globalThis.NetworkTurnHandoff;
}

function normalizePlayerKeyOptional(value) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            return OwnerHelpersModule.normalizePlayerKeyOptional(value);
        }
    } catch (e) { /* ignore */ }
    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return null;
}

function normalizePlayerKey(value, fallbackKey) {
    const normalized = normalizePlayerKeyOptional(value);
    if (normalized) return normalized;
    return fallbackKey === 'white' ? 'white' : 'black';
}

function resolvePlayerValue(playerKey, fallbackValue) {
    const normalized = normalizePlayerKey(playerKey, 'black');
    if (normalized === 'white') {
        return (typeof WHITE !== 'undefined') ? WHITE : fallbackValue;
    }
    return (typeof BLACK !== 'undefined') ? BLACK : fallbackValue;
}

function hasUsableWaitMs(t) {
    if (!t || typeof t.waitMs !== 'function') return false;
    // game/timers default waitMs() is immediate unless UI impl is injected.
    if (typeof t.hasTimerImpl === 'function' && !t.hasTimerImpl()) return false;
    return true;
}

function scheduleWithDelay(delayMs, callback, immediateWithoutTimers) {
    const safeDelay = Number.isFinite(delayMs) ? delayMs : 0;
    if (hasUsableWaitMs(timers)) {
        timers.waitMs(safeDelay).then(callback);
        return;
    }
    if (immediateWithoutTimers) {
        callback();
        return;
    }
    const tid = setTimeout(callback, safeDelay);
    if (tid && typeof tid.unref === 'function') tid.unref();
}

const WHITE_CPU_TURN_RETRY_DELAY_MS = 32;
const WHITE_CPU_TURN_MAX_RETRIES = 2;

function resolveCpuTurnFnForPass() {
    try {
        if (typeof processCpuTurn === 'function') return processCpuTurn;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.processCpuTurn === 'function') {
            return globalThis.processCpuTurn;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function scheduleWhiteCpuTurnGuarded(delayMs, options) {
    if (isHumanVsHumanModeEnabled()) return;
    const opts = options || {};
    const expectedTurnNumber = Number.isFinite(opts.expectedTurnNumber)
        ? opts.expectedTurnNumber
        : ((gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null);
    const retryCount = Number.isFinite(opts.retryCount) ? Math.max(0, opts.retryCount) : 0;
    scheduleWithDelay(delayMs, () => {
        const currentPlayer = gameState ? gameState.currentPlayer : null;
        if (normalizePlayerKeyOptional(currentPlayer) !== 'white') return;
        const currentTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
        const cpuFn = resolveCpuTurnFnForPass();
        if (!cpuFn) {
            if (retryCount < WHITE_CPU_TURN_MAX_RETRIES) {
                scheduleWhiteCpuTurnGuarded(WHITE_CPU_TURN_RETRY_DELAY_MS, {
                    expectedTurnNumber: currentTurnNumber !== null ? currentTurnNumber : expectedTurnNumber,
                    retryCount: retryCount + 1
                });
            }
            return;
        }
        // Pass resolution can advance bookkeeping before the delayed callback fires.
        // If it is still white's turn, continue with the latest white turn instead of dropping the handoff.
        if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) {
            cpuFn();
            return;
        }
        cpuFn();
    });
}

function getCurrentMatchModeSafe() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.getCurrentMatchMode === 'function') {
            return OwnerHelpersModule.getCurrentMatchMode(typeof globalThis !== 'undefined' ? globalThis : null);
        }
    } catch (e) { /* ignore */ }
    let matchMode = null;
    try {
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return matchMode;
}

function isHumanVsHumanModeEnabled() {
    const debugHvH = (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
    const matchMode = getCurrentMatchModeSafe();
    return debugHvH || matchMode === 'network';
}

function isNetworkModeEnabled() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            return OwnerHelpersModule.isNetworkMode(typeof globalThis !== 'undefined' ? globalThis : null);
        }
    } catch (e) { /* ignore */ }
    const matchMode = getCurrentMatchModeSafe();
    return matchMode === 'network';
}

function isCpuControlledPlayer(playerKey) {
    if (!playerKey) return false;
    if (isHumanVsHumanModeEnabled() || isNetworkModeEnabled()) return false;
    // Browser match defaults: black=local human, white=CPU.
    return playerKey === 'white';
}

function publishNetworkSnapshot(meta) {
    try {
        if (typeof globalThis === 'undefined' || !globalThis.NetworkMatchClient) return;
        if (typeof globalThis.NetworkMatchClient.publishSnapshot !== 'function') return;
        if (typeof globalThis.NetworkMatchClient.isActive === 'function' && !globalThis.NetworkMatchClient.isActive()) return;
        globalThis.NetworkMatchClient.publishSnapshot(meta || {});
    } catch (e) { /* ignore */ }
}

function createPassNetworkAction(playerKey, cardStateValue) {
    const normalizedPlayerKey = normalizePlayerKey(playerKey, 'black');
    const action = { type: 'pass', playerKey: normalizedPlayerKey };
    if (cardStateValue && Number.isFinite(Number(cardStateValue.turnIndex))) {
        action.turnIndex = Math.trunc(Number(cardStateValue.turnIndex));
    }
    return action;
}

function publishPassSnapshot(playerKey, actionOverride) {
    const normalizedPlayerKey = normalizePlayerKey(playerKey, 'black');
    const action = (actionOverride && typeof actionOverride === 'object')
        ? actionOverride
        : createPassNetworkAction(normalizedPlayerKey, cardState);
    const meta = {
        playerKey: normalizedPlayerKey,
        actionType: 'pass',
        action,
        playbackEvents: []
    };
    publishNetworkSnapshot(meta);
}

function hasUsableCardFor(playerKey) {
    try {
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.hasUsableCard === 'function') {
            return CardLogic.hasUsableCard(cardState, gameState, playerKey);
        }
    } catch (e) { /* ignore */ }
    return false;
}

function resolveCoreApi() {
    if (typeof Core !== 'undefined' && Core && typeof Core.getLegalMoves === 'function') return Core;
    if (typeof CoreLogic !== 'undefined' && CoreLogic && typeof CoreLogic.getLegalMoves === 'function') return CoreLogic;
    return null;
}

function getLegalMovesForPlayer(playerValue) {
    if (!gameState) return [];

    const core = resolveCoreApi();
    if (core) {
        try {
            const ctx = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardContext === 'function')
                ? CardLogic.getCardContext(cardState)
                : { protectedStones: [], permaProtectedStones: [], bombs: [] };
            return core.getLegalMoves(gameState, playerValue, ctx) || [];
        } catch (e) { /* ignore */ }
    }

    if (typeof getLegalMoves !== 'function') return [];
    try {
        const probeState = Object.assign({}, gameState, { currentPlayer: playerValue });
        const protection = (typeof getActiveProtectionForPlayer === 'function')
            ? getActiveProtectionForPlayer(playerValue)
            : [];
        const perma = (typeof getFlipBlockers === 'function')
            ? getFlipBlockers()
            : [];
        return getLegalMoves(probeState, protection, perma) || [];
    } catch (e) {
        return [];
    }
}

function playerHasAnyAvailableAction(playerValue) {
    const playerKey = normalizePlayerKey(playerValue, 'black');
    const legalMoves = getLegalMovesForPlayer(playerValue);
    if (legalMoves.length > 0) return true;
    return hasUsableCardFor(playerKey);
}

function isNoActionTerminalState() {
    const safeBlack = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const safeWhite = (typeof WHITE !== 'undefined') ? WHITE : -1;
    return !playerHasAnyAvailableAction(safeBlack) && !playerHasAnyAvailableAction(safeWhite);
}

function finalizeNoActionTerminal() {
    if (!isNoActionTerminalState()) return false;
    if (gameState && (typeof gameState.consecutivePasses !== 'number' || gameState.consecutivePasses < 2)) {
        gameState.consecutivePasses = 2;
    }
    if (typeof showResult === 'function') showResult();
    isProcessing = false;
    return true;
}

function handleRejectedPass() {
    if (finalizeNoActionTerminal()) return true;
    console.warn('[PASS-HANDLER] Pass was rejected; keeping current turn');
    isProcessing = false;
    return false;
}

function syncPassPipelineState(result) {
    if (!result || typeof result !== 'object') return;
    if (result.gameState) gameState = result.gameState;
    if (result.cardState) cardState = result.cardState;
}

function ensureCurrentPlayerCanActOrPass(options) {
    if (!gameState || !cardState) return false;
    const opts = options || {};
    const currentPlayer = gameState.currentPlayer;
    const playerKey = normalizePlayerKey(currentPlayer, 'black');
    const pending = (cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey]) ? cardState.pendingEffectByPlayer[playerKey] : null;

    // Target selection is still an available action, so do not auto-pass.
    if (pending && pending.stage === 'selectTarget') return false;

    const legalMoves = getLegalMovesForPlayer(currentPlayer);
    const hasCard = hasUsableCardFor(playerKey);
    if (legalMoves.length > 0 || hasCard) return false;

    // Human turns must keep explicit pass semantics:
    // even with no legal move, allow manual card use/discard decisions first.
    // Auto-pass is reserved for CPU-controlled turns only.
    if (!isCpuControlledPlayer(playerKey)) {
        return false;
    }

    if (opts.useBlackDelay && typeof BLACK !== 'undefined' && currentPlayer === BLACK) {
        handleBlackPassWhenNoMoves();
        return true;
    }

    processPassTurn(playerKey, !!opts.autoMode);
    return true;
}

/**
 * Helper to apply pass via TurnPipeline with safe fallback.
 * @param {string} playerKey - 'black' or 'white'
 * @returns {{ ok: boolean, events: Array }}
 */
function applyPassViaPipeline(playerKey) {
    if (typeof TurnPipeline === 'undefined') {
        throw new Error('TurnPipeline is not available - cannot process pass');
    }

    // Create action via ActionManager for tracking
        const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
            ? ActionManager.ActionManager.createAction('pass', playerKey, {})
            : { type: 'pass' };

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

    // Use applyTurnSafe if available, fallback to applyTurn
    if (typeof TurnPipeline.applyTurnSafe === 'function') {
        const result = TurnPipeline.applyTurnSafe(cardState, gameState, playerKey, action);
        if (!result.ok) {
            console.error('[PASS-HANDLER] Pass rejected:', result.events);
            // Log rejected event but continue - do NOT record
            return { ok: false, events: result.events };
        }
        gameState = result.gameState;
        cardState = result.cardState;

        // Record successful action
        if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
            ActionManager.ActionManager.recordAction(action);
            ActionManager.ActionManager.incrementTurnIndex();
        }

        return {
            ok: true,
            events: result.events,
            gameState: result.gameState,
            cardState: result.cardState
        };
    } else {
        // Fallback to regular applyTurn
        const res = TurnPipeline.applyTurn(cardState, gameState, playerKey, action);
        gameState = res.gameState;
        cardState = res.cardState;

        // Record successful action
        if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
            ActionManager.ActionManager.recordAction(action);
            ActionManager.ActionManager.incrementTurnIndex();
        }

        return {
            ok: true,
            events: res.events || [],
            gameState: res.gameState,
            cardState: res.cardState
        };
    }
}

async function _postApplyPassCommon(lastPlayerKey) {
    // Shared continuation logic after applyPassViaPipeline
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e) { /* ignore */ }

    const publishAction = createPassNetworkAction(lastPlayerKey || 'black', cardState);

    return finalizePassTurnHandoff(lastPlayerKey || 'black', publishAction);
}

async function legacyFinalizePassTurnHandoff(lastPlayerKey, publishAction) {
    const safeLastPlayerKey = normalizePlayerKey(lastPlayerKey, 'black');

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        publishPassSnapshot(safeLastPlayerKey, publishAction);
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
    const nextHasCard = hasUsableCardFor(nextPlayerKey);
    const nextIsWhite = nextPlayerKey === 'white';
    const humanMode = isHumanVsHumanModeEnabled();
    if (!nextMoves.length && !nextHasCard) {
        if (typeof isGameOver === 'function' && isGameOver(gameState)) {
            if (typeof showResult === 'function') showResult();
            isProcessing = false;
            publishPassSnapshot(safeLastPlayerKey, publishAction);
            return true;
        }

        if (!isCpuControlledPlayer(nextPlayerKey)) {
            isProcessing = false;
            if (typeof onTurnStart === 'function') onTurnStart(nextPlayer);
        } else if (nextIsWhite) {
            isProcessing = !humanMode;
            if (typeof onTurnStart === 'function') onTurnStart(resolvePlayerValue('white', nextPlayer));
            if (!humanMode) {
                scheduleWhiteCpuTurnGuarded((typeof CPU_TURN_DELAY_MS !== 'undefined' ? CPU_TURN_DELAY_MS : 600));
            }
        } else {
            // Delegate to black-pass handler for additional delays/flows
            handleBlackPassWhenNoMoves();
        }
        publishPassSnapshot(safeLastPlayerKey, publishAction);
        return true;
    }

    if (nextIsWhite) {
        isProcessing = !humanMode;
        if (typeof onTurnStart === 'function') onTurnStart(resolvePlayerValue('white', nextPlayer));
        if (!humanMode) {
            scheduleWhiteCpuTurnGuarded(CPU_TURN_DELAY_MS);
        }
    } else {
        isProcessing = false;
        if (typeof onTurnStart === 'function') onTurnStart(resolvePlayerValue('black', nextPlayer));
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    }
    publishPassSnapshot(safeLastPlayerKey, publishAction);
    return true;
}

async function finalizePassTurnHandoff(lastPlayerKey, publishAction) {
    const safeLastPlayerKey = normalizePlayerKey(lastPlayerKey, 'black');
    const finalizeTurn = (passHandlerNetworkTurnHandoff && typeof passHandlerNetworkTurnHandoff.finalizeNetworkTurnHandoff === 'function')
        ? passHandlerNetworkTurnHandoff.finalizeNetworkTurnHandoff
        : null;

    if (typeof finalizeTurn !== 'function') {
        return legacyFinalizePassTurnHandoff(safeLastPlayerKey, publishAction);
    }

    const humanMode = isHumanVsHumanModeEnabled();
    const safeCpuDelay = (typeof CPU_TURN_DELAY_MS !== 'undefined') ? CPU_TURN_DELAY_MS : 600;

    await finalizeTurn({
        playerKey: safeLastPlayerKey,
        actionType: 'pass',
        action: publishAction,
        playbackEvents: [],
        humanMode,
        cpuDelayMs: safeCpuDelay,
        resultOrder: 'beforePublish',
        setProcessing: (nextValue) => { isProcessing = !!nextValue; },
        publishSnapshot: publishNetworkSnapshot,
        onTurnStart: (player) => {
            if (typeof onTurnStart === 'function') return onTurnStart(player);
            return null;
        },
        scheduleCpuTurn: ({ delayMs, expectedTurnNumber }) => {
            scheduleWhiteCpuTurnGuarded(delayMs, { expectedTurnNumber });
        },
        onHumanTurnReady: () => {
            try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
        }
    });

    return true;
}

async function handleDoublePlaceNoSecondMove(move, passedPlayer) {
    const playerName = getPlayerName(passedPlayer);
    scheduleWithDelay(DOUBLE_PLACE_PASS_DELAY_MS, async () => {
        if (typeof emitLogAdded === 'function') emitLogAdded(`${playerName}: 追加配置の続きが無いため終了`);
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
    scheduleWithDelay(safeBlackPassDelay, async () => {
        if (typeof emitLogAdded === 'function') emitLogAdded(`${safeBlackName}: パス (置ける場所がありません)`);
        const passedPlayer = gameState.currentPlayer;
        const playerKey = normalizePlayerKey(passedPlayer, 'black');

        const result = applyPassViaPipeline(playerKey);
        if (!result.ok) {
            return handleRejectedPass();
        }
        syncPassPipelineState(result);

        await _postApplyPassCommon(playerKey);
    }, true);
}

async function processPassTurn(playerKey, autoMode) {
    const normalizedRequestPlayerKey = normalizePlayerKey(playerKey, 'black');
    const selfName = normalizedRequestPlayerKey === 'white' ? '白' : '黒';
    if (typeof emitLogAdded === 'function') emitLogAdded(`${selfName}: パス${autoMode ? ' (AUTO)' : ''}`);
    const passedPlayer = gameState.currentPlayer;
    const passedPlayerKey = normalizePlayerKey(passedPlayer, normalizedRequestPlayerKey);

    const result = applyPassViaPipeline(passedPlayerKey);
    if (!result.ok) {
        return handleRejectedPass();
    }
    syncPassPipelineState(result);

    return _postApplyPassCommon(passedPlayerKey);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        applyPassViaPipeline,
        handleDoublePlaceNoSecondMove,
        handleBlackPassWhenNoMoves,
        processPassTurn,
        hasUsableCardFor,
        ensureCurrentPlayerCanActOrPass
    };
}
try {
    if (typeof globalThis !== 'undefined') {
        try { globalThis.processPassTurn = processPassTurn; } catch (e) { /* ignore */ }
        try { globalThis.ensureCurrentPlayerCanActOrPass = ensureCurrentPlayerCanActOrPass; } catch (e) { /* ignore */ }
    }
} catch (e) { /* ignore */ }
})();
