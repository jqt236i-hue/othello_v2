// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../src/types';

// CPU turn orchestration extracted from turn-manager

// TimerService DI
let cpuTurnTimerService: any = null;
function setCpuTurnTimerService(service: any): void { cpuTurnTimerService = service; }
function getCpuTurnTimerService() {
    if (cpuTurnTimerService) return cpuTurnTimerService;
    try {
        const { createTimerService } = _require('./timer-service');
        cpuTurnTimerService = createTimerService('browser');
        return cpuTurnTimerService;
    } catch (e) {
        return null;
    }
}

// Timers abstraction (injected by UI)
let timers: any = null;
if (typeof require === 'function') {
    try { timers = _require('./timers'); } catch (e) { /* ignore */ }
}
let passHandler = null;
if (typeof require === 'function') {
    try { passHandler = _require('./pass-handler'); } catch (e) { /* ignore */ }
}
let cpuCommentaryRuntime = null;
if (typeof require === 'function') {
    try { cpuCommentaryRuntime = _require('./ai/cpu-commentary-runtime'); } catch (e) { /* ignore */ }
}
let commentaryContextHelpers = null;
if (typeof require === 'function') {
    try { commentaryContextHelpers = _require('../shared/commentary-context-helpers'); } catch (e) { /* ignore */ }
}
let commentaryRuntimeHelpers = null;
if (typeof require === 'function') {
    try { commentaryRuntimeHelpers = _require('../shared/commentary-runtime-helpers'); } catch (e) { /* ignore */ }
}
let cpuCardLogic = null;
if (typeof require === 'function') {
    try { cpuCardLogic = _require('./logic/cards'); } catch (e) { /* ignore */ }
}
let pendingCoordinator = null;
if (typeof require === 'function') {
    try { pendingCoordinator = _require('./turn/pending-coordinator'); } catch (e) { /* ignore */ }
}
let cpuLv6RuntimeCapability = null;
if (typeof require === 'function') {
    try { cpuLv6RuntimeCapability = _require('../shared/cpu-lv6-runtime-capability'); } catch (e) { /* ignore */ }
}

// ===== Module-level DI (replaces globalThis reads for bootstrap flags) =====
let __uiImpl_cpu: Record<string, any> = {};
function setCpuUIImpl(obj: any): void {
    __uiImpl_cpu = Object.assign({}, __uiImpl_cpu, obj || {});
}
const ANIMATION_RETRY_DELAY_MS = 80;

// Local safe constants to avoid ReferenceError for undeclared globals in test environments
const CONST_BLACK = (typeof BLACK !== 'undefined') ? BLACK : ((typeof global !== 'undefined' && typeof global.BLACK !== 'undefined') ? global.BLACK : 1);
const CONST_WHITE = (typeof WHITE !== 'undefined') ? WHITE : ((typeof global !== 'undefined' && typeof global.WHITE !== 'undefined') ? global.WHITE : -1);

