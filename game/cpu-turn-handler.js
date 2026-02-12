// CPU turn orchestration extracted from turn-manager

// Timers abstraction (injected by UI)
(function () {
let timers = null;
if (typeof require === 'function') {
    try { timers = require('./timers'); } catch (e) { /* ignore */ }
}
let passHandler = null;
if (typeof require === 'function') {
    try { passHandler = require('./pass-handler'); } catch (e) { /* ignore */ }
}

// Local safe constants to avoid ReferenceError for undeclared globals in test environments
const CONST_BLACK = (typeof BLACK !== 'undefined') ? BLACK : ((typeof global !== 'undefined' && typeof global.BLACK !== 'undefined') ? global.BLACK : 1);
const CONST_WHITE = (typeof WHITE !== 'undefined') ? WHITE : ((typeof global !== 'undefined' && typeof global.WHITE !== 'undefined') ? global.WHITE : -1);

function getAnimationRetryDelayMs() {
    const fallback = 200;
    try {
        if (typeof ANIMATION_RETRY_DELAY_MS !== 'undefined' && Number.isFinite(ANIMATION_RETRY_DELAY_MS)) {
            return ANIMATION_RETRY_DELAY_MS;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && Number.isFinite(globalThis.ANIMATION_RETRY_DELAY_MS)) {
            return globalThis.ANIMATION_RETRY_DELAY_MS;
        }
    } catch (e) { /* ignore */ }
    return fallback;
}

function getActiveProtectionSafe(playerValue) {
    try {
        if (typeof getActiveProtectionForPlayer === 'function') {
            return getActiveProtectionForPlayer(playerValue) || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function getFlipBlockersSafe() {
    try {
        if (typeof getFlipBlockers === 'function') {
            return getFlipBlockers() || [];
        }
    } catch (e) { /* ignore */ }
    return [];
}

function getCurrentPlayerKeySafe() {
    try {
        const current = gameState ? gameState.currentPlayer : null;
        if (current === CONST_BLACK || current === 'black') return 'black';
        if (current === CONST_WHITE || current === 'white') return 'white';
    } catch (e) { /* ignore */ }
    return null;
}

function getCurrentTurnNumberSafe() {
    try {
        const turnNumber = gameState ? gameState.turnNumber : null;
        return Number.isFinite(turnNumber) ? turnNumber : null;
    } catch (e) { /* ignore */ }
    return null;
}

function debugCpuTrace(message, meta) {
    try {
        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
            if (typeof debugLog === 'function') {
                debugLog(message, 'debug', meta || {});
            } else {
                console.log(message, meta || {});
            }
        }
    } catch (e) { /* ignore */ }
}

async function maybeUseCardFromOnnx(playerKey, level, legalMovesCount) {
    if (typeof selectCardFromOnnxPolicyAsync !== 'function') return false;
    if (typeof applyCardChoice !== 'function') return false;
    if (typeof CardLogic === 'undefined' || !CardLogic || !cardState || !gameState) return false;
    try {
        let usable = [];
        if (typeof CardLogic.getUsableCardIds === 'function') {
            usable = CardLogic.getUsableCardIds(cardState, gameState, playerKey) || [];
        }
        if (!Array.isArray(usable) || usable.length === 0) return false;
        const choice = await selectCardFromOnnxPolicyAsync(playerKey, level, legalMovesCount, usable);
        if (!choice || !choice.cardId) return false;
        return !!applyCardChoice(playerKey, choice);
    } catch (e) {
        debugCpuTrace('[AI] selectCardFromOnnxPolicyAsync failed; fallback to policy table/core', {
            playerKey,
            error: e && e.message ? e.message : String(e)
        });
        return false;
    }
}

function selectCpuMoveSafe(candidateMoves, playerKey) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
    try {
        if (typeof selectCpuMoveWithPolicy === 'function') {
            const selected = selectCpuMoveWithPolicy(candidateMoves, playerKey);
            if (selected && Number.isFinite(selected.row) && Number.isFinite(selected.col)) {
                return selected;
            }
        }
    } catch (e) {
        debugCpuTrace('[AI] selectCpuMoveWithPolicy failed; fallback to first candidate', {
            playerKey,
            error: e && e.message ? e.message : String(e)
        });
    }
    // Test/headless fallback: keep deterministic behavior instead of throwing.
    return candidateMoves[0];
}

// Allow injection of timers for tests and for alternate scheduler implementations
function setTimers(t) {
    timers = t;
}
function getTimers() { return timers; }

function isUiAnimationBusy() {
    const localCard = (typeof isCardAnimating !== 'undefined') ? !!isCardAnimating : false;
    const winCard = (typeof globalThis !== 'undefined') ? !!globalThis.isCardAnimating : false;
    const winPlayback = (typeof globalThis !== 'undefined') ? (globalThis.VisualPlaybackActive === true) : false;
    return localCard || winCard || winPlayback;
}
const _cpuRetryPendingByPlayer = { black: false, white: false };
const _pendingSelectRetryStateByPlayer = {
    black: { key: '', count: 0 },
    white: { key: '', count: 0 }
};
const MAX_STUCK_PENDING_SELECT_RETRIES = 4;

function _retryStateKey(playerKey) {
    return playerKey === 'white' ? 'white' : 'black';
}

function resetPendingSelectRetryState(playerKey) {
    const key = _retryStateKey(playerKey);
    _pendingSelectRetryStateByPlayer[key].key = '';
    _pendingSelectRetryStateByPlayer[key].count = 0;
}

function makePendingSelectRetryKey(pending) {
    if (!pending) return '';
    const type = String(pending.type || '');
    const stage = String(pending.stage || '');
    const selectedCount = Number.isFinite(pending.selectedCount) ? pending.selectedCount : 0;
    const maxSelections = Number.isFinite(pending.maxSelections) ? pending.maxSelections : 0;
    const offersLen = Array.isArray(pending.offers) ? pending.offers.length : 0;
    return `${type}:${stage}:${selectedCount}:${maxSelections}:${offersLen}`;
}

function shouldAbortStuckPendingSelection(playerKey, pending) {
    const key = _retryStateKey(playerKey);
    const retryKey = makePendingSelectRetryKey(pending);
    const state = _pendingSelectRetryStateByPlayer[key];
    if (state.key === retryKey) {
        state.count += 1;
    } else {
        state.key = retryKey;
        state.count = 1;
    }
    return state.count > MAX_STUCK_PENDING_SELECT_RETRIES;
}

function scheduleRunCpuTurn(playerKey, options, delayMs) {
    const key = playerKey === 'white' ? 'white' : 'black';
    if (_cpuRetryPendingByPlayer[key]) return;
    _cpuRetryPendingByPlayer[key] = true;
    const expectedPlayerKey = getCurrentPlayerKeySafe();
    const expectedTurnNumber = getCurrentTurnNumberSafe();
    scheduleRetry(() => {
        _cpuRetryPendingByPlayer[key] = false;
        const currentPlayerKey = getCurrentPlayerKeySafe();
        const currentTurnNumber = getCurrentTurnNumberSafe();
        if (expectedPlayerKey && currentPlayerKey !== expectedPlayerKey) {
            debugCpuTrace('[AI] skip stale scheduled CPU run (player changed)', {
                playerKey: key,
                expectedPlayerKey,
                currentPlayerKey,
                expectedTurnNumber,
                currentTurnNumber
            });
            return;
        }
        if (expectedTurnNumber !== null && currentTurnNumber !== expectedTurnNumber) {
            debugCpuTrace('[AI] skip stale scheduled CPU run (turn changed)', {
                playerKey: key,
                expectedPlayerKey,
                currentPlayerKey,
                expectedTurnNumber,
                currentTurnNumber
            });
            return;
        }
        runCpuTurn(key, options || {});
    }, delayMs);
}

function resolveProcessPassTurn() {
    if (typeof processPassTurn === 'function') return processPassTurn;
    if (passHandler && typeof passHandler.processPassTurn === 'function') return passHandler.processPassTurn;
    try {
        if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis.processPassTurn === 'function') {
            return globalThis.processPassTurn;
        }
    } catch (e) { /* ignore */ }
    return null;
}

// Prefer shared scheduleRetry helper from game/timer-utils when available, fallback to a local implementation
// Build scheduleRetry as a small wrapper that prefers injected timers with a real impl,
// then falls back to setTimeout.
function hasUsableWaitMs(t) {
    if (!t || typeof t.waitMs !== 'function') return false;
    // game/timers exposes hasTimerImpl(): false means Promise.resolve() immediate fallback
    // which can cause tight retry loops.
    if (typeof t.hasTimerImpl === 'function' && !t.hasTimerImpl()) return false;
    return true;
}

function scheduleRetry(fn, delayMs = getAnimationRetryDelayMs()) {
    // 1) Prefer module-scoped injected timers when a real impl is present.
    if (hasUsableWaitMs(timers)) {
        try {
            timers.waitMs(delayMs).then(() => { try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); } });
            return;
        } catch (e) { /* fall through */ }
    }

    // 2) Fallback to setTimeout
    const tid = setTimeout(() => { try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); } }, delayMs);
    if (tid && typeof tid.unref === 'function') tid.unref();
}

