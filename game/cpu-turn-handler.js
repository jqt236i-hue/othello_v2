// CPU turn orchestration extracted from turn-manager

// Timers abstraction (injected by UI)
(function () {
let timers = null;
if (typeof require === 'function') {
    try { timers = require('./timers'); } catch (e) { /* ignore */ }
}

// Local safe constants to avoid ReferenceError for undeclared globals in test environments
const CONST_BLACK = (typeof BLACK !== 'undefined') ? BLACK : ((typeof global !== 'undefined' && typeof global.BLACK !== 'undefined') ? global.BLACK : 1);
const CONST_WHITE = (typeof WHITE !== 'undefined') ? WHITE : ((typeof global !== 'undefined' && typeof global.WHITE !== 'undefined') ? global.WHITE : -1);

// Allow injection of timers for tests and for alternate scheduler implementations
function setTimers(t) {
    timers = t;
}
function getTimers() { return timers; }

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
        'INHERIT_WILL': async () => { await cpuSelectInheritWillWithPolicy(playerKey); },
        'SWAP_WITH_ENEMY': async () => { if (typeof cpuSelectSwapWithEnemyWithPolicy === 'function') await cpuSelectSwapWithEnemyWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TEMPT_WILL': async () => { if (typeof cpuSelectTemptWillWithPolicy === 'function') await cpuSelectTemptWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; }
    };
}

async function processCpuTurn() {
    console.log('[DEBUG][processCpuTurn] enter', { isProcessing, isCardAnimating, gameStateCurrentPlayer: gameState && gameState.currentPlayer });
    runCpuTurn('white');
    console.log('[DEBUG][processCpuTurn] exit');
}

async function processAutoBlackTurn() {
    // Re-enabled for Auto mode: invoke black run with autoMode flag
    if (isProcessing || isCardAnimating) return;
    if (gameState.currentPlayer !== BLACK) return;
    return runCpuTurn('black', { autoMode: true });
}

async function runCpuTurn(playerKey, { autoMode = false } = {}) {
    const isWhite = playerKey === 'white';
    const selfColor = isWhite ? CONST_WHITE : CONST_BLACK;
    const selfName = isWhite ? '白' : '黒';

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

    if (isCardAnimating) {
        scheduleRetry(() => runCpuTurn(playerKey, { autoMode }), ANIMATION_RETRY_DELAY_MS);
        return;
    }

    try {
        if (!cardState.hasUsedCardThisTurnByPlayer[playerKey] && cardState.pendingEffectByPlayer[playerKey] === null) {
            const applied = (typeof cpuMaybeUseCardWithPolicy === 'function') ? cpuMaybeUseCardWithPolicy(playerKey) : false;
            if (applied) {
                if (isCardAnimating) {
                    isProcessing = false; // Reset before retry
                    scheduleRetry(() => runCpuTurn(playerKey, { autoMode }), ANIMATION_RETRY_DELAY_MS);
                    return;
                }
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
            }
        }

        const protection = getActiveProtectionForPlayer(selfColor); // Fixed to use selfColor
        const perma = (typeof getFlipBlockers === 'function') ? getFlipBlockers() : [];
        const candidateMoves = generateMovesForPlayer(selfColor, pending, protection, perma);

        if (!candidateMoves.length) {
            processPassTurn(playerKey, autoMode);
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
            if (isCardAnimating) {
                scheduleRetry(() => executeMove(move), ANIMATION_SETTLE_DELAY_MS);
            } else {
                executeMove(move);
            }
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