function getAnimationRetryDelayMs() {
    return ANIMATION_RETRY_DELAY_MS;
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

function getCurrentPlayerKeySafe(): PlayerKey | null {
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

function resolveCpuCardLogic() {
    if (cpuCardLogic && typeof cpuCardLogic === 'object') return cpuCardLogic;
    return null;
}

function resolvePendingCoordinatorForCpu() {
    if (pendingCoordinator && typeof pendingCoordinator === 'object') return pendingCoordinator;
    return null;
}

function resolvePendingSelectionDispatchKeyForCpu(pendingType) {
    const coordinator = resolvePendingCoordinatorForCpu();
    if (!coordinator || typeof coordinator.resolvePendingSelectionDispatchKey !== 'function') return null;
    return coordinator.resolvePendingSelectionDispatchKey(pendingType);
}

function readCpuPendingSelection(playerKey: PlayerKey) {
    const coordinator = resolvePendingCoordinatorForCpu();
    if (coordinator && typeof coordinator.readPendingEffect === 'function') {
        return coordinator.readPendingEffect(cardState, playerKey);
    }
    if (cardState && cardState.pendingEffectByPlayer) {
        return cardState.pendingEffectByPlayer[playerKey] || null;
    }
    return null;
}

function clearCpuPendingSelection(playerKey: PlayerKey): boolean {
    const coordinator = resolvePendingCoordinatorForCpu();
    if (coordinator && typeof coordinator.clearPendingEffect === 'function') {
        const result = coordinator.clearPendingEffect(cardState, playerKey);
        return !!(result && result.ok);
    }
    if (cardState && cardState.pendingEffectByPlayer) {
        cardState.pendingEffectByPlayer[playerKey] = null;
        return true;
    }
    return false;
}

async function runOptionalCpuPendingSelectionHandler(handlerFn: any, playerKey: PlayerKey): Promise<void> {
    if (typeof handlerFn === 'function') {
        await handlerFn(playerKey);
        return;
    }
    clearCpuPendingSelection(playerKey);
}

function getFateWillControllerForTurnOwnerSafe(turnOwnerKey: PlayerKey, cardStateRef: CardState | null) {
    const cardStateValue = cardStateRef && typeof cardStateRef === 'object' ? cardStateRef : resolvePresentationCardState(null);
    const logic = resolveCpuCardLogic();
    if (logic && typeof logic.getFateWillControllerForTurnOwner === 'function') {
        try {
            return logic.getFateWillControllerForTurnOwner(cardStateValue, turnOwnerKey);
        } catch (e) { /* ignore */ }
    }
    if (!cardStateValue || !cardStateValue.fateWillControllerByTurnOwner) return null;
    const controllerKey = cardStateValue.fateWillControllerByTurnOwner[turnOwnerKey];
    if (controllerKey === 'black' || controllerKey === 'white') return controllerKey;
    return null;
}

function resolveCpuControlledTurnOwnerKey(): PlayerKey | null {
    const turnOwnerKey = getCurrentPlayerKeySafe();
    if (!turnOwnerKey) return null;
    const controllerKey = getFateWillControllerForTurnOwnerSafe(turnOwnerKey, null);
    const effectiveOperatorKey = controllerKey || turnOwnerKey;
    return effectiveOperatorKey === 'white' ? turnOwnerKey : null;
}

function isHumanVsHumanModeEnabled() {
    // @compat - DEBUG_HUMAN_VS_HUMAN injected via setCpuUIImpl DI
    const debugHvH = !!(__uiImpl_cpu && __uiImpl_cpu.DEBUG_HUMAN_VS_HUMAN);
    let matchMode = null;
    try {
        // globalThis read — UI/bootstrap dependency, keep
        matchMode = (typeof globalThis !== 'undefined' && typeof globalThis.getCurrentMatchMode === 'function')
            ? globalThis.getCurrentMatchMode()
            : (typeof globalThis !== 'undefined' ? globalThis.MATCH_MODE : null);
    } catch (e) { /* ignore */ }
    return debugHvH || matchMode === 'network';
}

function getPlaybackStateForCpuTurn() {
    // @compat - globalThis read, UI/bootstrap dependency (PlaybackStateManager)
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) {
            return globalThis.PlaybackStateManager;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readCpuProcessing() {
    const playbackState = getPlaybackStateForCpuTurn();
    if (playbackState && typeof playbackState.getProcessing === 'function') {
        return playbackState.getProcessing() === true;
    }
    // @compat - fallback to free variable (injected by turn-manager or bootstrap)
    if (typeof isProcessing !== 'undefined') return isProcessing === true;
    return false;
}

function setCpuProcessing(active) {
    const next = active === true;
    const playbackState = getPlaybackStateForCpuTurn();
    if (playbackState && typeof playbackState.setProcessing === 'function') {
        playbackState.setProcessing(next);
    }
    try { isProcessing = next; } catch (e) { /* ignore */ }
    return next;
}

function shouldAbortCpuForHumanMode(playerKey, context) {
    if (!isHumanVsHumanModeEnabled()) return false;
    resetPendingSelectRetryState(playerKey);
    setCpuProcessing(false);
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
    // @compat - globalThis read, set by test scripts / run-ui-level-match.ts via globalThis.__BENCH_FAST_MODE
    try {
        return typeof globalThis !== 'undefined' && globalThis.__BENCH_FAST_MODE === true;
    } catch (e) { /* ignore */ }
    return false;
}

function resolveCpuLv6SharedProfile() {
    try {
        if (typeof require === 'function') {
            const shared = _require('../constants/cpu-lv6-shared-profile.js');
            if (shared && typeof shared === 'object') return shared;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function readExplicitCpuLv6SharedProfile() {
    try {
        if (typeof require === 'function') {
            const shared = _require('../constants/cpu-lv6-shared-profile.js');
            if (shared && typeof shared === 'object') return shared;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCpuLv6RuntimeCapabilityModule() {
    if (
        cpuLv6RuntimeCapability &&
        typeof cpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability === 'function'
    ) {
        return cpuLv6RuntimeCapability;
    }
    try {
        if (typeof require === 'function') {
            cpuLv6RuntimeCapability = _require('../shared/cpu-lv6-runtime-capability');
            if (
                cpuLv6RuntimeCapability &&
                typeof cpuLv6RuntimeCapability.resolveCpuLv6BrowserRuntimeCapability === 'function'
            ) {
                return cpuLv6RuntimeCapability;
            }
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCpuLv6BrowserRuntimeCapability() {
    const shared = readExplicitCpuLv6SharedProfile();
    const capabilityModule = resolveCpuLv6RuntimeCapabilityModule();
    if (!shared || !capabilityModule || typeof capabilityModule.resolveCpuLv6BrowserRuntimeCapability !== 'function') return null;
    return capabilityModule.resolveCpuLv6BrowserRuntimeCapability(shared);
}

function shouldUseOnnxCardDecision(level) {
    if (!Number.isFinite(level) || level < 6) return true;
    const capability = resolveCpuLv6BrowserRuntimeCapability();
    if (capability) return capability.usesOnnxCardDecision === true;
    const shared = resolveCpuLv6SharedProfile();
    const mode = String(shared && shared.browser && shared.browser.cardDecisionMode || '').trim().toLowerCase();
    return mode !== 'policy-table-core';
}

function shouldUseOnnxMoveDecision(level) {
    if (!Number.isFinite(level) || level < 6) return true;
    const capability = resolveCpuLv6BrowserRuntimeCapability();
    if (capability) return capability.usesOnnxMoveDecision === true;
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
    // @compat - globalThis.CPU_LV6_MIN_THINK_MS is a browser-level window override; keep as fallback
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
    // Use resolveCommentaryRuntimeByRequire instead of resolveCommentaryRuntimeFromGlobal(globalThis)
    if (runtimeHelpers && typeof runtimeHelpers.resolveCommentaryRuntimeByRequire === 'function' && typeof require === 'function') {
        const requiredRuntime = runtimeHelpers.resolveCommentaryRuntimeByRequire(['./ai/cpu-commentary-runtime'], require);
        if (requiredRuntime) {
            cpuCommentaryRuntime = requiredRuntime;
            return cpuCommentaryRuntime;
        }
    }
    if (cpuCommentaryRuntime && typeof cpuCommentaryRuntime.requestCommentary === 'function') {
        return cpuCommentaryRuntime;
    }
    try {
        if (typeof require === 'function') {
            const direct = _require('./ai/cpu-commentary-runtime');
            if (direct && typeof direct.requestCommentary === 'function') {
                cpuCommentaryRuntime = direct;
                return cpuCommentaryRuntime;
            }
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCommentaryContextHelpers() {
    if (commentaryContextHelpers) return commentaryContextHelpers;
    try {
        if (typeof require === 'function') {
            commentaryContextHelpers = _require('../shared/commentary-context-helpers');
            if (commentaryContextHelpers) return commentaryContextHelpers;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveCommentaryRuntimeHelpers() {
    if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;
    try {
        if (typeof require === 'function') {
            commentaryRuntimeHelpers = _require('../shared/commentary-runtime-helpers');
            if (commentaryRuntimeHelpers) return commentaryRuntimeHelpers;
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

function resolveCommentaryCpuLevel(playerKey, explicitLevel) {
    const direct = Number(explicitLevel);
    if (Number.isFinite(direct) && direct >= 1) return Math.max(1, Math.floor(direct));

    try {
        if (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey])) {
            return Math.max(1, Math.floor(cpuSmartness[playerKey]));
        }
    } catch (e) { /* ignore */ }

    return 1;
}

function emitCpuCommentary(eventType, playerKey, extra) {
    const runtime = resolveCpuCommentaryRuntime();
    if (!runtime || typeof runtime.requestCommentary !== 'function') return;
    if (typeof emitLogAdded !== 'function') return;

    const helpers = resolveCommentaryContextHelpers();
    const counts = countDiscsSafe(gameState);
    const turnNumber = gameState && Number.isFinite(gameState.turnNumber) ? gameState.turnNumber : null;
    const commentaryLevel = resolveCommentaryCpuLevel(playerKey, extra && extra.level);
    const fallbackContext = Object.assign({
        eventType: String(eventType || 'turn_start'),
        playerKey: playerKey === 'black' ? 'black' : 'white',
        turnNumber,
        phase: resolvePhaseByTurn(turnNumber, (counts.black || 0) + (counts.white || 0)),
        advantage: resolveAdvantageLabel(playerKey, counts),
        counts,
        occupiedCells: (counts.black || 0) + (counts.white || 0),
        level: commentaryLevel,
        cpuLevel: commentaryLevel,
        difficultyLevel: commentaryLevel,
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
                level: commentaryLevel,
                cpuLevel: commentaryLevel,
                difficultyLevel: commentaryLevel,
                legalMovesCount: Number.isFinite(extra && extra.legalMovesCount) ? extra.legalMovesCount : null,
                pendingType: (extra && extra.pendingType) ? String(extra.pendingType) : null
            }, extra || {})
        })
        : fallbackContext;

    runtime.requestCommentary(context).then((text) => {
        const entry = formatPresentationCommentaryResult(playerKey, text);
        if (!entry) return;
        emitLogAdded(Object.assign({
            kind: 'commentary',
            speakerRole: 'cpu'
        }, entry));
    }).catch(() => {
        // Ignore commentary failures to keep turn processing deterministic.
    });
}

function normalizePresentationPlayerKey(value, fallbackKey) {
    const helpers = resolveCommentaryContextHelpers();
    if (helpers && typeof helpers.normalizePlayerKey === 'function') {
        return helpers.normalizePlayerKey(value, fallbackKey);
    }
    if (value === 'white' || value === CONST_WHITE || value === -1 || value === '-1') return 'white';
    if (value === 'black' || value === CONST_BLACK || value === 1 || value === '1') return 'black';
    return fallbackKey === 'white' ? 'white' : 'black';
}

function resolvePresentationGameState(options: { gameState?: GameState | null } | null): GameState | null {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.gameState && typeof opts.gameState === 'object') return opts.gameState;
    try {
        return gameState || null;
    } catch (e) { /* ignore */ }
    return null;
}

function resolvePresentationCardState(cardStateRef: CardState | null | undefined): CardState | null {
    if (cardStateRef && typeof cardStateRef === 'object') return cardStateRef;
    try {
        return cardState || null;
    } catch (e) { /* ignore */ }
    return null;
}

function getCurrentPlayerKeyFromState(state: GameState | null): PlayerKey | null {
    try {
        const current = state ? state.currentPlayer : null;
        if (current === CONST_BLACK || current === 'black') return 'black';
        if (current === CONST_WHITE || current === 'white') return 'white';
    } catch (e) { /* ignore */ }
    return null;
}

function getTurnNumberFromState(state: GameState | null): number | null {
    try {
        const turnNumber = state ? state.turnNumber : null;
        return Number.isFinite(turnNumber) ? turnNumber : null;
    } catch (e) { /* ignore */ }
    return null;
}

function formatPresentationCommentaryResult(playerKey, text) {
    const line = String(text || '').trim();
    if (!line) return null;
    const runtimeHelpers = resolveCommentaryRuntimeHelpers();
    const prefix = (runtimeHelpers && typeof runtimeHelpers.getCpuSpeakerPrefix === 'function')
        ? runtimeHelpers.getCpuSpeakerPrefix(playerKey)
        : (playerKey === 'black' ? '黒CPU' : '白CPU');
    return {
        kind: 'commentary',
        speakerRole: 'cpu',
        playerKey,
        prefix,
        line,
        text: `${prefix}: ${line}`
    };
}

function createPresentationRuntime(dependencies) {
    const deps = (dependencies && typeof dependencies === 'object') ? dependencies : {};
    const normalizePlayerKey = typeof deps.normalizePlayerKey === 'function'
        ? deps.normalizePlayerKey
        : ((value, fallbackKey) => (value === 'white' ? 'white' : (fallbackKey === 'white' ? 'white' : 'black')));
    const resolveGameState = typeof deps.resolveGameState === 'function'
        ? deps.resolveGameState
        : (() => null);
    const resolveCardState = typeof deps.resolveCardState === 'function'
        ? deps.resolveCardState
        : ((value) => (value && typeof value === 'object') ? value : null);
    const getPlayerKeyFromState = typeof deps.getCurrentPlayerKeyFromState === 'function'
        ? deps.getCurrentPlayerKeyFromState
        : (() => null);
    const getTurnNumber = typeof deps.getTurnNumberFromState === 'function'
        ? deps.getTurnNumberFromState
        : (() => null);
    const countDiscs = typeof deps.countDiscs === 'function'
        ? deps.countDiscs
        : (() => ({ black: 0, white: 0 }));
    const resolveContextHelpers = typeof deps.resolveCommentaryContextHelpers === 'function'
        ? deps.resolveCommentaryContextHelpers
        : (() => null);
    const resolveCpuLevel = typeof deps.resolveCommentaryCpuLevel === 'function'
        ? deps.resolveCommentaryCpuLevel
        : (() => 1);
    const resolvePhase = typeof deps.resolvePhaseByTurn === 'function'
        ? deps.resolvePhaseByTurn
        : (() => 'middle');
    const resolveAdvantage = typeof deps.resolveAdvantageLabel === 'function'
        ? deps.resolveAdvantageLabel
        : (() => 'even');
    const resolveRuntimeHelpers = typeof deps.resolveCommentaryRuntimeHelpers === 'function'
        ? deps.resolveCommentaryRuntimeHelpers
        : (() => null);
    const resolveCommentaryRuntime = typeof deps.resolveCpuCommentaryRuntime === 'function'
        ? deps.resolveCpuCommentaryRuntime
        : (() => null);
    const formatCommentaryResult = typeof deps.formatCommentaryResult === 'function'
        ? deps.formatCommentaryResult
        : (() => null);
    const isHumanModeEnabled = typeof deps.isHumanVsHumanModeEnabled === 'function'
        ? deps.isHumanVsHumanModeEnabled
        : (() => false);
    const flushPresentationEvents = typeof deps.flushPresentationEvents === 'function'
        ? deps.flushPresentationEvents
        : null;
    const processScheduledCpuTurn = typeof deps.processCpuTurn === 'function'
        ? deps.processCpuTurn
        : null;

    function buildEnemyCardUsedEventFromPlayback(playbackEvents) {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        for (const ev of events) {
            if (!ev || ev.type !== 'card_use_animation') continue;
            const targets = Array.isArray(ev.targets) ? ev.targets : [];
            for (const one of targets) {
                if (!one || typeof one !== 'object') continue;
                const ownerKey = normalizePlayerKey(one.owner || one.player, 'black');
                if (ownerKey !== 'black') continue;
                return {
                    player: ownerKey,
                    cardId: one.cardId || null,
                    meta: {
                        owner: ownerKey,
                        cost: Number.isFinite(one.cost) ? one.cost : null,
                        name: one.name || null
                    }
                };
            }
        }
        return null;
    }

    function buildEnemyCardCommentaryContext(ev, options) {
        const state = resolveGameState(options);
        if (!state || !Array.isArray(state.board)) return null;

        const ownerKey = normalizePlayerKey((ev && ev.player) || (ev && ev.meta && ev.meta.owner), 'black');
        if (ownerKey !== 'black') return null;

        const speakerKey = 'white';
        const counts = countDiscs(state);
        const turnNumber = getTurnNumber(state);
        const helpers = resolveContextHelpers();
        const commentaryLevel = resolveCpuLevel(
            speakerKey,
            options && typeof options === 'object' ? options.level : null
        );
        if (helpers && typeof helpers.buildCommentaryContext === 'function') {
            return helpers.buildCommentaryContext({
                eventType: 'card_used_by_enemy',
                playerKey: speakerKey,
                turnNumber,
                counts,
                board: state.board,
                cardId: (ev && ev.cardId) ? String(ev.cardId) : null,
                extra: {
                    level: commentaryLevel,
                    cpuLevel: commentaryLevel,
                    difficultyLevel: commentaryLevel
                }
            });
        }

        return {
            eventType: 'card_used_by_enemy',
            playerKey: speakerKey,
            turnNumber,
            counts,
            board: state.board,
            phase: resolvePhase(turnNumber, (counts.black || 0) + (counts.white || 0)),
            advantage: resolveAdvantage(speakerKey, counts),
            cardId: (ev && ev.cardId) ? String(ev.cardId) : null,
            level: commentaryLevel,
            cpuLevel: commentaryLevel,
            difficultyLevel: commentaryLevel
        };
    }

    function requestEnemyCardCommentary(ev, options) {
        if (isHumanModeEnabled()) return Promise.resolve(null);

        const opts = (options && typeof options === 'object') ? options : {};
        const runtime = (opts.runtime && typeof opts.runtime.requestCommentary === 'function')
            ? opts.runtime
            : resolveCommentaryRuntime();
        if (!runtime || typeof runtime.requestCommentary !== 'function') return Promise.resolve(null);

        const context = buildEnemyCardCommentaryContext(ev, opts);
        if (!context) return Promise.resolve(null);

        return Promise.resolve(runtime.requestCommentary(context))
            .then((text) => formatCommentaryResult('white', text))
            .catch(() => null);
    }

    function requestEnemyCardCommentaryFromPlayback(playbackEvents, options) {
        const enemyCardEvent = buildEnemyCardUsedEventFromPlayback(playbackEvents);
        if (!enemyCardEvent) return Promise.resolve(null);
        return requestEnemyCardCommentary(enemyCardEvent, options);
    }

    function flushPendingPresentationEvents(cardStateRef, options) {
        const state = resolveCardState(cardStateRef);
        if (!state) return [];

        const opts = (options && typeof options === 'object') ? options : {};
        let events = [];
        const flushLiveEvents = (typeof opts.flushLiveEvents === 'function')
            ? opts.flushLiveEvents
            : flushPresentationEvents;
        if (typeof flushLiveEvents === 'function') {
            try {
                events = flushLiveEvents(state) || [];
            } catch (e) {
                events = [];
            }
        }

        if (events && events.length > 0 && Array.isArray(state._presentationEventsPersist)) {
            state._presentationEventsPersist.length = 0;
        }

        if ((!events || events.length === 0) && Array.isArray(state._presentationEventsPersist) && state._presentationEventsPersist.length) {
            events = state._presentationEventsPersist.slice();
            state._presentationEventsPersist.length = 0;
        }

        return Array.isArray(events) ? events : [];
    }

    function createBoardUpdateDrainController() {
        let drainInProgress = false;
        let drainPending = false;

        return {
            async requestDrain(runDrain) {
                drainPending = true;
                if (drainInProgress) return;

                drainInProgress = true;
                try {
                    while (drainPending) {
                        drainPending = false;
                        if (typeof runDrain === 'function') {
                            await runDrain();
                        }
                    }
                } finally {
                    drainInProgress = false;
                }
            }
        };
    }

    function scheduleCpuTurn(ev, options) {
        const payload = (ev && typeof ev === 'object') ? ev : {};
        const opts = (options && typeof options === 'object') ? options : {};
        const delay = Number.isFinite(payload.delayMs) ? payload.delayMs : 0;
        const timerService = getCpuTurnTimerService();
        const scheduleFn = (typeof opts.setTimeout === 'function') ? opts.setTimeout : (timerService ? timerService.setTimeout.bind(timerService) : setTimeout);
        const cpuTurnFn = (typeof opts.processCpuTurn === 'function') ? opts.processCpuTurn : processScheduledCpuTurn;

        return scheduleFn(function () {
            try {
                const state = resolveGameState(opts);
                const currentPlayerKey = getPlayerKeyFromState(state);
                const currentTurnNumber = getTurnNumber(state);
                if (payload.expectedPlayerKey && payload.expectedPlayerKey !== currentPlayerKey) return;
                if (Number.isFinite(payload.expectedTurnNumber) && payload.expectedTurnNumber !== currentTurnNumber) return;
            } catch (e) { /* ignore */ }

            if (typeof cpuTurnFn === 'function') {
                cpuTurnFn();
            } else {
                console.warn('[GamePresentationRuntime] processCpuTurn not available for SCHEDULE_CPU_TURN');
            }
        }, delay);
    }

    return {
        buildEnemyCardUsedEventFromPlayback,
        requestEnemyCardCommentary,
        requestEnemyCardCommentaryFromPlayback,
        flushPendingPresentationEvents,
        createBoardUpdateDrainController,
        scheduleCpuTurn
    };
}

const presentationRuntime = createPresentationRuntime({
    normalizePlayerKey: normalizePresentationPlayerKey,
    resolveGameState: resolvePresentationGameState,
    resolveCardState: resolvePresentationCardState,
    getCurrentPlayerKeyFromState,
    getTurnNumberFromState,
    countDiscs: countDiscsSafe,
    resolveCommentaryContextHelpers,
    resolveCommentaryCpuLevel,
    resolvePhaseByTurn,
    resolveAdvantageLabel,
    resolveCommentaryRuntimeHelpers,
    resolveCpuCommentaryRuntime,
    formatCommentaryResult: formatPresentationCommentaryResult,
    isHumanVsHumanModeEnabled,
    flushPresentationEvents: (state) => ((cpuCardLogic && typeof cpuCardLogic.flushPresentationEvents === 'function')
        ? cpuCardLogic.flushPresentationEvents(state)
        : []),
    processCpuTurn: () => processCpuTurn()
});

async function maybeUseCardFromOnnx(playerKey: PlayerKey, level: number, legalMovesCount: number, legalMoves: any[]): Promise<{ attempted: boolean; applied: boolean; hold: boolean; }> {
    const none = { attempted: false, applied: false, hold: false };
    if (!shouldUseOnnxCardDecision(level)) return none;
    if (typeof selectCardFromOnnxPolicyAsync !== 'function') return none;
    if (typeof applyCardChoice !== 'function') return none;
    if (!cpuCardLogic || !cardState || !gameState) return none;
    if (
        cardState &&
        cardState.hasUsedCardThisTurnByPlayer &&
        cardState.hasUsedCardThisTurnByPlayer[playerKey]
    ) {
        return none;
    }
    try {
        let usable = [];
        if (cpuCardLogic && typeof cpuCardLogic.getUsableCardIds === 'function') {
            usable = cpuCardLogic.getUsableCardIds(cardState, gameState, playerKey) || [];
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
function setTimers(t: any): void {
    timers = t;
}
function getTimers(): any { return timers; }

function isUiAnimationBusy() {
    const playbackState = getPlaybackStateForCpuTurn();
    if (playbackState) {
        if (typeof playbackState.getCardAnimating === 'function' && playbackState.getCardAnimating() === true) {
            return true;
        }
        if (typeof playbackState.getPlaybackActive === 'function' && playbackState.getPlaybackActive() === true) {
            return true;
        }
    }
    // @compat - isCardAnimating / VisualPlaybackActive as free variables (module-level in turn-manager)
    const localCard = (typeof isCardAnimating !== 'undefined') ? !!isCardAnimating : false;
    const winPlayback = (typeof VisualPlaybackActive !== 'undefined') ? (VisualPlaybackActive === true) : false;
    return localCard || winPlayback;
}
const _cpuRetryPendingByPlayer = { black: null, white: null };
const _pendingSelectRetryStateByPlayer = {
    black: { key: '', count: 0 },
    white: { key: '', count: 0 }
};
const _scheduledRetryTimerIds = new Set();
let _cpuRetryGeneration = 0;
const MAX_STUCK_PENDING_SELECT_RETRIES = 4;

function _retryStateKey(playerKey) {
    return playerKey === 'white' ? 'white' : 'black';
}

function resetPendingSelectRetryState(playerKey) {
    const key = _retryStateKey(playerKey);
    _pendingSelectRetryStateByPlayer[key].key = '';
    _pendingSelectRetryStateByPlayer[key].count = 0;
}

function resetCpuTurnHandlerState() {
    _cpuRetryGeneration += 1;
    _cpuRetryPendingByPlayer.black = null;
    _cpuRetryPendingByPlayer.white = null;
    resetPendingSelectRetryState('black');
    resetPendingSelectRetryState('white');
    const timerService = getCpuTurnTimerService();
    for (const tid of _scheduledRetryTimerIds) {
        try {
            if (timerService) {
                timerService.clearTimeout(tid);
            } else {
                clearTimeout(tid);
            }
        } catch (e) { /* ignore */ }
    }
    _scheduledRetryTimerIds.clear();
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
    const expectedRetryGeneration = _cpuRetryGeneration;
    if (_cpuRetryPendingByPlayer[key] === expectedRetryGeneration) return;
    _cpuRetryPendingByPlayer[key] = expectedRetryGeneration;
    const expectedPlayerKey = getCurrentPlayerKeySafe();
    const expectedTurnNumber = getCurrentTurnNumberSafe();
    scheduleRetry(() => {
        if (_cpuRetryPendingByPlayer[key] === expectedRetryGeneration) {
            _cpuRetryPendingByPlayer[key] = null;
        }
        if (expectedRetryGeneration !== _cpuRetryGeneration) {
            debugCpuTrace('[AI] skip stale scheduled CPU run (generation changed)', {
                playerKey: key,
                expectedRetryGeneration,
                currentRetryGeneration: _cpuRetryGeneration,
                expectedPlayerKey,
                expectedTurnNumber
            });
            return;
        }
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
    return null;
}

function resolveApplyCardChoiceFn() {
    if (typeof applyCardChoice === 'function') return applyCardChoice;
    return null;
}

function getUsableCardIdsForCpuRetry(playerKey) {
    if (!cpuCardLogic) return [];
    if (typeof cpuCardLogic.getUsableCardIds === 'function') {
        const usable = cpuCardLogic.getUsableCardIds(cardState, gameState, playerKey);
        return Array.isArray(usable) ? usable.slice() : [];
    }
    if (typeof cpuCardLogic.hasUsableCard === 'function' && cpuCardLogic.hasUsableCard(cardState, gameState, playerKey)) {
        const hand = (cardState && cardState.hands && Array.isArray(cardState.hands[playerKey]))
            ? cardState.hands[playerKey]
            : [];
        return hand.slice();
    }
    return [];
}

function tryApplyAnyUsableCard(playerKey) {
    const hasUsedCardThisTurn = !!(
        cardState &&
        cardState.hasUsedCardThisTurnByPlayer &&
        cardState.hasUsedCardThisTurnByPlayer[playerKey]
    );
    const hasPendingSelection = !!(
        cardState &&
        readCpuPendingSelection(playerKey)
    );
    if (hasUsedCardThisTurn || hasPendingSelection) return false;
    const applyChoice = resolveApplyCardChoiceFn();
    if (typeof applyChoice !== 'function') return false;
    const usableIds = getUsableCardIdsForCpuRetry(playerKey);
    if (!usableIds.length) return false;
    for (const cardId of usableIds) {
        const cardDef = (cpuCardLogic && typeof cpuCardLogic.getCardDef === 'function')
            ? cpuCardLogic.getCardDef(cardId)
            : null;
        if (applyChoice(playerKey, { cardId, cardDef })) {
            return true;
        }
    }
    return false;
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
    // 1) Prefer legacy module-scoped injected timers when a real impl is present.
    if (hasUsableWaitMs(timers)) {
        try {
            timers.waitMs(delayMs).then(() => { try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); } });
            return;
        } catch (e) { /* fall through */ }
    }

    // 2) Prefer TimerService when available.
    const timerService = getCpuTurnTimerService();
    if (timerService) {
        const tid = timerService.setTimeout(() => {
            _scheduledRetryTimerIds.delete(tid);
            try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
        }, delayMs);
        _scheduledRetryTimerIds.add(tid);
        return;
    }

    // 3) Fallback to global setTimeout
    const tid = setTimeout(() => {
        _scheduledRetryTimerIds.delete(tid);
        try { fn(); } catch (e) { console.error('[AI] scheduleRetry callback failed', e); }
    }, delayMs);
    _scheduledRetryTimerIds.add(tid);
    if (tid && typeof tid.unref === 'function') tid.unref();
}

// Return a mapping of shared pending-dispatch keys => async handler for a given playerKey.
function getPendingDispatchHandlers(playerKey) {
    return {
        destroy: async () => { await cpuSelectDestroyWithPolicy(playerKey); },
        strong_wind: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectStrongWindWillWithPolicy === 'function' ? cpuSelectStrongWindWillWithPolicy : null, playerKey); },
        super_buoyancy: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectSuperBuoyancyWillWithPolicy === 'function' ? cpuSelectSuperBuoyancyWillWithPolicy : null, playerKey); },
        super_gravity: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectSuperGravityWillWithPolicy === 'function' ? cpuSelectSuperGravityWillWithPolicy : null, playerKey); },
        heaven_blessing: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectHeavenBlessingWithPolicy === 'function' ? cpuSelectHeavenBlessingWithPolicy : null, playerKey); },
        condemn: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectCondemnWillWithPolicy === 'function' ? cpuSelectCondemnWillWithPolicy : null, playerKey); },
        swap_with_enemy: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectSwapWithEnemyWithPolicy === 'function' ? cpuSelectSwapWithEnemyWithPolicy : null, playerKey); },
        position_swap: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectPositionSwapWillWithPolicy === 'function' ? cpuSelectPositionSwapWillWithPolicy : null, playerKey); },
        trap: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectTrapWillWithPolicy === 'function' ? cpuSelectTrapWillWithPolicy : null, playerKey); },
        guard: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectGuardWillWithPolicy === 'function' ? cpuSelectGuardWillWithPolicy : null, playerKey); },
        living_will: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectLivingWillWithPolicy === 'function' ? cpuSelectLivingWillWithPolicy : null, playerKey); },
        hyperactive_inherit: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectHyperactiveInheritWillWithPolicy === 'function' ? cpuSelectHyperactiveInheritWillWithPolicy : null, playerKey); },
        extend_life: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectExtendLifeWillWithPolicy === 'function' ? cpuSelectExtendLifeWillWithPolicy : null, playerKey); },
        corrosion: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectCorrosionWillWithPolicy === 'function' ? cpuSelectCorrosionWillWithPolicy : null, playerKey); },
        teleport: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectTeleportWillWithPolicy === 'function' ? cpuSelectTeleportWillWithPolicy : null, playerKey); },
        cell_teleport: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectCellTeleportWillWithPolicy === 'function' ? cpuSelectCellTeleportWillWithPolicy : null, playerKey); },
        tempt: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectTemptWillWithPolicy === 'function' ? cpuSelectTemptWillWithPolicy : null, playerKey); },
        capture: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectCaptureWillWithPolicy === 'function' ? cpuSelectCaptureWillWithPolicy : null, playerKey); },
        time_bomb: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectTimeBombWithPolicy === 'function' ? cpuSelectTimeBombWithPolicy : null, playerKey); },
        board_expansion: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectBoardExpansionWillWithPolicy === 'function' ? cpuSelectBoardExpansionWillWithPolicy : null, playerKey); },
        board_shrink: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectBoardShrinkWithPolicy === 'function' ? cpuSelectBoardShrinkWithPolicy : null, playerKey); },
        blockade: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectBlockadeWillWithPolicy === 'function' ? cpuSelectBlockadeWillWithPolicy : null, playerKey); },
        meteor: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectMeteorWillWithPolicy === 'function' ? cpuSelectMeteorWillWithPolicy : null, playerKey); },
        freeze: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectFreezeWillWithPolicy === 'function' ? cpuSelectFreezeWillWithPolicy : null, playerKey); },
        seed: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectSeedWillWithPolicy === 'function' ? cpuSelectSeedWillWithPolicy : null, playerKey); },
        clone: async () => { await runOptionalCpuPendingSelectionHandler(typeof cpuSelectCloneWillWithPolicy === 'function' ? cpuSelectCloneWillWithPolicy : null, playerKey); }
    };
}

