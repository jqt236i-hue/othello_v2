(function () {
// Pass and game-end handling utilities extracted from turn-manager
// Refactored to use TurnPipeline exclusively (no legacy path)

const PASS_HANDLER_VERSION = '2.0'; // TurnPipeline-only version

// Timers abstraction (injected by UI)
let timers = null;
if (typeof require === 'function') {
    try { timers = require('./timers'); } catch (e) { /* ignore */ }
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

function scheduleWhiteCpuTurnGuarded(delayMs) {
    const expectedTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
    scheduleWithDelay(delayMs, () => {
        const currentPlayer = gameState ? gameState.currentPlayer : null;
        const isWhiteTurn = (typeof WHITE !== 'undefined' && currentPlayer === WHITE) || currentPlayer === 'white';
        if (!isWhiteTurn) return;
        const currentTurnNumber = (gameState && Number.isFinite(gameState.turnNumber)) ? gameState.turnNumber : null;
        if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) return;
        if (typeof processCpuTurn === 'function') processCpuTurn();
    });
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
    const playerKey = (typeof BLACK !== 'undefined' && playerValue === BLACK) ? 'black' : 'white';
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

function ensureCurrentPlayerCanActOrPass(options) {
    if (!gameState || !cardState) return false;
    const opts = options || {};
    const currentPlayer = gameState.currentPlayer;
    const playerKey = (typeof BLACK !== 'undefined' && currentPlayer === BLACK) ? 'black' : 'white';
    const pending = (cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey]) ? cardState.pendingEffectByPlayer[playerKey] : null;

    // Target selection is still an available action, so do not auto-pass.
    if (pending && pending.stage === 'selectTarget') return false;

    const legalMoves = getLegalMovesForPlayer(currentPlayer);
    const hasCard = hasUsableCardFor(playerKey);
    if (legalMoves.length > 0 || hasCard) return false;

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

        return { ok: true, events: result.events };
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

        return { ok: true, events: res.events || [] };
    }
}

async function _postApplyPassCommon() {
    // Shared continuation logic after applyPassViaPipeline
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e) { /* ignore */ }

    if (finalizeNoActionTerminal()) {
        return true;
    }

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
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
    const nextHasCard = hasUsableCardFor((typeof BLACK !== 'undefined' && nextPlayer === BLACK) ? 'black' : 'white');

    const nextIsWhite = (typeof WHITE !== 'undefined' && nextPlayer === WHITE);
    if (!nextMoves.length && !nextHasCard) {
        if (typeof isGameOver === 'function' && isGameOver(gameState)) {
            if (typeof showResult === 'function') showResult();
            isProcessing = false;
            return true;
        }

        if (nextIsWhite) {
            isProcessing = true;
            if (typeof onTurnStart === 'function' && typeof WHITE !== 'undefined') onTurnStart(WHITE);
            scheduleWhiteCpuTurnGuarded((typeof CPU_TURN_DELAY_MS !== 'undefined' ? CPU_TURN_DELAY_MS : 600));
        } else {
            // Delegate to black-pass handler for additional delays/flows
            handleBlackPassWhenNoMoves();
        }
        return true;
    }

    if (nextPlayer === WHITE) {
        isProcessing = true;
        if (typeof onTurnStart === 'function') onTurnStart(WHITE);
        scheduleWhiteCpuTurnGuarded(CPU_TURN_DELAY_MS);
    } else {
        isProcessing = false;
        if (typeof onTurnStart === 'function') onTurnStart(BLACK);
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    }
    return true;
}

async function handleDoublePlaceNoSecondMove(move, passedPlayer) {
    const playerName = getPlayerName(passedPlayer);
    scheduleWithDelay(DOUBLE_PLACE_PASS_DELAY_MS, async () => {
        if (typeof emitLogAdded === 'function') emitLogAdded(`${playerName}: 二連投石 追加手なし → パス`);
        const playerKey = (typeof BLACK !== 'undefined' && passedPlayer === BLACK) ? 'black' : 'white';

        const result = applyPassViaPipeline(playerKey);
        if (!result.ok) {
            return handleRejectedPass();
        }

        await _postApplyPassCommon();
    });
}

