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
const CPU_TURN_DELAY_MS = 600;
const ANIMATION_RETRY_DELAY_MS = 80;
const ANIMATION_SETTLE_DELAY_MS = 100;
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
if (typeof isProcessing === 'undefined') { try { globalThis.isProcessing = false; } catch (e) { this.isProcessing = false; } }
if (typeof isCardAnimating === 'undefined') { try { globalThis.isCardAnimating = false; } catch (e) { this.isCardAnimating = false; } }

// Timers abstraction (injected by UI if desired)
if (typeof timers === 'undefined') { try { globalThis.timers = globalThis.timers || null; } catch (e) { this.timers = this.timers || null; } }
if (typeof require === 'function') {
    try { globalThis.timers = require('./timers'); } catch (e) { /* ignore */ }
}

// Prefer shared scheduling helper when available; fallback to a minimal impl using global timers or setTimeout
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
        setTimeout(fn, delayMs);
    };
}


function handleCellClick(row, col) {
    // Initialize Audio Context on FIRST interaction (defensive: SoundEngine may not be loaded in some builds)
    try {
        if (typeof SoundEngine !== 'undefined' && typeof SoundEngine.init === 'function') {
            SoundEngine.init();
        }
    } catch (e) {
        console.warn('[SoundEngine] init failed or SoundEngine not available', e && e.message ? e.message : e);
    }

    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[CELL-CLICK] User clicked (${row},${col})`, 'debug', {
            currentPlayer: gameState.currentPlayer,
            isAnimationInProgress: isAnimationInProgress()
        });
    }



    // Block while animations are running
    if (isAnimationInProgress()) return;

    const playerKey = getPlayerKey(gameState.currentPlayer);
    const pending = cardState.pendingEffectByPlayer[playerKey];

    // Selection-mode (destroy) has priority
    if (pending && pending.type === 'DESTROY_ONE_STONE' && pending.stage === 'selectTarget') {
        handleDestroySelection(row, col, playerKey);
        return;
    }
    if (pending && pending.type === 'INHERIT_WILL' && pending.stage === 'selectTarget') {
        if (typeof handleInheritSelection === 'function') {
            handleInheritSelection(row, col, playerKey);
        }
        return;
    }
    if (pending && pending.type === 'TEMPT_WILL' && pending.stage === 'selectTarget') {
        if (typeof handleTemptSelection === 'function') {
            handleTemptSelection(row, col, playerKey);
        }
        return;
    }
    if (pending && pending.type === 'SWAP_WITH_ENEMY' && pending.stage === 'selectTarget') {
        if (typeof handleSwapSelection === 'function') {
            handleSwapSelection(row, col, playerKey);
        }
        return;
    }

    // Human move: BLACK always, or WHITE if DEBUG_HUMAN_VS_HUMAN is enabled
    const isHumanTurn = (gameState.currentPlayer === BLACK) || ((__uiImpl_turn_manager && __uiImpl_turn_manager.DEBUG_HUMAN_VS_HUMAN) && gameState.currentPlayer === WHITE);
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

    // Notify UI that a hand animation will be played (UI should play animation based on this event)
    try { emitPresentationEventViaBoardOps({ type: 'PLAY_HAND_ANIMATION', player: playerKey, row, col }); } catch (e) { /* do not block move on presentation failures */ }

    playHandAnimation(gameState.currentPlayer, row, col, () => {
        if (isCardAnimating) {
            scheduleRetry(() => executeMove(move), ANIMATION_SETTLE_DELAY_MS);
        } else {
            executeMove(move);
        }
    });
}

function isAnimationInProgress() {
    const proc = (typeof __uiImpl !== 'undefined' && typeof __uiImpl.isProcessing !== 'undefined') ? __uiImpl.isProcessing : (typeof isProcessing !== 'undefined' ? isProcessing : false);
    const card = (typeof __uiImpl !== 'undefined' && typeof __uiImpl.isCardAnimating !== 'undefined') ? __uiImpl.isCardAnimating : (typeof isCardAnimating !== 'undefined' ? isCardAnimating : false);
    return proc || card;
}

function getPlayerKey(player) {
    return player === BLACK ? 'black' : 'white';
}

function getPlayerName(player) {
    return player === BLACK ? '黒' : '白';
}

// Request a UI render via event (no direct UI calls)
function requestUIRender() {
    if (typeof emitBoardUpdate === 'function') {
        try { emitBoardUpdate(); } catch (e) { /* ignore UI errors */ }
    }
}

function resetGame() {
    // Auto mode removed: nothing to stop or reset


    // Read CPU smartness from UI helper if available (avoid direct DOM access in game/)
    if (__uiImpl_turn_manager && typeof __uiImpl_turn_manager.readCpuSmartness === 'function') {
        const vals = __uiImpl_turn_manager.readCpuSmartness();
        cpuSmartness.black = Number(vals && vals.black) || cpuSmartness.black || 1;
        cpuSmartness.white = Number(vals && vals.white) || cpuSmartness.white || 1;
    }

    console.log(`[resetGame] CPU Levels - Black: ${cpuSmartness.black}, White: ${cpuSmartness.white}`);

    if (typeof updateCpuCharacter === 'function') {
        updateCpuCharacter();
    }

    gameState = createGameState();

    try {
        // initCardState may rely on PRNG; if unavailable, tests should mock or skip
        if (typeof initCardState === 'function') initCardState();
    } catch (e) {
        // In test environments without PRNG, allow fallback to a minimal cardState via CardLogic
        console.warn('[resetGame] initCardState failed (test environment):', e.message);
        if (typeof CardLogic !== 'undefined' && typeof CardLogic.createCardState === 'function') {
            const prngStub = { next: () => 0.5, _seed: 1 };
            const newState = CardLogic.createCardState(prngStub);
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

    if (typeof emitLogAdded === 'function') {
        emitLogAdded(`ゲーム開始 (黒: Lv${cpuSmartness.black}, 白: Lv${cpuSmartness.white})`);
    }
    emitBoardUpdate();
    emitGameStateChange();

    // Lock input during initial dealing animation
    isProcessing = true;
    isCardAnimating = true;

    if (typeof dealInitialCards === 'function') {
        dealInitialCards()
            .then(() => {
                isProcessing = false;
                onTurnStart(BLACK);
                if (typeof emitLogAdded === 'function') emitLogAdded('カード配布完了');

            })
            .catch((err) => {
                console.error('Deal animation error:', err);
                if (typeof emitLogAdded === 'function') emitLogAdded('エラー: カード配布に失敗しました');
            })
            .finally(() => {
                isCardAnimating = false;
                isProcessing = false;
            });
    } else {
        // No animation path (Phase2 safe-guard): continue immediately
        isCardAnimating = false; isProcessing = false;
        try {
            if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.onTurnStart === 'function') {
                __uiImpl.onTurnStart(BLACK);
            } else {
                onTurnStart(BLACK);
            }
        } catch (e) { console.error('onTurnStart error (noanim fallback):', e); }
        if (typeof emitLogAdded === 'function') emitLogAdded('カード配布完了 (no animation)');
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
            if (TurnPipelineUIAdapter && typeof TurnPipelineUIAdapter.mapToPlaybackEvents === 'function'
                && typeof CardLogic !== 'undefined' && typeof CardLogic.flushPresentationEvents === 'function') {
                const pres = CardLogic.flushPresentationEvents(cardState) || [];
                if (pres.length > 0) {
                    turnStartPlaybackEvents = TurnPipelineUIAdapter.mapToPlaybackEvents(pres, cardState, gameState) || [];
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
    if (typeof emitLogAdded === 'function') emitLogAdded(`== ${getPlayerName(player)}のターン (${turnCount}手目) ==`);

    // 3. Draw Animation (if draw happened during the turn-start phase)
    if (handSizeAfter > handSizeBefore) {
        // A card was drawn - animate it
        console.log(`[DRAW] Card drawn for ${playerKey}! handBefore=${handSizeBefore}, handAfter=${handSizeAfter}`);
        isCardAnimating = true;
        try {
            const drawnCardId = cardState.hands[playerKey][cardState.hands[playerKey].length - 1];
            if (drawnCardId !== null && drawnCardId !== undefined) {
                if (typeof emitLogAdded === 'function') emitLogAdded(`${getPlayerName(player)}がドローしました`);
                // Emit DRAW_CARD presentation event via BoardOps (type, player, cardId)
                try { emitPresentationEventViaBoardOps({ type: 'DRAW_CARD', player: playerKey, cardId: drawnCardId }); } catch (e) { /* do not break turn if presentation hook fails */ }
                if (typeof updateDeckVisual === 'function') updateDeckVisual();
                const isHidden = (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.isDocumentHidden === 'function') ?
                    __uiImpl.isDocumentHidden() : (typeof __uiImpl !== 'undefined' && __uiImpl && __uiImpl.__BACKGROUND_MODE__ === true);

                if (!isHidden) {
                    if (typeof playDrawAnimation === 'function') {
                        await playDrawAnimation(player, drawnCardId);
                    }

                    // Deck pulse: delegate to UI for visual feedback
                    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.pulseDeckUI === 'function') {
                        __uiImpl.pulseDeckUI();
                    }
                }
            }
        } catch (err) {
            console.error('Draw animation error:', err);
        } finally {
            isCardAnimating = false;
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

    // 7. DEBUG: Shared Hand Logic (opt-in only)
    if (typeof __uiImpl !== 'undefined' && __uiImpl && __uiImpl.DEBUG_SHARED_HAND) {
        if (cardState.hands.white.length > 0) {
            console.log('[DEBUG] Transferring White cards to Black for Shared Hand mode', cardState.hands.white);
            cardState.hands.black.push(...cardState.hands.white);
            cardState.hands.white = [];
            // Update UI again to reflect transfer
            if (typeof renderCardUI === 'function') renderCardUI();
        }
    }
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
                isProcessing,
                isCardAnimating
            });
            isProcessing = false;
            isCardAnimating = false;
            lastFlagActiveTime = null;
            if (typeof emitLogAdded === 'function') emitLogAdded('警告: 処理が長時間停滞したため強制解除しました');
            emitBoardUpdate();
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