function getPendingTypeHandlers(playerKey: PlayerKey) {
    const dispatchHandlers = getPendingDispatchHandlers(playerKey);
    return {
        DESTROY_ONE_STONE: dispatchHandlers.destroy,
        STRONG_WIND_WILL: dispatchHandlers.strong_wind,
        SUPER_BUOYANCY_WILL: dispatchHandlers.super_buoyancy,
        SUPER_GRAVITY_WILL: dispatchHandlers.super_gravity,
        HEAVEN_BLESSING: dispatchHandlers.heaven_blessing,
        CONDEMN_WILL: dispatchHandlers.condemn,
        SWAP_WITH_ENEMY: dispatchHandlers.swap_with_enemy,
        POSITION_SWAP_WILL: dispatchHandlers.position_swap,
        TRAP_WILL: dispatchHandlers.trap,
        GUARD_WILL: dispatchHandlers.guard,
        GUARDIAN_GOD: dispatchHandlers.guard,
        LIVING_WILL: dispatchHandlers.living_will,
        HYPERACTIVE_INHERIT_WILL: dispatchHandlers.hyperactive_inherit,
        EXTEND_LIFE_WILL: dispatchHandlers.extend_life,
        EXTEND_LIFE_GOD: dispatchHandlers.extend_life,
        CORROSION_WILL: dispatchHandlers.corrosion,
        TELEPORT_WILL: dispatchHandlers.teleport,
        CELL_TELEPORT_WILL: dispatchHandlers.cell_teleport,
        TEMPT_WILL: dispatchHandlers.tempt,
        CAPTURE_WILL: dispatchHandlers.capture,
        TIME_BOMB: dispatchHandlers.time_bomb,
        BOARD_EXPANSION_WILL: dispatchHandlers.board_expansion,
        BOARD_EXPANSION_GOD: dispatchHandlers.board_expansion,
        BOARD_SHRINK_WILL: dispatchHandlers.board_shrink,
        BOARD_SHRINK_GOD: dispatchHandlers.board_shrink,
        BLOCKADE_WILL: dispatchHandlers.blockade,
        METEOR_WILL: dispatchHandlers.meteor,
        FREEZE_WILL: dispatchHandlers.freeze,
        SEED_WILL: dispatchHandlers.seed,
        CLONE_WILL: dispatchHandlers.clone
    };
}