async function handleBlackPassWhenNoMoves() {
    const safeBlackPassDelay = (typeof BLACK_PASS_DELAY_MS !== 'undefined') ? BLACK_PASS_DELAY_MS : 1000;
    const safeBlackName = (typeof BLACK !== 'undefined' && typeof getPlayerName === 'function') ? getPlayerName(BLACK) : '黒';
    scheduleWithDelay(safeBlackPassDelay, async () => {
        if (typeof emitLogAdded === 'function') emitLogAdded(`${safeBlackName}: パス (置ける場所がありません)`);
        const passedPlayer = gameState.currentPlayer;
        const playerKey = (typeof BLACK !== 'undefined' && passedPlayer === BLACK) ? 'black' : 'white';

        const result = applyPassViaPipeline(playerKey);
        if (!result.ok) {
            return handleRejectedPass();
        }

        await _postApplyPassCommon();
    }, true);
}

async function processPassTurn(playerKey, autoMode) {
    const selfName = playerKey === 'white' ? '白' : '黒';
    if (typeof emitLogAdded === 'function') emitLogAdded(`${selfName}: パス${autoMode ? ' (AUTO)' : ''}`);
    const passedPlayer = gameState.currentPlayer;
    const passedPlayerKey = (typeof BLACK !== 'undefined' && passedPlayer === BLACK) ? 'black' : 'white';

    const result = applyPassViaPipeline(passedPlayerKey);
    if (!result.ok) {
        return handleRejectedPass();
    }

    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e) { /* ignore */ }

    if (typeof isGameOver === 'function' && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return true;
    }

    const nextPlayer = gameState.currentPlayer;
    const safeGetLegalMoves = (typeof getLegalMoves === 'function')
        ? getLegalMoves
        : null;

    const nextProtection = (typeof getActiveProtectionForPlayer === 'function')
        ? getActiveProtectionForPlayer(nextPlayer)
        : [];

    const nextPerma = (typeof getFlipBlockers === 'function')
        ? getFlipBlockers()
        : [];

    const nextMoves = safeGetLegalMoves
        ? safeGetLegalMoves(gameState, nextProtection, nextPerma)
        : [];
    const nextHasCard = hasUsableCardFor((typeof BLACK !== 'undefined' && nextPlayer === BLACK) ? 'black' : 'white');
    const nextIsWhite = (typeof WHITE !== 'undefined' && nextPlayer === WHITE);

    if (!nextMoves.length && !nextHasCard) {
        if (typeof isGameOver === 'function' && isGameOver(gameState)) {
            if (typeof showResult === 'function') showResult();
            isProcessing = false;
            return true;
        }

        if (nextIsWhite) {
            isProcessing = true;
            if (typeof onTurnStart === 'function' && typeof WHITE !== 'undefined') onTurnStart(WHITE);
            scheduleWhiteCpuTurnGuarded((typeof CPU_TURN_DELAY_MS !== 'undefined' ? CPU_TURN_DELAY_MS : 600));
        } else {
            handleBlackPassWhenNoMoves();
        }
        return true;
    }

    if (nextIsWhite) {
        isProcessing = true;
        if (typeof onTurnStart === 'function' && typeof WHITE !== 'undefined') onTurnStart(WHITE);
        scheduleWhiteCpuTurnGuarded((typeof CPU_TURN_DELAY_MS !== 'undefined' ? CPU_TURN_DELAY_MS : 600));
    } else {
        isProcessing = false;
        if (typeof onTurnStart === 'function' && typeof BLACK !== 'undefined') onTurnStart(BLACK);
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    }
    return true;
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
