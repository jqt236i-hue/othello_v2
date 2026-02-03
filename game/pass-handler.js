(function () {
// Pass and game-end handling utilities extracted from turn-manager
// Refactored to use TurnPipeline exclusively (no legacy path)

if (typeof CardLogic === 'undefined') {
    console.warn('CardLogic not loaded in pass-handler.js');
}

const PASS_HANDLER_VERSION = '2.0'; // TurnPipeline-only version

// Timers abstraction (injected by UI)
let timers = null;
if (typeof require === 'function') {
    try { timers = require('./timers'); } catch (e) { /* ignore */ }
}

function hasUsableCardFor(playerKey) {
    try {
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.hasUsableCard === 'function') {
            return CardLogic.hasUsableCard(cardState, gameState, playerKey);
        }
    } catch (e) { /* ignore */ }
    return false;
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
    emitBoardUpdate();
    emitGameStateChange();

    if (isGameOver(gameState)) {
        showResult();
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

    const nextMoves = getLegalMoves(gameState, nextProtection, nextPerma);
    const nextHasCard = hasUsableCardFor(nextPlayer === BLACK ? 'black' : 'white');

    if (!nextMoves.length && !nextHasCard) {
        if (isGameOver(gameState)) {
            showResult();
            isProcessing = false;
            return true;
        }

        if (nextPlayer === WHITE) {
            isProcessing = true;
            if (typeof onTurnStart === 'function') onTurnStart(WHITE);
            if (timers && typeof timers.waitMs === 'function') {
                timers.waitMs(CPU_TURN_DELAY_MS).then(processCpuTurn);
            } else {
                processCpuTurn();
            }
        } else {
            // Delegate to black-pass handler for additional delays/flows
            handleBlackPassWhenNoMoves();
        }
        return true;
    }

    if (nextPlayer === WHITE) {
        isProcessing = true;
        if (typeof onTurnStart === 'function') onTurnStart(WHITE);
        if (timers && typeof timers.waitMs === 'function') {
            timers.waitMs(CPU_TURN_DELAY_MS).then(processCpuTurn);
        } else {
            processCpuTurn();
        }
    } else {
        isProcessing = false;
        if (typeof onTurnStart === 'function') onTurnStart(BLACK);
        emitBoardUpdate();
    }
    return true;
}

async function handleDoublePlaceNoSecondMove(move, passedPlayer) {
    const playerName = getPlayerName(passedPlayer);
    if (timers && typeof timers.waitMs === 'function') {
        timers.waitMs(DOUBLE_PLACE_PASS_DELAY_MS).then(async () => {
            if (typeof emitLogAdded === 'function') emitLogAdded(`${playerName}: 二連投石 追加手なし → パス`);
            const playerKey = passedPlayer === BLACK ? 'black' : 'white';

            const result = applyPassViaPipeline(playerKey);
            if (!result.ok) {
                console.warn('[PASS-HANDLER] Pass was rejected, continuing anyway');
            }

            await _postApplyPassCommon();
        });
    } else {
        // Fallback immediate path
        if (typeof emitLogAdded === 'function') emitLogAdded(`${playerName}: 二連投石 追加手なし → パス`);
        const playerKey = passedPlayer === BLACK ? 'black' : 'white';

        const result = applyPassViaPipeline(playerKey);
        if (!result.ok) {
            console.warn('[PASS-HANDLER] Pass was rejected, continuing anyway');
        }

        await _postApplyPassCommon();
    }
}

async function handleBlackPassWhenNoMoves() {
    if (timers && typeof timers.waitMs === 'function') {
        timers.waitMs(BLACK_PASS_DELAY_MS).then(async () => {
            if (typeof emitLogAdded === 'function') emitLogAdded(`${getPlayerName(BLACK)}: パス (置ける場所がありません)`);
            const passedPlayer = gameState.currentPlayer;
            const playerKey = passedPlayer === BLACK ? 'black' : 'white';

            const result = applyPassViaPipeline(playerKey);
            if (!result.ok) {
                console.warn('[PASS-HANDLER] Pass was rejected, continuing anyway');
            }

            await _postApplyPassCommon();
        });
    } else {
        if (typeof emitLogAdded === 'function') emitLogAdded(`${getPlayerName(BLACK)}: パス (置ける場所がありません)`);
        const passedPlayer = gameState.currentPlayer;
        const playerKey = passedPlayer === BLACK ? 'black' : 'white';

        const result = applyPassViaPipeline(playerKey);
        if (!result.ok) {
            console.warn('[PASS-HANDLER] Pass was rejected, continuing anyway');
        }

        await _postApplyPassCommon();
    }
}

async function processPassTurn(playerKey, autoMode) {
    const selfName = playerKey === 'white' ? '白' : '黒';
    if (typeof emitLogAdded === 'function') emitLogAdded(`${selfName}: パス${autoMode ? ' (AUTO)' : ''}`);
    const passedPlayer = gameState.currentPlayer;
    const passedPlayerKey = passedPlayer === BLACK ? 'black' : 'white';

    const result = applyPassViaPipeline(passedPlayerKey);
    if (!result.ok) {
        console.warn('[PASS-HANDLER] Pass was rejected, continuing anyway');
    }

    emitBoardUpdate();
    emitGameStateChange();

    if (isGameOver(gameState)) {
        showResult();
        isProcessing = false;
        return true;
    }

    const nextPlayer = gameState.currentPlayer;
    if (typeof getLegalMoves === 'undefined') {
        console.error('getLegalMoves undefined');
        return true;
    }

    const nextProtection = (typeof getActiveProtectionForPlayer === 'function')
        ? getActiveProtectionForPlayer(nextPlayer)
        : [];

    const nextPerma = (typeof getFlipBlockers === 'function')
        ? getFlipBlockers()
        : [];

    const nextMoves = getLegalMoves(gameState, nextProtection, nextPerma);
    const nextHasCard = hasUsableCardFor(nextPlayer === BLACK ? 'black' : 'white');

    if (!nextMoves.length && !nextHasCard) {
        if (isGameOver(gameState)) {
            showResult();
            isProcessing = false;
            return true;
        }

        if (nextPlayer === WHITE) {
            isProcessing = true;
            if (typeof onTurnStart === 'function') onTurnStart(WHITE);
            if (timers && typeof timers.waitMs === 'function') {
                timers.waitMs(CPU_TURN_DELAY_MS).then(processCpuTurn);
            } else {
                processCpuTurn();
            }
        } else {
            if (nextPlayer === WHITE) {
                isProcessing = true;
                if (timers && typeof timers.waitMs === 'function') {
                    timers.waitMs(CPU_TURN_DELAY_MS).then(processCpuTurn);
                } else {
                    processCpuTurn();
                }
            } else {
                handleBlackPassWhenNoMoves();
            }
        }
        return true;
    }

    if (nextPlayer === WHITE) {
        isProcessing = true;
        if (typeof onTurnStart === 'function') onTurnStart(WHITE);
        if (timers && typeof timers.waitMs === 'function') {
            timers.waitMs(CPU_TURN_DELAY_MS).then(processCpuTurn);
        } else {
            processCpuTurn();
        }
    } else {
        isProcessing = false;
        if (typeof onTurnStart === 'function') onTurnStart(BLACK);
        emitBoardUpdate();
    }
    return true;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        applyPassViaPipeline,
        handleDoublePlaceNoSecondMove,
        handleBlackPassWhenNoMoves,
        processPassTurn,
        hasUsableCardFor
    };
}
})();