async function processCpuTurn(): Promise<void> {
    if (isHumanVsHumanModeEnabled()) {
        setCpuProcessing(false);
        return;
    }
    const localIsCardAnimating = (typeof isCardAnimating !== 'undefined') ? !!isCardAnimating : false;
    debugCpuTrace('[DEBUG][processCpuTurn] enter', {
        isProcessing: readCpuProcessing(),
        isCardAnimating: localIsCardAnimating,
        gameStateCurrentPlayer: gameState && gameState.currentPlayer
    });
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        setCpuProcessing(false);
        debugCpuTrace('[DEBUG][processCpuTurn] skip: game over');
        return;
    }
    const cpuTurnOwnerKey = resolveCpuControlledTurnOwnerKey();
    if (!gameState || !cpuTurnOwnerKey) {
        setCpuProcessing(false);
        debugCpuTrace('[DEBUG][processCpuTurn] skip: no local CPU-controlled turn');
        return;
    }
    if (readCpuProcessing() || isUiAnimationBusy()) {
        scheduleRunCpuTurn(cpuTurnOwnerKey, { autoMode: false }, getAnimationRetryDelayMs());
        debugCpuTrace('[DEBUG][processCpuTurn] defer: busy');
        return;
    }
    runCpuTurn(cpuTurnOwnerKey, { autoMode: false });
    debugCpuTrace('[DEBUG][processCpuTurn] exit');
}

