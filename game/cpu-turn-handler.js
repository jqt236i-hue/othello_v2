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
let cpuCommentaryRuntime = null;
if (typeof require === 'function') {
    try { cpuCommentaryRuntime = require('./ai/cpu-commentary-runtime'); } catch (e) { /* ignore */ }
}
let commentaryContextHelpers = null;
if (typeof require === 'function') {
    try { commentaryContextHelpers = require('../shared/commentary-context-helpers'); } catch (e) { /* ignore */ }
}
let commentaryRuntimeHelpers = null;
if (typeof require === 'function') {
    try { commentaryRuntimeHelpers = require('../shared/commentary-runtime-helpers'); } catch (e) { /* ignore */ }
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

function isHumanVsHumanModeEnabled() {
    const debugHvH = (typeof globalThis !== 'undefined' && globalThis.DEBUG_HUMAN_VS_HUMAN === true);
    let matchMode = null;
    try {
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return debugHvH || matchMode === 'network';
}

function shouldAbortCpuForHumanMode(playerKey, context) {
    if (!isHumanVsHumanModeEnabled()) return false;
    resetPendingSelectRetryState(playerKey);
    isProcessing = false;
    debugCpuTrace('[AI] abort CPU run in human-controlled mode', {
        playerKey,
        context: context || 'unknown'
    });
    return true;
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

function isCpuFastBenchModeEnabled() {
    try {
        return typeof globalThis !== 'undefined' && globalThis.__BENCH_FAST_MODE === true;
    } catch (e) { /* ignore */ }
    return false;
}

function resolveCpuLv6SharedProfile() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CPU_LV6_SHARED_PROFILE && typeof globalThis.CPU_LV6_SHARED_PROFILE === 'object') {
            return globalThis.CPU_LV6_SHARED_PROFILE;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof require === 'function') {
            const shared = require('../constants/cpu-lv6-shared-profile.js');
            if (shared && typeof shared === 'object') return shared;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function shouldUseOnnxCardDecision(level) {
    if (!Number.isFinite(level) || level < 6) return true;
    let shared = null;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CPU_LV6_SHARED_PROFILE && typeof globalThis.CPU_LV6_SHARED_PROFILE === 'object') {
            shared = globalThis.CPU_LV6_SHARED_PROFILE;
        }
    } catch (e) { /* ignore */ }
    const mode = String(shared && shared.browser && shared.browser.cardDecisionMode || '').trim().toLowerCase();
    return mode !== 'policy-table-core';
}

function shouldUseOnnxMoveDecision(level) {
    if (!Number.isFinite(level) || level < 6) return true;
    const shared = resolveCpuLv6SharedProfile();
    const mode = String(shared && shared.browser && shared.browser.moveDecisionMode || '').trim().toLowerCase();
    return mode !== 'policy-table-lookahead' && mode !== 'browser-policy-lookahead' && mode !== 'policy-table-core';
}

function resolveLv6MinThinkMs(playerKey, level, autoMode) {
    if (autoMode) return 0;
    if (!Number.isFinite(level) || level < 6) return 0;
    if (playerKey !== 'white') return 0;
    if (isCpuFastBenchModeEnabled()) return 0;
    try {
        const shared = resolveCpuLv6SharedProfile();
        const configured = Number(shared && shared.browser && shared.browser.minThinkMsWhite);
        if (Number.isFinite(configured) && configured >= 0) {
            return Math.floor(configured);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && Number.isFinite(globalThis.CPU_LV6_MIN_THINK_MS)) {
            return Math.max(0, Math.floor(Number(globalThis.CPU_LV6_MIN_THINK_MS)));
        }
    } catch (e) { /* ignore */ }
    return 250;
}

function resolveCpuCommentaryRuntime() {
    const runtimeHelpers = resolveCommentaryRuntimeHelpers();
    if (runtimeHelpers && typeof runtimeHelpers.hasCommentaryRuntime === 'function' && runtimeHelpers.hasCommentaryRuntime(cpuCommentaryRuntime)) {
        return cpuCommentaryRuntime;
    }
    if (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryRuntimeByRequire === 'function' && typeof require === 'function') {
        const requiredRuntime = runtimeHelpers.resolveCommentaryRuntimeByRequire(['./ai/cpu-commentary-runtime'], require);
        if (requiredRuntime) {
            cpuCommentaryRuntime = requiredRuntime;
            return cpuCommentaryRuntime;
        }
    }
    if (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryRuntimeFromGlobal === 'function') {
        const globalRuntime = runtimeHelpers.resolveCommentaryRuntimeFromGlobal(typeof globalThis !== 'undefined' ? globalThis : null);
        if (globalRuntime) {
            cpuCommentaryRuntime = globalRuntime;
            return cpuCommentaryRuntime;
        }
    }
    if (cpuCommentaryRuntime && typeof cpuCommentaryRuntime.requestCommentary === 'function') {
        return cpuCommentaryRuntime;
    }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CpuCommentaryRuntime && typeof globalThis.CpuCommentaryRuntime.requestCommentary === 'function') {
            cpuCommentaryRuntime = globalThis.CpuCommentaryRuntime;
            return cpuCommentaryRuntime;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCommentaryContextHelpers() {
    if (commentaryContextHelpers) return commentaryContextHelpers;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CommentaryContextHelpers) {
            commentaryContextHelpers = globalThis.CommentaryContextHelpers;
            return commentaryContextHelpers;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCommentaryRuntimeHelpers() {
    if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;
    try {
        if (typeof globalThis !== 'undefined' && globalThis.CommentaryRuntimeHelpers) {
            commentaryRuntimeHelpers = globalThis.CommentaryRuntimeHelpers;
            return commentaryRuntimeHelpers;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function countDiscsSafe(state) {
    try {
        if (typeof countDiscs === 'function') {
            const counted = countDiscs(state);
            if (counted && Number.isFinite(counted.black) && Number.isFinite(counted.white)) {
                return { black: counted.black, white: counted.white };
            }
        }
    } catch (e) { /* ignore */ }

    const board = state && Array.isArray(state.board) ? state.board : [];
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.countDiscsFromBoard === 'function') {
        return helpers.countDiscsFromBoard(board, {
            blackValues: [CONST_BLACK, 1, '1', 'black'],
            whiteValues: [CONST_WHITE, -1, '-1', 'white']
        });
    }
    return { black: 0, white: 0 };
}

function countOwnedBasicCornersSafe(stateOrBoard, playerKey) {
    const board = Array.isArray(stateOrBoard)
        ? stateOrBoard
        : (stateOrBoard && Array.isArray(stateOrBoard.board) ? stateOrBoard.board : null);
    if (!Array.isArray(board) || board.length < 8) return 0;

    const ownValue = playerKey === 'black' ? CONST_BLACK : CONST_WHITE;
    const cornerPoints = [[0, 0], [0, 7], [7, 0], [7, 7]];
    let owned = 0;
    for (const point of cornerPoints) {
        const row = board[point[0]];
        if (!Array.isArray(row)) continue;
        if (row[point[1]] === ownValue) owned += 1;
    }
    return owned;
}

function resolvePhaseByTurn(turnNumber, occupiedCells) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolvePhaseByTurn === 'function') {
        return helpers.resolvePhaseByTurn(turnNumber, occupiedCells);
    }
    return 'middle';
}

function resolveAdvantageLabel(playerKey, counts) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.resolveAdvantageLabel === 'function') {
        return helpers.resolveAdvantageLabel(playerKey, counts);
    }
    return 'even';
}

function getLastUsedCardIdSafe(playerKey) {
    try {
        if (cardState && cardState.lastUsedCardByPlayer) {
            return cardState.lastUsedCardByPlayer[playerKey] || null;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function getHandSizeSafe(playerKey) {
    try {
        if (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])) {
            return cardState.hands[playerKey].length;
        }
    } catch (e) { /* ignore */ }
    return 0;
}

function getChargeSafe(playerKey) {
    try {
        if (cardState && cardState.charge && Number.isFinite(cardState.charge[playerKey])) {
            return Number(cardState.charge[playerKey]);
        }
    } catch (e) { /* ignore */ }
    return 0;
}

function getDiscDiffSafe(playerKey) {
    const counts = countDiscsSafe(gameState);
    const black = Number.isFinite(counts && counts.black) ? counts.black : 0;
    const white = Number.isFinite(counts && counts.white) ? counts.white : 0;
    return playerKey === 'black' ? (black - white) : (white - black);
}

function shouldOverrideOnnxHoldDecision(playerKey, level, legalMovesCount) {
    const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
    const safeLegalMoves = Number.isFinite(legalMovesCount) ? Math.max(0, Math.floor(legalMovesCount)) : 0;
    const handSize = getHandSizeSafe(playerKey);
    const ownCharge = getChargeSafe(playerKey);
    const discDiff = getDiscDiffSafe(playerKey);
    const turnNumber = getCurrentTurnNumberSafe();
    const lateGame = Number.isFinite(turnNumber) ? turnNumber >= 44 : false;

    // Lv6 は ONNX の温存判断を優先し、上書きは「強い緊急条件」に限定する。
    if (safeLevel >= 6) {
        const handNearCap = handSize >= 4;
        const handAtCap = handSize >= 5;
        const handLoaded = handSize >= 3;
        if (handAtCap && ownCharge >= 18) return true;
        if (handNearCap && ownCharge >= 24) return true;
        if (handLoaded && ownCharge >= 20) return true;
        if (safeLegalMoves <= 0 && handAtCap && ownCharge >= 22) return true;
        if (safeLegalMoves <= 2 && ownCharge >= 10) return true;
        if (safeLegalMoves <= 3 && handLoaded && ownCharge >= 8) return true;
        if (safeLegalMoves <= 1 && discDiff <= -8 && ownCharge >= 14) return true;
        if (handNearCap && discDiff <= 4 && ownCharge >= 12) return true;
        if (!handNearCap && handLoaded && discDiff <= 0 && ownCharge >= 10) return true;
        if (handAtCap && ownCharge >= 26 && discDiff <= 2) return true;
        if (handNearCap && ownCharge >= 34 && discDiff <= -2) return true;
        if (lateGame && handSize >= 3 && ownCharge >= 10) return true;
        if (lateGame && handSize >= 2 && ownCharge >= 6) return true;
        if (lateGame && handNearCap && discDiff <= -6 && ownCharge >= 14) return true;
        return false;
    }

    // Lv1-5 は従来どおり簡易救済を維持。
    if (safeLegalMoves <= 1) return true;
    if (handSize >= 5) return true;
    if (handSize >= 4 && ownCharge >= 32) return true;
    if (discDiff <= -10) return true;
    if (lateGame && handSize >= 3 && ownCharge >= 24 && discDiff <= -4) return true;
    return false;
}

function emitCpuCommentary(eventType, playerKey, extra) {
    const runtime = resolveCpuCommentaryRuntime();
    if (!runtime || typeof runtime.requestCommentary !== 'function') return;
    if (typeof emitLogAdded !== 'function') return;

    const helpers = resolveCommentaryContextHelpers();
    const counts = countDiscsSafe(gameState);
    const turnNumber = gameState && Number.isFinite(gameState.turnNumber) ? gameState.turnNumber : null;
    const fallbackContext = Object.assign({
        eventType: String(eventType || 'turn_start'),
        playerKey: playerKey === 'black' ? 'black' : 'white',
        turnNumber,
        phase: resolvePhaseByTurn(turnNumber, (counts.black || 0) + (counts.white || 0)),
        advantage: resolveAdvantageLabel(playerKey, counts),
        counts,
        occupiedCells: (counts.black || 0) + (counts.white || 0),
        legalMovesCount: Number.isFinite(extra && extra.legalMovesCount) ? extra.legalMovesCount : null,
        cardId: (extra && extra.cardId) ? String(extra.cardId) : null,
        pendingType: (extra && extra.pendingType) ? String(extra.pendingType) : null
    }, extra || {});
    const context = (helpers && typeof helpers.buildCommentaryContext === 'function')
        ? helpers.buildCommentaryContext({
            eventType,
            playerKey,
            turnNumber,
            counts,
            board: gameState && gameState.board,
            cardId: extra && extra.cardId,
            extra: Object.assign({
                legalMovesCount: Number.isFinite(extra && extra.legalMovesCount) ? extra.legalMovesCount : null,
                pendingType: (extra && extra.pendingType) ? String(extra.pendingType) : null
            }, extra || {})
        })
        : fallbackContext;

    runtime.requestCommentary(context).then((text) => {
        const line = String(text || '').trim();
        if (!line) return;
        const runtimeHelpers = resolveCommentaryRuntimeHelpers();
        const prefix = (runtimeHelpers && typeof runtimeHelpers.getCpuSpeakerPrefix === 'function')
            ? runtimeHelpers.getCpuSpeakerPrefix(playerKey)
            : (playerKey === 'black' ? '黒CPU' : '白CPU');
        emitLogAdded(`${prefix}: ${line}`);
    }).catch(() => {
        // Ignore commentary failures to keep turn processing deterministic.
    });
}

async function maybeUseCardFromOnnx(playerKey, level, legalMovesCount, legalMoves) {
    const none = { attempted: false, applied: false, hold: false };
    if (!shouldUseOnnxCardDecision(level)) return none;
    if (typeof selectCardFromOnnxPolicyAsync !== 'function') return none;
    if (typeof applyCardChoice !== 'function') return none;
    if (typeof CardLogic === 'undefined' || !CardLogic || !cardState || !gameState) return none;
    try {
        let usable = [];
        if (typeof CardLogic.getUsableCardIds === 'function') {
            usable = CardLogic.getUsableCardIds(cardState, gameState, playerKey) || [];
        }
        if (!Array.isArray(usable) || usable.length === 0) return none;
        const safeMoves = Array.isArray(legalMoves) ? legalMoves : [];
        const choice = await selectCardFromOnnxPolicyAsync(playerKey, level, legalMovesCount, usable, safeMoves);
        if (choice && choice.hold === true) {
            return { attempted: true, applied: false, hold: true };
        }
        if (!choice || !choice.cardId) return { attempted: true, applied: false, hold: false };
        let decisionContext = null;
        if (typeof buildCardUseDecisionContext === 'function') {
            try {
                decisionContext = buildCardUseDecisionContext(playerKey, level, legalMovesCount, safeMoves, usable);
            } catch (e) { /* ignore */ }
        }
        if (typeof isCardChoiceAllowedByPlan === 'function') {
            try {
                const cornerPlanState = decisionContext && decisionContext.cornerPlanState
                    ? decisionContext.cornerPlanState
                    : null;
                const allowedByPlan = isCardChoiceAllowedByPlan(
                    playerKey,
                    level,
                    legalMovesCount,
                    choice.cardId,
                    choice.cardDef,
                    cornerPlanState,
                    decisionContext
                );
                if (!allowedByPlan) return { attempted: true, applied: false, hold: false };
            } catch (e) { /* ignore */ }
        }
        if (typeof isCardChoiceAllowedByRisk === 'function') {
            const allowed = isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choice.cardId, decisionContext);
            if (!allowed) return { attempted: true, applied: false, hold: false };
        }
        if (typeof isCardChoiceAllowedByHighConfidence === 'function') {
            const confident = isCardChoiceAllowedByHighConfidence(
                playerKey,
                level,
                legalMovesCount,
                choice.cardId,
                decisionContext
            );
            if (!confident) return { attempted: true, applied: false, hold: false };
        }
        return { attempted: true, applied: !!applyCardChoice(playerKey, choice), hold: false };
    } catch (e) {
        debugCpuTrace('[AI] selectCardFromOnnxPolicyAsync failed; fallback to policy table/core', {
            playerKey,
            error: e && e.message ? e.message : String(e)
        });
        return none;
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
        if (shouldAbortCpuForHumanMode(key, 'scheduled_retry')) {
            return;
        }
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
        'SUPER_BUOYANCY_WILL': async () => { if (typeof cpuSelectSuperBuoyancyWillWithPolicy === 'function') await cpuSelectSuperBuoyancyWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SUPER_GRAVITY_WILL': async () => { if (typeof cpuSelectSuperGravityWillWithPolicy === 'function') await cpuSelectSuperGravityWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SACRIFICE_WILL': async () => { if (typeof cpuSelectSacrificeWillWithPolicy === 'function') await cpuSelectSacrificeWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SELL_CARD_WILL': async () => { if (typeof cpuSelectSellCardWillWithPolicy === 'function') await cpuSelectSellCardWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'HEAVEN_BLESSING': async () => { if (typeof cpuSelectHeavenBlessingWithPolicy === 'function') await cpuSelectHeavenBlessingWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'CONDEMN_WILL': async () => { if (typeof cpuSelectCondemnWillWithPolicy === 'function') await cpuSelectCondemnWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SWAP_WITH_ENEMY': async () => { if (typeof cpuSelectSwapWithEnemyWithPolicy === 'function') await cpuSelectSwapWithEnemyWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'POSITION_SWAP_WILL': async () => { if (typeof cpuSelectPositionSwapWillWithPolicy === 'function') await cpuSelectPositionSwapWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TRAP_WILL': async () => { if (typeof cpuSelectTrapWillWithPolicy === 'function') await cpuSelectTrapWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'GUARD_WILL': async () => { if (typeof cpuSelectGuardWillWithPolicy === 'function') await cpuSelectGuardWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'GUARDIAN_GOD': async () => { if (typeof cpuSelectGuardWillWithPolicy === 'function') await cpuSelectGuardWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'HYPERACTIVE_INHERIT_WILL': async () => { if (typeof cpuSelectHyperactiveInheritWillWithPolicy === 'function') await cpuSelectHyperactiveInheritWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'EXTEND_LIFE_WILL': async () => { if (typeof cpuSelectExtendLifeWillWithPolicy === 'function') await cpuSelectExtendLifeWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'CORROSION_WILL': async () => { if (typeof cpuSelectCorrosionWillWithPolicy === 'function') await cpuSelectCorrosionWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TELEPORT_WILL': async () => { if (typeof cpuSelectTeleportWillWithPolicy === 'function') await cpuSelectTeleportWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'CELL_TELEPORT_WILL': async () => { if (typeof cpuSelectCellTeleportWillWithPolicy === 'function') await cpuSelectCellTeleportWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TEMPT_WILL': async () => { if (typeof cpuSelectTemptWillWithPolicy === 'function') await cpuSelectTemptWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'TIME_BOMB': async () => { if (typeof cpuSelectTimeBombWithPolicy === 'function') await cpuSelectTimeBombWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'BOARD_EXPANSION_WILL': async () => { if (typeof cpuSelectBoardExpansionWillWithPolicy === 'function') await cpuSelectBoardExpansionWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'BOARD_EXPANSION_GOD': async () => { if (typeof cpuSelectBoardExpansionWillWithPolicy === 'function') await cpuSelectBoardExpansionWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'BLOCKADE_WILL': async () => { if (typeof cpuSelectBlockadeWillWithPolicy === 'function') await cpuSelectBlockadeWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'METEOR_WILL': async () => { if (typeof cpuSelectMeteorWillWithPolicy === 'function') await cpuSelectMeteorWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'FREEZE_WILL': async () => { if (typeof cpuSelectFreezeWillWithPolicy === 'function') await cpuSelectFreezeWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'CLONE_WILL': async () => { if (typeof cpuSelectCloneWillWithPolicy === 'function') await cpuSelectCloneWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; },
        'SPLIT_WILL': async () => { if (typeof cpuSelectSplitWillWithPolicy === 'function') await cpuSelectSplitWillWithPolicy(playerKey); else cardState.pendingEffectByPlayer[playerKey] = null; }
    };
}

async function processCpuTurn() {
    if (isHumanVsHumanModeEnabled()) {
        isProcessing = false;
        return;
    }
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
    if (isHumanVsHumanModeEnabled()) return;
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
    const turnStartMs = Date.now();
    const isWhite = playerKey === 'white';
    const selfColor = isWhite ? CONST_WHITE : CONST_BLACK;
    const selfName = isWhite ? '白' : '黒';
    const currentPlayer = gameState ? gameState.currentPlayer : null;
    const currentPlayerKey = (currentPlayer === CONST_BLACK || currentPlayer === 'black')
        ? 'black'
        : ((currentPlayer === CONST_WHITE || currentPlayer === 'white') ? 'white' : null);

    if (shouldAbortCpuForHumanMode(playerKey, 'run_start')) {
        return;
    }

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
        const hasUsedCardThisTurn = !!(cardState && cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer[playerKey]);
        const hasPendingSelection = !!(cardState && cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[playerKey]);

        emitCpuCommentary('turn_start', playerKey, {
            level,
            hasPendingSelection,
            hasUsedCardThisTurn
        });

        if (!hasUsedCardThisTurn && !hasPendingSelection) {
            const destroyedForCycle = (typeof cpuMaybeDestroyHandCardWithPolicy === 'function')
                ? !!cpuMaybeDestroyHandCardWithPolicy(playerKey)
                : false;
            if (destroyedForCycle) {
                isProcessing = false;
                scheduleRetry(() => {
                    if (isUiAnimationBusy()) {
                        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                        return;
                    }
                    runCpuTurn(playerKey, { autoMode });
                }, getAnimationRetryDelayMs());
                return;
            }
        }

        if (!hasUsedCardThisTurn && !hasPendingSelection) {
            const protectionPreview = getActiveProtectionSafe(selfColor);
            const permaPreview = getFlipBlockersSafe();
            const previewMoves = (typeof generateMovesForPlayer === 'function')
                ? generateMovesForPlayer(selfColor, null, protectionPreview, permaPreview)
                : [];
            const previewLegalMovesCount = Array.isArray(previewMoves) ? previewMoves.length : 0;

            const onnxCardDecision = await maybeUseCardFromOnnx(playerKey, level, previewLegalMovesCount, previewMoves);
            if (shouldAbortCpuForHumanMode(playerKey, 'after_onnx_card_decision')) {
                return;
            }
            let applied = !!(onnxCardDecision && onnxCardDecision.applied === true);
            const heldByOnnx = !!(onnxCardDecision && onnxCardDecision.hold === true);
            const overrideHold = heldByOnnx && shouldOverrideOnnxHoldDecision(playerKey, level, previewLegalMovesCount);
            if (!applied && (!heldByOnnx || overrideHold)) {
                applied = (typeof cpuMaybeUseCardWithPolicy === 'function') ? cpuMaybeUseCardWithPolicy(playerKey) : false;
            }
            if (applied) {
                emitCpuCommentary('card_used', playerKey, {
                    level,
                    cardId: getLastUsedCardIdSafe(playerKey)
                });
                isProcessing = false;
                const resumeAfterCardAnimation = () => {
                    if (shouldAbortCpuForHumanMode(playerKey, 'resume_after_card_animation')) {
                        return;
                    }
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

        if (pending && pending.stage === 'selectTarget') {
            emitCpuCommentary('card_targeted', playerKey, {
                level,
                pendingType: pending.type || ''
            });
        }

        // Use pending handler factory for clarity and testability
        if (pending && pending.stage === 'selectTarget') {
            const handler = getPendingTypeHandlers(playerKey)[pending.type];
            if (handler) {
                if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
                    debugLog(`[AI] CPU selecting ${pending.type.replace(/_/g, ' ').toLowerCase()} target`, 'debug', { playerKey, pendingEffect: pending });
                }
                await handler();
                if (shouldAbortCpuForHumanMode(playerKey, 'after_pending_selection')) {
                    return;
                }
                pending = cardState.pendingEffectByPlayer[playerKey];
                if (isUiAnimationBusy()) {
                    isProcessing = false;
                    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                    return;
                }
                const activePlayerAfterSelection = gameState ? gameState.currentPlayer : null;
                const activePlayerKeyAfterSelection = (activePlayerAfterSelection === CONST_BLACK || activePlayerAfterSelection === 'black')
                    ? 'black'
                    : ((activePlayerAfterSelection === CONST_WHITE || activePlayerAfterSelection === 'white') ? 'white' : null);
                if (activePlayerKeyAfterSelection && activePlayerKeyAfterSelection !== playerKey) {
                    resetPendingSelectRetryState(playerKey);
                    isProcessing = false;
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
            } else {
                if (shouldAbortStuckPendingSelection(playerKey, pending)) {
                    if (cardState && cardState.pendingEffectByPlayer) {
                        cardState.pendingEffectByPlayer[playerKey] = null;
                    }
                    resetPendingSelectRetryState(playerKey);
                }
                isProcessing = false;
                scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                return;
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
                const onnxCardDecision = await maybeUseCardFromOnnx(playerKey, level, 0, []);
                if (shouldAbortCpuForHumanMode(playerKey, 'after_onnx_retry')) {
                    return;
                }
                const heldByOnnx = !!(onnxCardDecision && onnxCardDecision.hold === true);
                const overrideHold = heldByOnnx && shouldOverrideOnnxHoldDecision(playerKey, level, 0);
                let retried = !!(onnxCardDecision && onnxCardDecision.applied === true);
                if (!retried && (!heldByOnnx || overrideHold)) {
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
                if (shouldAbortCpuForHumanMode(playerKey, 'before_pass')) {
                    return;
                }
                emitCpuCommentary('pass', playerKey, {
                    level,
                    legalMovesCount: 0
                });
                passFn(playerKey, autoMode);
            } else {
                console.error('[AI] processPassTurn is not available');
                isProcessing = false;
            }
            resetPendingSelectRetryState(playerKey);
            return;
        }

        let move = null;
        if (shouldUseOnnxMoveDecision(level) && typeof selectMoveFromOnnxPolicyAsync === 'function') {
            try {
                move = await selectMoveFromOnnxPolicyAsync(candidateMoves, playerKey, level);
                if (shouldAbortCpuForHumanMode(playerKey, 'after_onnx_move_decision')) {
                    return;
                }
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

        const minThinkMs = resolveLv6MinThinkMs(playerKey, level, autoMode);
        const thinkElapsedMs = Math.max(0, Date.now() - turnStartMs);
        const extraDelayMs = Math.max(0, minThinkMs - thinkElapsedMs);

        const commitSelectedMove = () => {
            if (shouldAbortCpuForHumanMode(playerKey, 'commit_selected_move')) {
                return;
            }
            const nowCurrent = gameState ? gameState.currentPlayer : null;
            const nowCurrentKey = (nowCurrent === CONST_BLACK || nowCurrent === 'black')
                ? 'black'
                : ((nowCurrent === CONST_WHITE || nowCurrent === 'white') ? 'white' : null);
            if (nowCurrentKey && nowCurrentKey !== playerKey) {
                debugCpuTrace('[AI] skip stale delayed move commit (turn changed)', {
                    playerKey,
                    nowCurrentKey
                });
                isProcessing = false;
                return;
            }
            if (isUiAnimationBusy()) {
                scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                isProcessing = false;
                return;
            }
            const cornersBeforeMove = countOwnedBasicCornersSafe(gameState, playerKey);
            playHandAnimation(selfColor, move.row, move.col, () => {
                executeMove(move);
                const cornersAfterMove = countOwnedBasicCornersSafe(gameState, playerKey);
                if (cornersAfterMove > cornersBeforeMove) {
                    emitCpuCommentary('turn_start', playerKey, { level });
                }
            });
        };

        if (extraDelayMs > 0) {
            debugCpuTrace('[AI] Lv6 minimum think-time wait', {
                playerKey,
                level,
                thinkElapsedMs,
                minThinkMs,
                extraDelayMs
            });
            scheduleRetry(commitSelectedMove, extraDelayMs);
        } else {
            commitSelectedMove();
        }
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
