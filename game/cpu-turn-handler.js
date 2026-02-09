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
function scheduleRunCpuTurn(playerKey, options, delayMs) {
    const key = playerKey === 'white' ? 'white' : 'black';
    if (_cpuRetryPendingByPlayer[key]) return;
    _cpuRetryPendingByPlayer[key] = true;
    scheduleRetry(() => {
        _cpuRetryPendingByPlayer[key] = false;
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
// Build scheduleRetry as a small wrapper that prefers the injected `timers` (set via setTimers),
// then falls back to a shared helper in `game/timer-utils`, and finally to setTimeout.
let _sharedScheduleRetry = null;
try { const tu = require('./timer-utils'); if (tu && typeof tu.scheduleRetry === 'function') _sharedScheduleRetry = tu.scheduleRetry; } catch (e) { /* ignore */ }
function scheduleRetry(fn, delayMs = (typeof ANIMATION_RETRY_DELAY_MS !== 'undefined' ? ANIMATION_RETRY_DELAY_MS : 200)) {
    // 1) Prefer module-scoped injected timers when present (useful for tests)
    if (timers && typeof timers.waitMs === 'function') {
        try {
            timers.waitMs(delayMs).then(() => { try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); } });
            return;
        } catch (e) { /* fall through */ }
    }

    // 2) Use shared helper if available
    if (_sharedScheduleRetry) {
        try { _sharedScheduleRetry(fn, delayMs, timers); return; } catch (e) { /* fall through */ }
    }

    // 3) Fallback to setTimeout
    setTimeout(() => { try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); } }, delayMs);
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
        'INHERIT_WILL': async () => { await cpuSelectInheritWillWithPolicy(playerKey); },
        'SWAP_WITH_ENEMY': async () => { if (typeof cpuSelectSwapWithEnemyWithPolicy === 'function') await cpuSelectSwapWithEnemyWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TEMPT_WILL': async () => { if (typeof cpuSelectTemptWillWithPolicy === 'function') await cpuSelectTemptWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; }
    };
}

async function processCpuTurn() {
    console.log('[DEBUG][processCpuTurn] enter', { isProcessing, isCardAnimating, gameStateCurrentPlayer: gameState && gameState.currentPlayer });
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        console.log('[DEBUG][processCpuTurn] skip: game over');
        return;
    }
    const current = gameState && gameState.currentPlayer;
    const isWhiteTurn = current === CONST_WHITE || current === 'white';
    if (!gameState || !isWhiteTurn) {
        console.log('[DEBUG][processCpuTurn] skip: not white turn');
        return;
    }
    if (isProcessing || isUiAnimationBusy()) {
        scheduleRunCpuTurn('white', { autoMode: false }, ANIMATION_RETRY_DELAY_MS);
        console.log('[DEBUG][processCpuTurn] defer: busy');
        return;
    }
    runCpuTurn('white', { autoMode: false });
    console.log('[DEBUG][processCpuTurn] exit');
}

async function processAutoBlackTurn() {
    // Re-enabled for Auto mode: invoke black run with autoMode flag
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        isProcessing = false;
        return;
    }
    if (isProcessing || isCardAnimating) return;
    if (isUiAnimationBusy()) return;
    if (gameState.currentPlayer !== BLACK) return;
    return runCpuTurn('black', { autoMode: true });
}

async function runCpuTurn(playerKey, { autoMode = false } = {}) {
    const isWhite = playerKey === 'white';
    const selfColor = isWhite ? CONST_WHITE : CONST_BLACK;
    const selfName = isWhite ? '白' : '黒';

    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
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
        scheduleRunCpuTurn(playerKey, { autoMode }, ANIMATION_RETRY_DELAY_MS);
        return;
    }

    try {
        if (!cardState.hasUsedCardThisTurnByPlayer[playerKey] && cardState.pendingEffectByPlayer[playerKey] === null) {
            const applied = (typeof cpuMaybeUseCardWithPolicy === 'function') ? cpuMaybeUseCardWithPolicy(playerKey) : false;
            if (applied) {
                isProcessing = false;
                const resumeAfterCardAnimation = () => {
                    if (isUiAnimationBusy()) {
                        scheduleRunCpuTurn(playerKey, { autoMode }, ANIMATION_RETRY_DELAY_MS);
                        return;
                    }
                    runCpuTurn(playerKey, { autoMode });
                };
                scheduleRetry(resumeAfterCardAnimation, ANIMATION_RETRY_DELAY_MS);
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
                    scheduleRunCpuTurn(playerKey, { autoMode }, ANIMATION_RETRY_DELAY_MS);
                    return;
                }
                // Multi-step selection cards (e.g. SACRIFICE_WILL) may keep pending selectTarget
                // after one application. Do not proceed to normal move generation/pass until
                // selection flow is finished.
                if (pending && pending.stage === 'selectTarget') {
                    isProcessing = false;
                    scheduleRunCpuTurn(playerKey, { autoMode }, ANIMATION_RETRY_DELAY_MS);
                    return;
                }
            }
        }

        const protection = getActiveProtectionForPlayer(selfColor); // Fixed to use selfColor
        const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
        const candidateMoves = generateMovesForPlayer(selfColor, pending, protection, perma);

        if (!candidateMoves.length) {
            const stillUsableCard = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.hasUsableCard === 'function')
                ? !!CardLogic.hasUsableCard(cardState, gameState, playerKey)
                : false;
            if (stillUsableCard) {
                const retried = (typeof cpuMaybeUseCardWithPolicy === 'function') ? cpuMaybeUseCardWithPolicy(playerKey) : false;
                if (retried) {
                    isProcessing = false;
                    scheduleRunCpuTurn(playerKey, { autoMode }, ANIMATION_RETRY_DELAY_MS);
                    return;
                }
                // Avoid illegal-pass spam: keep turn and retry later.
                isProcessing = false;
                scheduleRunCpuTurn(playerKey, { autoMode }, ANIMATION_RETRY_DELAY_MS);
                return;
            }
            const passFn = resolveProcessPassTurn();
            if (passFn) {
                passFn(playerKey, autoMode);
            } else {
                console.error('[AI] processPassTurn is not available');
                isProcessing = false;
            }
            return;
        }

        const move = selectCpuMoveWithPolicy(candidateMoves, playerKey);
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