async function processAutoBlackTurn(): Promise<void> {
    if (isHumanVsHumanModeEnabled()) return;
    // Re-enabled for Auto mode: invoke black run with autoMode flag
    if (typeof isGameOver === 'function' && gameState && isGameOver(gameState)) {
        if (typeof showResult === 'function') showResult();
        setCpuProcessing(false);
        return;
    }
    if (readCpuProcessing() || isUiAnimationBusy()) return;
    if (gameState.currentPlayer !== CONST_BLACK) return;
    return runCpuTurn('black', { autoMode: true });
}

async function runCpuTurn(playerKey: PlayerKey, { autoMode = false }: { autoMode?: boolean } = {}): Promise<void> {
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
        setCpuProcessing(false);
        return;
    }
    if (currentPlayerKey && currentPlayerKey !== playerKey) {
        debugCpuTrace('[AI] runCpuTurn aborted: out-of-turn invocation', {
            playerKey,
            currentPlayer,
            autoMode
        });
        setCpuProcessing(false);
        return;
    }

    if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
        debugLog(`[AI] Starting CPU turn for ${playerKey}`, 'info', {
            playerKey,
            isWhite,
            autoMode,
            hasUsedCard: cardState.hasUsedCardThisTurnByPlayer[playerKey],
            pendingEffect: !!readCpuPendingSelection(playerKey)
        });
    }

    // Re-entrancy guard: prevent multiple concurrent runCpuTurn invocations
    // which can happen when processCpuTurn fires during a card-use resume window
    if (readCpuProcessing()) {
        debugCpuTrace('[AI] runCpuTurn deferred: processing already active', {
            playerKey,
            autoMode
        });
        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
        return;
    }

    setCpuProcessing(true);

    if (isUiAnimationBusy()) {
        setCpuProcessing(false);
        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
        return;
    }

    try {
        const level = (typeof cpuSmartness !== 'undefined' && cpuSmartness && Number.isFinite(cpuSmartness[playerKey]))
            ? cpuSmartness[playerKey]
            : 1;
        const hasUsedCardThisTurn = !!(cardState && cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer[playerKey]);
        const hasPendingSelection = !!readCpuPendingSelection(playerKey);

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
                setCpuProcessing(false);
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
                setCpuProcessing(false);
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

        let pending = readCpuPendingSelection(playerKey);

        if (pending && pending.stage === 'selectTarget') {
            emitCpuCommentary('card_targeted', playerKey, {
                level,
                pendingType: pending.type || ''
            });
        }

        // Use shared pending-dispatch keys so human/CPU paths do not duplicate type aliases.
        if (pending && pending.stage === 'selectTarget') {
            const pendingDispatchKey = resolvePendingSelectionDispatchKeyForCpu(pending.type);
            const handler = pendingDispatchKey ? getPendingDispatchHandlers(playerKey)[pendingDispatchKey] : null;
            if (handler) {
                if (typeof isDebugLogAvailable === 'function' && isDebugLogAvailable()) {
                    debugLog(`[AI] CPU selecting ${pending.type.replace(/_/g, ' ').toLowerCase()} target`, 'debug', { playerKey, pendingEffect: pending });
                }
                await handler();
                if (shouldAbortCpuForHumanMode(playerKey, 'after_pending_selection')) {
                    return;
                }
                pending = readCpuPendingSelection(playerKey);
                if (isUiAnimationBusy()) {
                    setCpuProcessing(false);
                    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                    return;
                }
                const activePlayerAfterSelection = gameState ? gameState.currentPlayer : null;
                const activePlayerKeyAfterSelection = (activePlayerAfterSelection === CONST_BLACK || activePlayerAfterSelection === 'black')
                    ? 'black'
                    : ((activePlayerAfterSelection === CONST_WHITE || activePlayerAfterSelection === 'white') ? 'white' : null);
                if (activePlayerKeyAfterSelection && activePlayerKeyAfterSelection !== playerKey) {
                    resetPendingSelectRetryState(playerKey);
                    setCpuProcessing(false);
                    return;
                }
                // Continue-turn selection cards may keep pending selectTarget
                // after one application. Do not proceed to normal move generation/pass until
                // selection flow is finished.
                if (pending && pending.stage === 'selectTarget') {
                    if (shouldAbortStuckPendingSelection(playerKey, pending)) {
                        // Safety valve: avoid infinite retry loops when a selector cannot progress.
                        clearCpuPendingSelection(playerKey);
                        resetPendingSelectRetryState(playerKey);
                        setCpuProcessing(false);
                        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                        return;
                    }
                    setCpuProcessing(false);
                    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                    return;
                }
            } else {
                if (shouldAbortStuckPendingSelection(playerKey, pending)) {
                    clearCpuPendingSelection(playerKey);
                    resetPendingSelectRetryState(playerKey);
                }
                setCpuProcessing(false);
                scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                return;
            }
        }

        resetPendingSelectRetryState(playerKey);

        const protection = getActiveProtectionSafe(selfColor);
        const perma = getFlipBlockersSafe();
        const candidateMoves = generateMovesForPlayer(selfColor, pending, protection, perma);

        if (!candidateMoves.length) {
            const stillUsableCard = (cpuCardLogic && typeof cpuCardLogic.hasUsableCard === 'function')
                ? !!cpuCardLogic.hasUsableCard(cardState, gameState, playerKey)
                : false;
            if (stillUsableCard) {
                const expectedRetryTurnNumber = getCurrentTurnNumberSafe();
                const onnxCardDecision = await maybeUseCardFromOnnx(playerKey, level, 0, []);
                if (shouldAbortCpuForHumanMode(playerKey, 'after_onnx_retry')) {
                    return;
                }
                const currentPlayerKeyAfterOnnx = getCurrentPlayerKeySafe();
                const currentTurnNumberAfterOnnx = getCurrentTurnNumberSafe();
                if (
                    (currentPlayerKeyAfterOnnx && currentPlayerKeyAfterOnnx !== playerKey) ||
                    (expectedRetryTurnNumber !== null && currentTurnNumberAfterOnnx !== expectedRetryTurnNumber)
                ) {
                    setCpuProcessing(false);
                    return;
                }
                let retried = !!(onnxCardDecision && onnxCardDecision.applied === true);
                if (!retried && typeof cpuMaybeUseCardWithPolicy === 'function') {
                    retried = (typeof cpuMaybeUseCardWithPolicy === 'function') ? cpuMaybeUseCardWithPolicy(playerKey) : false;
                }
                if (!retried) {
                    retried = tryApplyAnyUsableCard(playerKey);
                }
                if (retried) {
                    setCpuProcessing(false);
                    scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                    return;
                }
                // Avoid illegal-pass spam: keep turn and retry later.
                setCpuProcessing(false);
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
                setCpuProcessing(false);
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
                setCpuProcessing(false);
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
                setCpuProcessing(false);
                return;
            }
            if (isUiAnimationBusy()) {
                scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
                setCpuProcessing(false);
                return;
            }
            const cornersBeforeMove = countOwnedBasicCornersSafe(gameState, playerKey);
            if (!Array.isArray(cardState.presentationEvents)) cardState.presentationEvents = [];
            cardState.presentationEvents.push({ type: 'PLAY_HAND_ANIMATION', player: playerKey, row: move.row, col: move.col });
            executeMove(move);
            const cornersAfterMove = countOwnedBasicCornersSafe(gameState, playerKey);
            if (cornersAfterMove > cornersBeforeMove) {
                emitCpuCommentary('turn_start', playerKey, { level });
            }
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
        // Clear stuck pending to prevent infinite retry loop
        const stuckPending = readCpuPendingSelection(playerKey);
        if (stuckPending) {
            debugCpuTrace('[AI] clearing stuck pending after CPU error', {
                playerKey,
                pendingType: stuckPending.type || 'unknown',
                error: error && error.message ? error.message : String(error)
            });
            clearCpuPendingSelection(playerKey);
        }
        setCpuProcessing(false);
        // If it's a critical logic error, we might want to skip the turn or alert the user
        if (typeof emitLogAdded === 'function') {
            emitLogAdded(`${selfName}の思考中にエラーが発生しました`);
        }
        resetPendingSelectRetryState(playerKey);
        // Schedule retry so the game doesn't freeze permanently
        scheduleRunCpuTurn(playerKey, { autoMode }, getAnimationRetryDelayMs());
    }
}