// Return a mapping of pending-effect type => async handler for a given playerKey.
// This centralizes the handler registration and makes it simpler to test/extend.
function getPendingTypeHandlers(playerKey) {
    return {
        'DESTROY_ONE_STONE': async () => { await cpuSelectDestroyWithPolicy(playerKey); },
        'STRONG_WIND_WILL': async () => { if (typeof cpuSelectStrongWindWillWithPolicy === 'function') await cpuSelectStrongWindWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SACRIFICE_WILL': async () => { if (typeof cpuSelectSacrificeWillWithPolicy === 'function') await cpuSelectSacrificeWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SELL_CARD_WILL': async () => { if (typeof cpuSelectSellCardWillWithPolicy === 'function') await cpuSelectSellCardWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'HEAVEN_BLESSING': async () => { if (typeof cpuSelectHeavenBlessingWithPolicy === 'function') await cpuSelectHeavenBlessingWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'CONDEMN_WILL': async () => { if (typeof cpuSelectCondemnWillWithPolicy === 'function') await cpuSelectCondemnWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SWAP_WITH_ENEMY': async () => { if (typeof cpuSelectSwapWithEnemyWithPolicy === 'function') await cpuSelectSwapWithEnemyWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'POSITION_SWAP_WILL': async () => { if (typeof cpuSelectPositionSwapWillWithPolicy === 'function') await cpuSelectPositionSwapWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TRAP_WILL': async () => { if (typeof cpuSelectTrapWillWithPolicy === 'function') await cpuSelectTrapWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'GUARD_WILL': async () => { if (typeof cpuSelectGuardWillWithPolicy === 'function') await cpuSelectGuardWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TEMPT_WILL': async () => { if (typeof cpuSelectTemptWillWithPolicy === 'function') await cpuSelectTemptWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TIME_BOMB': async () => { if (typeof cpuSelectTimeBombWithPolicy === 'function') await cpuSelectTimeBombWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; }
    };
}

async function processCpuTurn() {
    const localIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? !!isCardAnimating : false;
    debugCpuTrace('[DEBUG][processCpuTurn] enter', {
        isProcessing,
        isCardAnimating: localIsCardAnimating,
        gameStateCurrentPlayer: gameState && gameState.currentPlayer
    });
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        debugCpuTrace('[DEBUG][processCpuTurn] skip: game over');
        return;
    }
    const current = gameState && gameState.currentPlayer;
    const isWhiteTurn = current === CONST_WHITE || current === 'white';
    if (!gameState || !isWhiteTurn) {
        debugCpuTrace('[DEBUG][processCpuTurn] skip: not white turn');
        return;
    }
    if (isProcessing || isUiAnimationBusy()) {
        scheduleRunCpuTurn('white', { autoMode: false }, getAnimationRetryDelayMs());
        debugCpuTrace('[DEBUG][processCpuTurn] defer: busy');
        return;
    }
    runCpuTurn('white', { autoMode: false });
    debugCpuTrace('[DEBUG][processCpuTurn] exit');
}

async function processAutoBlackTurn() {
    // Re-enabled for Auto mode: invoke black run with autoMode flag
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return;
    }
    if (isProcessing || isUiAnimationBusy()) return;
    if (gameState.currentPlayer !== CONST_BLACK) return;
    return runCpuTurn('black', { autoMode: true });
}

async function runCpuTurn(playerKey, { autoMode = false } = {}) {
    const isWhite = playerKey === 'white';
    const selfColor = isWhite ? CONST_WHITE : CONST_BLACK;
    const selfName = isWhite ? '白' : '黒';
    const currentPlayer = gameState ? gameState.currentPlayer : null;
    const currentPlayerKey = (currentPlayer === CONST_BLACK || currentPlayer === 'black')
        ? 'black'
        : ((currentPlayer === CONST_WHITE || currentPlayer === 'white') ? 'white' : null);

    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return;
    }
    if (currentPlayerKey && currentPlayerKey !== playerKey) {
        debugCpuTrace('[AI] runCpuTurn aborted: out-of-turn invocation', {
            playerKey,
            currentPlayer,
            autoMode
        });
        isProcessing = false;
        return;
    }

    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[AI] Starting CPU turn for ${playerKey}`, 'info', {
            playerKey,
            isWhite,
            autoMode,
            hasUsedCard: cardState.hasUsedCardThisTurnByPlayer[playerKey],
            pendingEffect: !!cardState.pendingEffectByPlayer[playerKey]
        });
    }

    isProcessing = true;

    if (isUiAnimationBusy()) {
        isProcessing = false;
        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
        return;
    }

    try {
        const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
            ? cpuSmartness[playerKey]
            : 1;
        if (!cardState.hasUsedCardThisTurnByPlayer[playerKey] && cardState.pendingEffectByPlayer[playerKey] === null) {
            let applied = await maybeUseCardFromOnnx(playerKey, level, 0);
            if (!applied) {
                applied = (typeof cpuMaybeUseCardWithPolicy === 'function') ? cpuMaybeUseCardWithPolicy(playerKey) : false;
            }
            if (applied) {
                isProcessing = false;
                const resumeAfterCardAnimation = () => {
                    if (isUiAnimationBusy()) {
                        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                        return;
                    }
                    runCpuTurn(playerKey, { autoMode });
                };
                scheduleRetry(resumeAfterCardAnimation, getAnimationRetryDelayMs());
                return;
            }
        }

        let pending = cardState.pendingEffectByPlayer[playerKey];

        // Use pending handler factory for clarity and testability
        if (pending && pending.stage === 'selectTarget') {
            const handler = getPendingTypeHandlers(playerKey)[pending.type];
            if (handler) {
                if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
                    debugLog(`[AI] CPU selecting ${pending.type.replace(/_/g, ' ').toLowerCase()} target`, 'debug', { playerKey, pendingEffect: pending });
                }
                await handler();
                pending = cardState.pendingEffectByPlayer[playerKey];
                if (isUiAnimationBusy()) {
                    isProcessing = false;
                    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                    return;
                }
                // Multi-step selection cards (e.g. SACRIFICE_WILL) may keep pending selectTarget
                // after one application. Do not proceed to normal move generation/pass until
                // selection flow is finished.
                if (pending && pending.stage === 'selectTarget') {
                    if (shouldAbortStuckPendingSelection(playerKey, pending)) {
                        // Safety valve: avoid infinite retry loops when a selector cannot progress.
                        if (cardState && cardState.pendingEffectByPlayer) {
                            cardState.pendingEffectByPlayer[playerKey] = null;
                        }
                        resetPendingSelectRetryState(playerKey);
                        isProcessing = false;
                        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                        return;
                    }
                    isProcessing = false;
                    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                    return;
                }
            }
        }

        resetPendingSelectRetryState(playerKey);

        const protection = getActiveProtectionSafe(selfColor);
        const perma = getFlipBlockersSafe();
        const candidateMoves = generateMovesForPlayer(selfColor, pending, protection, perma);

        if (!candidateMoves.length) {
            const stillUsableCard = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.hasUsableCard === 'function')
                ? !!CardLogic.hasUsableCard(cardState, gameState, playerKey)
                : false;
            if (stillUsableCard) {
                let retried = await maybeUseCardFromOnnx(playerKey, level, 0);
                if (!retried) {
                    retried = (typeof cpuMaybeUseCardWithPolicy === 'function') ? cpuMaybeUseCardWithPolicy(playerKey) : false;
                }
                if (retried) {
                    isProcessing = false;
                    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                    return;
                }
                // Avoid illegal-pass spam: keep turn and retry later.
                isProcessing = false;
                scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                return;
            }
            const passFn = resolveProcessPassTurn();
            if (passFn) {
                passFn(playerKey, autoMode);
            } else {
                console.error('[AI] processPassTurn is not available');
                isProcessing = false;
            }
            resetPendingSelectRetryState(playerKey);
            return;
        }

        let move = null;
        if (typeof selectMoveFromOnnxPolicyAsync === 'function') {
            try {
                move = await selectMoveFromOnnxPolicyAsync(candidateMoves, playerKey, level);
            } catch (e) {
                debugCpuTrace('[AI] selectMoveFromOnnxPolicyAsync failed; fallback to policy table/core', {
                    playerKey,
                    error: e && e.message ? e.message : String(e)
                });
            }
        }
        if (!move) {
            move = selectCpuMoveSafe(candidateMoves, playerKey);
        }
        if (!move) {
            const passFn = resolveProcessPassTurn();
            if (passFn) {
                passFn(playerKey, autoMode);
            } else {
                isProcessing = false;
            }
            return;
        }
        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
            debugLog(`[AI] Move selected`, 'info', {
                playerKey,
                selectedMove: { row: move.row, col: move.col },
                candidateCount: candidateMoves.length,
                flips: move.flips ? move.flips.length : 0
            });
        }

        playHandAnimation(selfColor, move.row, move.col, () => {
            executeMove(move);
        });
        resetPendingSelectRetryState(playerKey);
    } catch (error) {
        console.error(`[AI] Error in runCpuTurn for ${playerKey}:`, error);
        console.error(`[AI] Error message: ${error.message}`);
        console.error(`[AI] Error stack: ${error.stack}`);
        if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
            debugLog(`[AI] CPU Error for ${playerKey}: ${error.message}`, 'error', {
                errorStack: error.stack,
                playerKey
            });
        }
        isProcessing = false;
        // If it's a critical logic error, we might want to skip the turn or alert the user
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${selfName}の思考中にエラーが発生しました`);
        }
        resetPendingSelectRetryState(playerKey);
    }
}