export = {
    processCpuTurn,
    processAutoBlackTurn,
    setTimers,
    getTimers,
    setCpuTurnTimerService,
    setCpuUIImpl,
    scheduleRetry,
    getPendingTypeHandlers,
    runCpuTurn,
    resetCpuTurnHandlerState,
    PresentationRuntime: presentationRuntime
};

// Prefer registering these functions with UIBootstrap so UI can access them via a canonical API
try {
    const uiBootstrap = _require('../shared/ui-bootstrap-shared');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
        uiBootstrap.registerUIGlobals({ processCpuTurn, processAutoBlackTurn, GamePresentationRuntime: presentationRuntime });
    }
} catch (e) { /* ignore in headless contexts */ }
// Browser fallback: if UI is loaded via globals, register into globalThis.UIBootstrap
try {
    if (typeof globalThis !== 'undefined' && globalThis.UIBootstrap && typeof globalThis.UIBootstrap.registerUIGlobals === 'function') {
        globalThis.UIBootstrap.registerUIGlobals({ processCpuTurn, processAutoBlackTurn, GamePresentationRuntime: presentationRuntime });
    } else if (typeof globalThis !== 'undefined') {
        // Wait for bootstrap to become available (IDed by globalThis.UIBootstrap) and register when ready.
        // Avoid polling during tests (Jest) to prevent keeping the event loop open.
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
            // Skip polling in test environment
        } else {
            let tries = 0;
            const maxTries = 50; // ~5 seconds @ 100ms
            const timerService = getCpuTurnTimerService();
            const schedulePoll = timerService ? timerService.setInterval.bind(timerService) : setInterval;
            const clearPoll = timerService ? timerService.clearInterval.bind(timerService) : clearInterval;
            const tid = schedulePoll(() => {
                tries += 1;
                try {
                    if (globalThis.UIBootstrap && typeof globalThis.UIBootstrap.registerUIGlobals === 'function') {
                        globalThis.UIBootstrap.registerUIGlobals({ processCpuTurn, processAutoBlackTurn, GamePresentationRuntime: presentationRuntime });
                        clearPoll(tid);
                        return;
                    }
                } catch (e) { /* ignore during polling */ }
                if (tries >= maxTries) clearPoll(tid);
            }, 100);
        }
    }
} catch (e) { /* ignore */ }

// @compat - Legacy entry points; expose to globalThis for immediate fallback in browser contexts
try {
    if (typeof globalThis !== 'undefined') {
        try { globalThis.processCpuTurn = processCpuTurn; } catch (e) { /* Intentionally empty: compat global assignment */ } // @compat
        try { globalThis.processAutoBlackTurn = processAutoBlackTurn; } catch (e) { /* Intentionally empty: compat global assignment */ } // @compat
        try { globalThis.GamePresentationRuntime = presentationRuntime; } catch (e) { /* Intentionally empty: compat global assignment */ } // @compat
    }
} catch (e) { /* ignore */ }