// Expose for browser globals and module systems (single source of truth)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { processCpuTurn, processAutoBlackTurn, setTimers, getTimers, scheduleRetry, getPendingTypeHandlers, runCpuTurn };
}

// Prefer registering these functions with UIBootstrap so UI can access them via a canonical API
try {
    const uiBootstrap = require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
        uiBootstrap.registerUIGlobals({ processCpuTurn, processAutoBlackTurn });
    }
} catch (e) { /* ignore in headless contexts */ }
// Browser fallback: if UI is loaded via globals, register into globalThis.UIBootstrap
try {
    if (typeof globalThis !== 'undefined' && globalThis.UIBootstrap && typeof globalThis.UIBootstrap.registerUIGlobals === 'function') {
        globalThis.UIBootstrap.registerUIGlobals({ processCpuTurn, processAutoBlackTurn });
    } else if (typeof globalThis !== 'undefined') {
        // Wait for bootstrap to become available (IDed by globalThis.UIBootstrap) and register when ready.
        // Avoid polling during tests (Jest) to prevent keeping the event loop open.
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            // Skip polling in test environment
        } else {
            let tries = 0;
            const maxTries = 50; // ~5 seconds @ 100ms
            const tid = setInterval(() => {
                tries += 1;
                try {
                    if (globalThis.UIBootstrap && typeof globalThis.UIBootstrap.registerUIGlobals === 'function') {
                        globalThis.UIBootstrap.registerUIGlobals({ processCpuTurn, processAutoBlackTurn });
                        clearInterval(tid);
                        return;
                    }
                } catch (e) { /* ignore during polling */ }
                if (tries >= maxTries) clearInterval(tid);
            }, 100);
        }
    }
} catch (e) { /* ignore */ }

// Also expose to globalThis for immediate fallback in browser contexts
try {
    if (typeof globalThis !== 'undefined') {
        try { globalThis.processCpuTurn = processCpuTurn; } catch (e) {}
        try { globalThis.processAutoBlackTurn = processAutoBlackTurn; } catch (e) {}
    }
} catch (e) { /* ignore */ }
})();
