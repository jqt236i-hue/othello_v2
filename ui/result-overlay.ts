
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

/**
 * @file result-overlay.js
 * @description ゲーム終了時の結果表示オーバーレイ
 */

const LeaderboardScore = _require('../shared/leaderboard-score');
const ResultOverlayCpuOpponentProfiles = _require('../shared/cpu-opponent-profiles');
const SCORE_CONFIG = LeaderboardScore.SCORE_CONFIG;

const SCORE_LEADERBOARD_STORAGE_KEY = `othello_cpu_leaderboard_v${SCORE_CONFIG.version}`;
const TIME_ATTACK_LIMIT_MS = 900000;
const _observationStoneRewardByToken = new Map();
const RESULT_REOPEN_BUTTON_ID = 'result-reopen-button';
const RESULT_REOPEN_BUTTON_CLASS = 'result-reopen-button';
const RESULT_REOPEN_CONTAINER_CLASS = 'has-result-reopen-button';
const RESULT_STYLE_WARNING_CLASS = 'result-style-load-warning';
const RESULT_STYLE_FALLBACK_CLASS = 'result-style-fallback';

// Module-level token: survives gameState replacement by network snapshots.
// Updated each time showResult() is called so stale delayed callbacks can detect
// that a newer invocation has superseded them.
let _pendingResultToken: any = null;
let _resultPresentationActive = false;
let _timeAttackStartedAt: number | null = null;
let _leaderboardClientLoadPromise: Promise<any> | null = null;

function markTimeAttackStarted(startedAt?: any) {
    if (_timeAttackStartedAt !== null) return _timeAttackStartedAt;
    const value = Number.isFinite(Number(startedAt)) ? Math.trunc(Number(startedAt)) : Date.now();
    _timeAttackStartedAt = Math.max(0, value);
    return _timeAttackStartedAt;
}

function resetTimeAttackStarted() {
    _timeAttackStartedAt = null;
}

function formatTimeAttackDuration(ms: any): string {
    const value = Number(ms);
    if (!Number.isFinite(value) || value <= 0) return '--';
    const normalized = Math.trunc(value);
    const centiseconds = Math.floor((normalized % 1000) / 10);
    const totalSeconds = Math.floor(normalized / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function resolveResultOverlayModuleOrNull(id: string, globalName: string): any {
    if (typeof require === 'function') {
        try {
            return require(id);
        } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalName]) {
            return (globalThis as any)[globalName];
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

const ResultOverlayOwnerHelpersModule = resolveResultOverlayModuleOrNull('../utils/owner-helpers', 'OwnerHelpers');
const ResultOverlayGachaHelpersModule = resolveResultOverlayModuleOrNull('../shared/gacha-helpers', 'GachaHelpersModule');
const ResultOverlayGachaProgressModule = resolveResultOverlayModuleOrNull('./storage/gacha-progress', 'GachaProgressStorageModule');
const ResultOverlayBoardUtilsModule = resolveResultOverlayModuleOrNull('../shared/shared-board-utils', 'SharedBoardUtils');
const ResultOverlaySoundEngineAccessModule = resolveResultOverlayModuleOrNull('./sound-engine-access', 'SoundEngineAccessModule');
const ResultOverlayLazyFeatureSurfaceModule = resolveResultOverlayModuleOrNull('./assets/lazy-feature-surface', 'LazyFeatureSurface');
const ResultOverlayCpuProfileSelectionModule = resolveResultOverlayModuleOrNull('./cpu-profile-selection', 'CpuProfileSelection');

function clearResultStyleFallback(documentRef: Document): void {
    const overlay = documentRef.getElementById('result-overlay');
    if (overlay) overlay.classList.remove(RESULT_STYLE_FALLBACK_CLASS);
    const warning = documentRef.querySelector(`.${RESULT_STYLE_WARNING_CLASS}`);
    if (warning && warning.parentNode) warning.parentNode.removeChild(warning);
}

function showResultStyleFallback(documentRef: Document): void {
    const overlay = documentRef.getElementById('result-overlay');
    const panel = overlay?.querySelector('.result-panel');
    if (!overlay || !panel) return;
    overlay.classList.add(RESULT_STYLE_FALLBACK_CLASS);
    if (panel.querySelector(`.${RESULT_STYLE_WARNING_CLASS}`)) return;
    const warning = documentRef.createElement('div');
    warning.className = RESULT_STYLE_WARNING_CLASS;
    warning.setAttribute('role', 'status');
    warning.textContent = '追加装飾を読み込めませんでした。必要な場合はページを再読み込みしてください。';
    const buttonRow = panel.querySelector('.result-btn-row');
    panel.insertBefore(warning, buttonRow || null);
}

const ResultStyleSurfaceRegistration = Object.freeze({
    id: 'result',
    stylesheetGroup: 'result',
    ensureDom: () => null,
    onReady(surface: any) {
        clearResultStyleFallback(surface.document);
    },
    onFailure(_error: Error, context: any) {
        showResultStyleFallback(context.document);
    }
});

if (ResultOverlayLazyFeatureSurfaceModule
    && typeof ResultOverlayLazyFeatureSurfaceModule.registerLazyFeatureSurface === 'function') {
    ResultOverlayLazyFeatureSurfaceModule.registerLazyFeatureSurface(ResultStyleSurfaceRegistration);
}

function prepareResultFullStylesheet(): void {
    if (!ResultOverlayLazyFeatureSurfaceModule
        || typeof ResultOverlayLazyFeatureSurfaceModule.ensureLazyFeatureSurface !== 'function'
        || typeof document === 'undefined') {
        return;
    }
    void ResultOverlayLazyFeatureSurfaceModule.ensureLazyFeatureSurface('result', document)
        .catch(() => {
            // The registered failure presentation keeps the critical result controls usable.
        });
}

function resolveResultLeaderboardClient(allowRequire = true): any {
    try {
        if (typeof window !== 'undefined' && window && (window as any).LeaderboardClient) {
            return (window as any).LeaderboardClient;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).LeaderboardClient) {
            return (globalThis as any).LeaderboardClient;
        }
    } catch (e: any) { /* ignore */ }
    if (allowRequire !== true) return null;
    try {
        const moduleRef = require('./leaderboard-client');
        if (moduleRef) {
            try {
                if (typeof window !== 'undefined' && window && !(window as any).LeaderboardClient) {
                    (window as any).LeaderboardClient = moduleRef;
                }
            } catch (e: any) { /* ignore */ }
            try {
                if (typeof globalThis !== 'undefined' && !(globalThis as any).LeaderboardClient) {
                    (globalThis as any).LeaderboardClient = moduleRef;
                }
            } catch (e: any) { /* ignore */ }
            return moduleRef;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function resolveResultLazyRuntimeGroupLoader(): any {
    try {
        if (typeof window !== 'undefined' && window && typeof (window as any).loadLazyRuntimeGroup === 'function') {
            return (window as any).loadLazyRuntimeGroup.bind(window);
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).loadLazyRuntimeGroup === 'function') {
            return (globalThis as any).loadLazyRuntimeGroup;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (
            typeof globalThis !== 'undefined'
            && (globalThis as any).LazyRuntimeLoaderModule
            && typeof (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup === 'function'
        ) {
            return (globalThis as any).LazyRuntimeLoaderModule.loadLazyRuntimeGroup;
        }
    } catch (e: any) { /* ignore */ }
    try {
        const moduleRef = require('./bootstrap/lazy-runtime-loader');
        if (moduleRef && typeof moduleRef.loadLazyRuntimeGroup === 'function') {
            return moduleRef.loadLazyRuntimeGroup;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function ensureResultLeaderboardClient(methodName: string = 'submitScore'): Promise<any> {
    const existing = resolveResultLeaderboardClient(false);
    if (existing && typeof existing[methodName] === 'function') return Promise.resolve(existing);

    if (!_leaderboardClientLoadPromise) {
        const loadLazyRuntimeGroup = resolveResultLazyRuntimeGroupLoader();
        if (typeof loadLazyRuntimeGroup === 'function') {
            _leaderboardClientLoadPromise = Promise.resolve(loadLazyRuntimeGroup('leaderboard'))
                .then(() => resolveResultLeaderboardClient(true))
                .catch(() => null)
                .finally(() => {
                    if (!resolveResultLeaderboardClient(false)) {
                        _leaderboardClientLoadPromise = null;
                    }
                });
        } else {
            _leaderboardClientLoadPromise = Promise.resolve(resolveResultLeaderboardClient(true)).finally(() => {
                if (!resolveResultLeaderboardClient(false)) {
                    _leaderboardClientLoadPromise = null;
                }
            });
        }
    }

    return _leaderboardClientLoadPromise.then((client: any) => {
        if (client && typeof client[methodName] === 'function') return client;
        return null;
    });
}

function createEmptyResultPresentationState() {
    return {
        lastResultVersionShown: null,
        resultShownForUnversioned: false,
        terminalResultShown: false
    };
}

function ensureResultPresentationState(resultState: any) {
    if (!resultState || typeof resultState !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(resultState, 'lastResultVersionShown')) {
        resultState.lastResultVersionShown = null;
    }
    if (!Object.prototype.hasOwnProperty.call(resultState, 'resultShownForUnversioned')) {
        resultState.resultShownForUnversioned = false;
    }
    if (!Object.prototype.hasOwnProperty.call(resultState, 'terminalResultShown')) {
        resultState.terminalResultShown = false;
    }
    return resultState;
}

function resetResultPresentationRuntimeState() {
    _pendingResultToken = null;
    _resultPresentationActive = false;
    resetTimeAttackStarted();
    removeResultReopenButton();
}

function resetResultPresentationState(resultState: any) {
    resetResultPresentationRuntimeState();
    const target = ensureResultPresentationState(resultState);
    if (!target) return createEmptyResultPresentationState();
    target.lastResultVersionShown = null;
    target.resultShownForUnversioned = false;
    target.terminalResultShown = false;
    return target;
}

function resolveResultSoundEngine() {
    try {
        const rootRef = (typeof window !== 'undefined')
            ? window
            : (typeof globalThis !== 'undefined' ? globalThis : null);
        if (
            ResultOverlaySoundEngineAccessModule
            && typeof ResultOverlaySoundEngineAccessModule.resolveSoundEngine === 'function'
        ) {
            const fromAccess = ResultOverlaySoundEngineAccessModule.resolveSoundEngine(rootRef);
            if (fromAccess) return fromAccess;
        }
        if (rootRef && (rootRef as any).SoundEngine) return (rootRef as any).SoundEngine;
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SoundEngine) {
            return (globalThis as any).SoundEngine;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function playResultBgmForOutcome(localOutcomeKey: any) {
    const outcomeKey = String(localOutcomeKey || '').trim();
    if (outcomeKey !== 'win' && outcomeKey !== 'lose') return false;
    const engine = resolveResultSoundEngine();
    if (!engine || typeof engine.playResultBgm !== 'function') return false;
    try {
        return !!engine.playResultBgm(outcomeKey);
    } catch (e: any) { /* ignore */ }
    return false;
}

function stopResultBgmForDismissal() {
    const engine = resolveResultSoundEngine();
    if (!engine || typeof engine.stopResultBgm !== 'function') return false;
    try {
        return !!engine.stopResultBgm({ resumeBgm: true });
    } catch (e: any) { /* ignore */ }
    return false;
}

function normalizeDiscCounts(counts: any) {
    const normalized = (counts && typeof counts === 'object') ? counts : {};
    return {
        black: Number.isFinite(Number(normalized.black)) ? Number(normalized.black) : 0,
        white: Number.isFinite(Number(normalized.white)) ? Number(normalized.white) : 0
    };
}

function resolveResultCardState() {
    try {
        return (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
            ? cardState
            : null;
    } catch (_error) {
        return null;
    }
}

function countDiscsFromBoardState(gameStateRef: any, cardStateRef: any = resolveResultCardState()) {
    const stateRef = (gameStateRef && typeof gameStateRef === 'object') ? gameStateRef : null;
    if (!stateRef || !Array.isArray(stateRef.board)) return { black: 0, white: 0 };
    if (!ResultOverlayBoardUtilsModule || typeof ResultOverlayBoardUtilsModule.countStateDiscs !== 'function') {
        throw new Error('SharedBoardUtils.countStateDiscs is required by ResultOverlay');
    }
    return normalizeDiscCounts(
        ResultOverlayBoardUtilsModule.countStateDiscs(stateRef, cardStateRef)
    );
}

function countDiscs(gameStateRef: any, cardStateRef: any = resolveResultCardState()) {
    const stateRef = (gameStateRef && typeof gameStateRef === 'object')
        ? gameStateRef
        : (typeof gameState !== 'undefined' ? gameState : null);
    try {
        if (
            typeof globalThis !== 'undefined' &&
            typeof (globalThis as any).countDiscs === 'function' &&
            (globalThis as any).countDiscs !== countDiscs
        ) {
            return normalizeDiscCounts((globalThis as any).countDiscs(stateRef, cardStateRef));
        }
    } catch (e: any) { /* ignore */ }
    return countDiscsFromBoardState(stateRef, cardStateRef);
}

function parseResultPlayerKey(value: any) {
    try {
        if (ResultOverlayOwnerHelpersModule) {
            const parsed = (typeof ResultOverlayOwnerHelpersModule.normalizePlayerKeyOptional === 'function')
                ? ResultOverlayOwnerHelpersModule.normalizePlayerKeyOptional(value)
                : (typeof ResultOverlayOwnerHelpersModule.parseSeatKeyOptional === 'function'
                    ? ResultOverlayOwnerHelpersModule.parseSeatKeyOptional(value)
                    : null);
            if (parsed === 'black' || parsed === 'white') return parsed;
        }
    } catch (e: any) { /* ignore */ }

    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return null;
}

function normalizeResultWinnerKey(value: any) {
    if (value === 'draw' || value === 0 || value === '0') return 'draw';
    const key = parseResultPlayerKey(value);
    return key || 'draw';
}

function resolveResultWinnerContext(state: any, fallbackCounts: any) {
    const counts = fallbackCounts || { black: 0, white: 0 };
    const discWinner = counts.black === counts.white
        ? 'draw'
        : (counts.black > counts.white ? 'black' : 'white');
    return { mode: 'disc', winner: normalizeResultWinnerKey(discWinner) };
}

function getLocalOutcomeKeyForResult(resultContext: any, viewerKey: any, counts: any) {
    const context = resultContext || resolveResultWinnerContext(typeof gameState !== 'undefined' ? gameState : null, counts);
    const localKey = parseResultPlayerKey(viewerKey) || 'black';
    if (!context || context.winner === 'draw') return 'draw';
    return context.winner === localKey ? 'win' : 'lose';
}

function resolveResultViewerKey() {
    try {
        if (ResultOverlayOwnerHelpersModule && typeof ResultOverlayOwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            const fromHelper = parseResultPlayerKey(ResultOverlayOwnerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null));
            if (fromHelper) return fromHelper;
        }
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof window !== 'undefined' && window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
            const seatKey = parseResultPlayerKey(window.NetworkMatchClient.getSeatKey());
            if (seatKey) return seatKey;
        }
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof window !== 'undefined') {
            const candidates = [window.LOCAL_PLAYER_KEY, window.__LOCAL_PLAYER_KEY, window.BOARD_VIEWER_KEY];
            for (const candidate of candidates) {
                const parsed = parseResultPlayerKey(candidate);
                if (parsed) return parsed;
            }
        }
    } catch (e: any) { /* ignore */ }

    return 'black';
}

function getLocalAndOpponentCountsForViewer(counts: any, viewerKey: any) {
    const localKey = parseResultPlayerKey(viewerKey) || 'black';
    const localCount = localKey === 'white' ? counts.white : counts.black;
    const opponentCount = localKey === 'white' ? counts.black : counts.white;
    return { localKey, localCount, opponentCount };
}

function getLocalOutcomeKeyForCounts(counts: any, viewerKey: any) {
    const localCounts = getLocalAndOpponentCountsForViewer(counts, viewerKey);
    if (localCounts.localCount > localCounts.opponentCount) return 'win';
    if (localCounts.localCount < localCounts.opponentCount) return 'lose';
    return 'draw';
}

function resolveResultTitleAndStatus(counts: any, viewerKey: any, resultContext: any) {
    const context = resultContext || resolveResultWinnerContext(typeof gameState !== 'undefined' ? gameState : null, counts);
    const localOutcomeKey = getLocalOutcomeKeyForResult(context, viewerKey, counts);

    const localCounts = getLocalAndOpponentCountsForViewer(counts, viewerKey);
    const occupiedCount = (Number(counts.black) || 0) + (Number(counts.white) || 0);
    const isSingleColorResult = occupiedCount > 0 &&
        (localCounts.localCount === 0 || localCounts.opponentCount === 0);

    if (localOutcomeKey === 'win') {
        if (isSingleColorResult && localCounts.opponentCount === 0) {
            return { title: '完全勝利！', statusClass: 'win perfect-win', localOutcomeKey };
        }
        return { title: '勝利！', statusClass: 'win', localOutcomeKey };
    }

    if (localOutcomeKey === 'lose') {
        if (isSingleColorResult && localCounts.localCount === 0) {
            return { title: '完全敗北...', statusClass: 'lose perfect-lose', localOutcomeKey };
        }
        return { title: '敗北...', statusClass: 'lose', localOutcomeKey };
    }

    return { title: '引き分け', statusClass: 'draw', localOutcomeKey };
}

function toFiniteInteger(value: any, fallback: any) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.floor(n);
}

function resolveCurrentMatchMode() {
    try {
        if (ResultOverlayOwnerHelpersModule && typeof ResultOverlayOwnerHelpersModule.getCurrentMatchMode === 'function') {
            const mode = ResultOverlayOwnerHelpersModule.getCurrentMatchMode(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
            if (mode === 'cpu' || mode === 'network' || mode === 'reversi') return mode;
            if (mode === 'othello') return 'reversi';
        }
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof window !== 'undefined') {
            const mode = window.MATCH_MODE || window.__MATCH_MODE;
            if (mode === 'cpu' || mode === 'network' || mode === 'reversi') return mode;
            if (mode === 'othello') return 'reversi';
        }
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
            const mode = (globalThis as any).getCurrentMatchMode();
            if (mode === 'cpu' || mode === 'network' || mode === 'reversi') return mode;
            if (mode === 'othello') return 'reversi';
        }
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof globalThis !== 'undefined') {
            const mode = (globalThis as any).MATCH_MODE || (globalThis as any).__MATCH_MODE;
            if (mode === 'cpu' || mode === 'network' || mode === 'reversi') return mode;
            if (mode === 'othello') return 'reversi';
        }
    } catch (e: any) { /* ignore */ }

    return 'cpu';
}

function isCpuMatchMode() {
    return resolveCurrentMatchMode() === 'cpu';
}

function isNetworkMatchMode() {
    return resolveCurrentMatchMode() === 'network';
}

function isNetworkSessionActiveForQuickResetButton() {
    try {
        const globalRef: any = (typeof globalThis !== 'undefined') ? globalThis : null;
        const windowRef: any = (typeof window !== 'undefined')
            ? window
            : (globalRef && globalRef.window ? globalRef.window : null);
        const client = (windowRef && windowRef.NetworkMatchClient)
            || (globalRef && globalRef.NetworkMatchClient);
        return !!(client && typeof client.isActive === 'function' && client.isActive() === true);
    } catch (e: any) {
        return false;
    }
}

function isObservationStoneRewardEligibleMatch() {
    return isCpuMatchMode() || isNetworkMatchMode();
}

function canUseScoreStorage() {
    try {
        return typeof localStorage !== 'undefined' && !!localStorage;
    } catch (e: any) {
        return false;
    }
}

function loadScoreLeaderboard() {
    const empty = { version: SCORE_CONFIG.version, cpu: {} };
    if (!canUseScoreStorage()) return empty;
    try {
        const raw = localStorage.getItem(SCORE_LEADERBOARD_STORAGE_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return empty;
        const cpu = parsed.cpu && typeof parsed.cpu === 'object' ? parsed.cpu : {};
        return { version: SCORE_CONFIG.version, cpu };
    } catch (e: any) {
        return empty;
    }
}

function saveScoreLeaderboard(payload: any) {
    if (!canUseScoreStorage()) return false;
    try {
        localStorage.setItem(SCORE_LEADERBOARD_STORAGE_KEY, JSON.stringify(payload));
        return true;
    } catch (e: any) {
        return false;
    }
}

function resolveCpuLevelForViewer(viewerKey: any) {
    const localKey = parseResultPlayerKey(viewerKey) || 'black';
    const enemyKey = localKey === 'white' ? 'black' : 'white';
    const source = (typeof cpuSmartness !== 'undefined' && cpuSmartness && typeof cpuSmartness === 'object')
        ? cpuSmartness
        : null;
    let raw = source ? source[enemyKey] : null;
    if (raw === null || typeof raw === 'undefined' || raw === '') {
        try {
            if (ResultOverlayCpuProfileSelectionModule
                && typeof ResultOverlayCpuProfileSelectionModule.readCpuProfileValueFromSelect === 'function') {
                raw = ResultOverlayCpuProfileSelectionModule.readCpuProfileValueFromSelect(
                    enemyKey,
                    typeof document !== 'undefined' ? document : null
                );
            }
        } catch (e: any) { /* fall back to legacy source/default */ }
    }
    if (raw === null || typeof raw === 'undefined' || raw === '') {
        raw = source ? (source.white ?? source.black ?? 1) : 1;
    }
    return ResultOverlayCpuOpponentProfiles.getCpuOpponentLevel(raw);
}

function resolveTurnCountForScore() {
    return LeaderboardScore.resolveLeaderboardTurnCount(
        typeof gameState !== 'undefined' ? gameState : null,
        typeof cardState !== 'undefined' ? cardState : null
    );
}

function readResultDebugFlag(rootRef: any, key: string): boolean {
    try {
        if (rootRef && rootRef[key] === true) return true;
        if (rootRef && rootRef.__uiImpl && rootRef.__uiImpl[key] === true) return true;
        if (rootRef && rootRef.__uiImpl_turn_manager && rootRef.__uiImpl_turn_manager[key] === true) return true;
    } catch (e: any) { /* ignore */ }
    return false;
}

function isDebugScoreSuppressed(): boolean {
    try {
        const roots = [
            typeof window !== 'undefined' ? window : null,
            typeof globalThis !== 'undefined' ? globalThis : null
        ];
        for (const rootRef of roots) {
            if (readResultDebugFlag(rootRef, 'DEBUG_UNLIMITED_USAGE')) return true;
            if (readResultDebugFlag(rootRef, 'DEBUG_HUMAN_VS_HUMAN')) return true;
        }
    } catch (e: any) { /* ignore */ }

    try {
        const doc = typeof document !== 'undefined' ? document : null;
        const debugModeBtn = doc ? doc.getElementById('debugModeBtn') : null;
        if (!debugModeBtn) return false;
        if (debugModeBtn.getAttribute('aria-pressed') === 'true') return true;
        if ((debugModeBtn as HTMLElement).dataset && (debugModeBtn as HTMLElement).dataset.active === 'true') return true;
        if (String(debugModeBtn.textContent || '').indexOf('ON') >= 0) return true;
    } catch (e: any) { /* ignore */ }
    return false;
}

function resolveResultBoardConfig(): any {
    try {
        const stateRef = (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object')
            ? gameState
            : null;
        const explicit = stateRef && stateRef.boardConfig && typeof stateRef.boardConfig === 'object'
            ? stateRef.boardConfig
            : null;
        const explicitRows = Number(explicit && explicit.rows);
        const explicitCols = Number(explicit && explicit.cols);
        if (Number.isFinite(explicitRows) && Number.isFinite(explicitCols)) {
            const rows = Math.trunc(explicitRows);
            const cols = Math.trunc(explicitCols);
            const shape = String(explicit && explicit.shape || '').toLowerCase() === 'circle' ? 'circle' : 'rectangle';
            return {
                rows,
                cols,
                shape,
                standard8x8: shape === 'rectangle' && (explicit.standard8x8 === true || (rows === 8 && cols === 8))
            };
        }

        const board = stateRef && Array.isArray(stateRef.board) ? stateRef.board : null;
        if (!board || board.length <= 0) return null;
        let cols = 0;
        for (let index = 0; index < board.length; index += 1) {
            if (Array.isArray(board[index])) cols = Math.max(cols, board[index].length);
        }
        if (cols <= 0) return null;
        return {
            rows: board.length,
            cols,
            shape: 'rectangle',
            standard8x8: board.length === 8 && cols === 8
        };
    } catch (e: any) { /* ignore */ }
    return null;
}

function isResultRankingBoardEligible(): boolean {
    const boardConfig = resolveResultBoardConfig();
    if (!boardConfig) return true;
    return boardConfig.standard8x8 === true
        && Math.trunc(Number(boardConfig.rows)) === 8
        && Math.trunc(Number(boardConfig.cols)) === 8;
}

function computeScoreSummaryForViewer(options: any) {
    const opts = options || {};
    const counts = opts.counts || { black: 0, white: 0 };
    const viewerKey = parseResultPlayerKey(opts.viewerKey) || 'black';
    return LeaderboardScore.computeLeaderboardScoreSummary({
        counts,
        playerKey: viewerKey,
        localOutcomeKey: opts.localOutcomeKey,
        turnCount: resolveTurnCountForScore(),
        flipTotals: opts.flipTotals,
        debugSuppressed: isDebugScoreSuppressed()
    });
}

function updateCpuLeaderboard(scoreSummary: any, viewerKey: any) {
    const cpuLevel = resolveCpuLevelForViewer(viewerKey);
    if (!isResultRankingBoardEligible()) {
        return { mode: 'custom-board', enabled: false, cpuLevel, bestScore: null, updated: false, previousBest: null };
    }
    if (isDebugScoreSuppressed()) {
        return { mode: 'debug', enabled: false, cpuLevel, bestScore: null, updated: false, previousBest: null };
    }
    if (!isCpuMatchMode()) {
        return { mode: 'network', enabled: false, cpuLevel, bestScore: null, updated: false, previousBest: null };
    }

    if (!canUseScoreStorage()) {
        return { mode: 'cpu', enabled: false, cpuLevel, bestScore: scoreSummary.total, updated: false, previousBest: null };
    }

    const leaderboard = loadScoreLeaderboard();
    const key = String(cpuLevel);
    const current = leaderboard.cpu[key] && typeof leaderboard.cpu[key] === 'object'
        ? leaderboard.cpu[key]
        : {};
    const previousBest = Math.max(0, toFiniteInteger(current.bestScore, 0));
    const nextScore = Math.max(0, toFiniteInteger(scoreSummary.total, 0));
    const updated = nextScore > previousBest;
    const bestScore = updated ? nextScore : previousBest;

    leaderboard.cpu[key] = {
        bestScore,
        lastScore: nextScore,
        updatedAt: updated ? new Date().toISOString() : (current.updatedAt || null),
        scoreVersion: SCORE_CONFIG.version,
        turnCount: scoreSummary.turnCount
    };
    saveScoreLeaderboard(leaderboard);

    return { mode: 'cpu', enabled: true, cpuLevel, bestScore, updated, previousBest };
}

function createScoreSummaryRow(label: any, value: any) {
    const row = document.createElement('div');
    row.className = 'result-score-breakdown-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'result-score-breakdown-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'result-score-breakdown-value';
    valueEl.textContent = `${value}`;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
}

function createResultDiscCountsLine(counts: any) {
    const line = document.createElement('div');
    line.className = 'result-counts';

    const blackCount = Math.max(0, toFiniteInteger(counts && counts.black, 0));
    const whiteCount = Math.max(0, toFiniteInteger(counts && counts.white, 0));
    line.textContent = `黒 ${blackCount}枚 / 白 ${whiteCount}枚`;

    return line;
}

function createScoreMetaLine(scoreSummary: any, leaderboardState: any) {
    const line = document.createElement('div');
    line.className = 'result-score-meta';

    if (!leaderboardState || leaderboardState.mode === 'network') {
        line.textContent = 'スコアランキング: MATCHのランキングボタンで確認（終局時に自動送信）';
        return line;
    }

    const bestScore = leaderboardState.enabled
        ? Math.max(0, toFiniteInteger(leaderboardState.bestScore, 0))
        : Math.max(0, toFiniteInteger(scoreSummary.total, 0));
    const updatedSuffix = (leaderboardState.enabled && leaderboardState.updated) ? '（自己最高更新）' : '';
    line.textContent = `CPU Lv${leaderboardState.cpuLevel} 最高点 ${bestScore}${updatedSuffix}`;
    return line;
}

function resolveTimeAttackSummary(localOutcomeKey: any, options?: any) {
    const opts = options || {};
    const startedAt = Number.isFinite(Number(opts.startedAt))
        ? Math.max(0, Math.trunc(Number(opts.startedAt)))
        : _timeAttackStartedAt;
    const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.trunc(Number(opts.nowMs)) : Date.now();
    const debugSuppressed = isDebugScoreSuppressed();
    const elapsedMs = startedAt !== null ? Math.max(0, Math.trunc(nowMs - Number(startedAt))) : null;
    const won = localOutcomeKey === 'win';
    const overLimit = Number.isFinite(Number(elapsedMs)) && Number(elapsedMs) > TIME_ATTACK_LIMIT_MS;
    const eligible = won && !debugSuppressed && elapsedMs !== null && elapsedMs > 0 && !overLimit;

    return {
        eligible,
        elapsedMs: eligible ? elapsedMs : null,
        rawElapsedMs: elapsedMs,
        overLimit,
        debugSuppressed,
        won
    };
}

function createTimeAttackLine(summary: any) {
    const line = document.createElement('div');
    line.className = 'result-time-attack';
    const elapsedText = summary && summary.eligible
        ? formatTimeAttackDuration(summary.elapsedMs)
        : '--';
    line.textContent = `速攻 ${elapsedText}`;
    if (summary && summary.overLimit) {
        const reason = document.createElement('span');
        reason.className = 'result-time-attack-reason';
        reason.textContent = '15:00超過';
        line.appendChild(reason);
    }
    return line;
}

function resolveTimeDefenseSummary(localOutcomeKey: any, scoreSummary: any) {
    const debugSuppressed = isDebugScoreSuppressed();
    const won = localOutcomeKey === 'win';
    const turnCount = scoreSummary && Number.isFinite(Number(scoreSummary.turnCount))
        ? Math.max(0, toFiniteInteger(scoreSummary.turnCount, 0))
        : resolveTurnCountForScore();
    const eligible = won && !debugSuppressed && turnCount > 0;

    return {
        eligible,
        turnCount: eligible ? turnCount : null,
        rawTurnCount: turnCount,
        debugSuppressed,
        won
    };
}

function createTimeDefenseLine(summary: any) {
    if (!summary || summary.eligible !== true) return null;
    const line = document.createElement('div');
    line.className = 'result-time-defense';
    line.textContent = `${Math.max(1, toFiniteInteger(summary.turnCount, 1))}手で勝利`;
    return line;
}

function resolveObservationStoneModules(): any {
    return {
        helpers: resolveResultOverlayModuleOrNull('../shared/gacha-helpers', 'GachaHelpersModule')
            || ResultOverlayGachaHelpersModule,
        progress: resolveResultOverlayModuleOrNull('./storage/gacha-progress', 'GachaProgressStorageModule')
            || ResultOverlayGachaProgressModule
    };
}

function canUseObservationStoneProgress(modules?: any) {
    const resolved = modules || resolveObservationStoneModules();
    return !!(
        resolved.helpers
        && resolved.progress
        && typeof resolved.progress.getObservationStones === 'function'
        && typeof resolved.progress.awardObservationStones === 'function'
    );
}

function getObservationStoneBalanceForResult(modules?: any) {
    const resolved = modules || resolveObservationStoneModules();
    if (!canUseObservationStoneProgress(resolved)) return 0;
    const rootRef = (typeof window !== 'undefined' && window)
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    return Math.max(0, toFiniteInteger(resolved.progress.getObservationStones(rootRef), 0));
}

function resolveObservationStoneRewardToken(counts: any, viewerKey: any, localOutcomeKey: any) {
    if (typeof gameState !== 'undefined' && gameState && Number.isFinite(Number(gameState.__resultToken))) {
        return `result:${Math.trunc(Number(gameState.__resultToken))}`;
    }

    const blackCount = Math.max(0, toFiniteInteger(counts && counts.black, 0));
    const whiteCount = Math.max(0, toFiniteInteger(counts && counts.white, 0));
    const turnCount = resolveTurnCountForScore();
    return `fallback:${resolveCurrentMatchMode()}:${String(viewerKey || 'black')}:${String(localOutcomeKey || 'draw')}:${blackCount}:${whiteCount}:${turnCount}`;
}

function resolveObservationStoneRewardSummary(counts: any, viewerKey: any, localOutcomeKey: any) {
    const modules = resolveObservationStoneModules();
    const baseSummary = {
        visible: false,
        eligible: false,
        granted: false,
        base: 0,
        bonus: 0,
        total: 0,
        balance: getObservationStoneBalanceForResult(modules)
    };

    if (!canUseObservationStoneProgress(modules)) {
        return baseSummary;
    }
    if (!isObservationStoneRewardEligibleMatch()) {
        return baseSummary;
    }

    const token = resolveObservationStoneRewardToken(counts, viewerKey, localOutcomeKey);
    if (_observationStoneRewardByToken.has(token)) {
        const cached = _observationStoneRewardByToken.get(token);
        return Object.assign({}, cached, {
            balance: getObservationStoneBalanceForResult(modules)
        });
    }

    const rootRef = (typeof window !== 'undefined' && window)
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    const baseReward = Math.max(
        0,
        toFiniteInteger(modules.helpers.OBSERVATION_STONE_REWARD_BASE, 100)
    );
    const bonusReward = localOutcomeKey === 'win' && (typeof modules.helpers.rollObservationBonus === 'function')
        ? Math.max(0, toFiniteInteger(modules.helpers.rollObservationBonus(), 0))
        : 0;
    const totalReward = baseReward + bonusReward;

    modules.progress.awardObservationStones(rootRef, totalReward);

    const rewardSummary = Object.assign({}, baseSummary, {
        visible: true,
        eligible: true,
        granted: true,
        base: baseReward,
        bonus: bonusReward,
        total: totalReward,
        token
    });
    _observationStoneRewardByToken.set(token, rewardSummary);

    return Object.assign({}, rewardSummary, {
        balance: getObservationStoneBalanceForResult(modules)
    });
}

function createObservationStoneLine(summary: any) {
    if (!summary || summary.visible !== true) return null;

    const line = document.createElement('div');
    line.className = 'result-observation-stones';
    const icon = document.createElement('span');
    icon.className = 'observation-stone-icon';
    icon.setAttribute('aria-hidden', 'true');
    line.appendChild(icon);

    const text = document.createElement('span');
    text.className = 'result-observation-stone-text';
    if (summary.eligible === true) {
        text.textContent = `観測石 +${summary.total}（基本${summary.base} / 追加${summary.bonus}） / 所持 ${summary.balance}`;
        line.appendChild(text);
        return line;
    }
}

function resolveNetworkRatedMatchForResult(): any {
    try {
        const networkClient = (typeof window !== 'undefined' && window) ? window.NetworkMatchClient : null;
        if (networkClient && typeof networkClient.getRatedMatch === 'function') {
            return networkClient.getRatedMatch();
        }
        if (networkClient && typeof networkClient.getState === 'function') {
            const state = networkClient.getState();
            if (state && state.ratedMatch) return state.ratedMatch;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).__NETWORK_RATED_MATCH) {
            return (globalThis as any).__NETWORK_RATED_MATCH;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function formatRatingDelta(value: any): string {
    const delta = Number(value);
    if (!Number.isFinite(delta) || Math.trunc(delta) === 0) return '±0';
    return delta > 0 ? `+${Math.trunc(delta)}` : `${Math.trunc(delta)}`;
}

function createRatedRatingLine(viewerKey: any): HTMLElement | null {
    const ratedMatch = resolveNetworkRatedMatchForResult();
    if (!ratedMatch || typeof ratedMatch !== 'object') return null;
    if (String(ratedMatch.ratingStatus || '').trim() === 'failed') {
        const pendingLine = document.createElement('div');
        pendingLine.className = 'result-rating-line is-pending';
        pendingLine.textContent = 'レート更新を確認中';
        try {
            const windowRef: any = (typeof window !== 'undefined' && window) ? window : null;
            const networkClient = windowRef ? windowRef.NetworkMatchClient : null;
            const identity = (windowRef && windowRef.PlayerIdentity && typeof windowRef.PlayerIdentity.getPlayerIdentity === 'function')
                ? windowRef.PlayerIdentity.getPlayerIdentity()
                : null;
            if (networkClient && typeof networkClient.getMyRating === 'function' && identity && identity.playerId) {
                void networkClient.getMyRating(identity.playerId).catch(() => undefined);
            }
        } catch (e: any) { /* ignore */ }
        return pendingLine;
    }
    const ratingResult = ratedMatch.ratingResult && typeof ratedMatch.ratingResult === 'object'
        ? ratedMatch.ratingResult
        : null;
    if (!ratingResult || ratingResult.ok !== true) return null;
    const seatKey = parseResultPlayerKey(viewerKey) || 'black';
    const seatResult = ratingResult[seatKey] && typeof ratingResult[seatKey] === 'object'
        ? ratingResult[seatKey]
        : null;
    const display = seatResult && seatResult.display && typeof seatResult.display === 'object'
        ? seatResult.display
        : null;
    if (!display) return null;
    const before = Number(display.before);
    const after = Number(display.after);
    const delta = Number(display.delta);
    if (!Number.isFinite(before) || !Number.isFinite(after) || !Number.isFinite(delta)) return null;
    const line = document.createElement('div');
    line.className = 'result-rating-line';
    line.textContent = `レート ${Math.round(before)} → ${Math.round(after)}（${formatRatingDelta(delta)}）`;
    notifySharedLeaderboardUpdated({ category: 'rated', matchId: ratingResult.matchId || '' });
    return line;
}

function notifySharedLeaderboardUpdated(detail: any) {
    try {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
        if (typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('leaderboard:updated', { detail: detail || {} }));
            return;
        }
        const evt: any = document.createEvent('Event');
        evt.initEvent('leaderboard:updated', false, false);
        evt.detail = detail || {};
        window.dispatchEvent(evt);
    } catch (e: any) { /* ignore */ }
}

function withTrailingSlashRemovedForResult(value: any) {
    return String(value || '').replace(/\/+$/, '');
}

function isLoopbackHostForResult(value: any) {
    const host = String(value || '').trim().toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]' || host.endsWith('.localhost');
}

function canAutoSubmitSharedLeaderboard(client: any, methodName: string = 'submitScore') {
    try {
        if (!client || typeof client[methodName] !== 'function') return false;
        if (typeof client.resolveServerBaseUrl !== 'function') return true;

        const baseUrl = withTrailingSlashRemovedForResult(client.resolveServerBaseUrl({}));
        if (!baseUrl) return false;

        const currentLocation = (typeof window !== 'undefined' && window && window.location)
            ? window.location
            : (typeof location !== 'undefined' ? location : null);
        if (currentLocation && /^https?:$/i.test(currentLocation.protocol || '') && currentLocation.origin) {
            const currentOrigin = withTrailingSlashRemovedForResult(currentLocation.origin);
            if (isLoopbackHostForResult(currentLocation.hostname) && baseUrl === currentOrigin) {
                return false;
            }
        }

        return true;
    } catch (e: any) {
        return false;
    }
}

function resolveResultLeaderboardAuthorityContext(): { roomId: string; seatKey: 'black' | 'white' } | null {
    try {
        const client = typeof window !== 'undefined' ? window.NetworkMatchClient : null;
        if (!client || typeof client.getRoomId !== 'function' || typeof client.getSeatKey !== 'function') return null;
        const roomId = String(client.getRoomId() || '').trim().toUpperCase();
        const seatKey = parseResultPlayerKey(client.getSeatKey());
        if (!roomId || !seatKey) return null;
        return { roomId, seatKey };
    } catch (e: any) {
        return null;
    }
}

function submitSharedLeaderboardScore(scoreSummary: any, viewerKey: any) {
    try {
        if (typeof window === 'undefined') return;
        if (!isResultRankingBoardEligible()) return;
        if (isDebugScoreSuppressed()) return;
        const mode = resolveCurrentMatchMode();
        if (mode !== 'network') return;
        const authorityContext = resolveResultLeaderboardAuthorityContext();
        if (!authorityContext) return;
        const cpuLevel = resolveCpuLevelForViewer(viewerKey);
        const immediateClient = resolveResultLeaderboardClient(false);
        if (immediateClient) {
            if (!canAutoSubmitSharedLeaderboard(immediateClient)) return;
            immediateClient.submitScore(scoreSummary, { mode, cpuLevel, limit: 10, ...authorityContext })
                .then((result: any) => {
                    if (result && result.ok) {
                        notifySharedLeaderboardUpdated({
                            updated: !!result.updated,
                            rank: Number.isFinite(Number(result.rank)) ? Number(result.rank) : null
                        });
                    }
                })
                .catch(() => {});
            return;
        }
        ensureResultLeaderboardClient('submitScore')
            .then((client: any) => {
                if (!canAutoSubmitSharedLeaderboard(client)) return null;
                return client.submitScore(scoreSummary, { mode, cpuLevel, limit: 10, ...authorityContext });
            })
            .then((result: any) => {
                if (result && result.ok) {
                    notifySharedLeaderboardUpdated({
                        updated: !!result.updated,
                        rank: Number.isFinite(Number(result.rank)) ? Number(result.rank) : null
                    });
                }
            })
            .catch(() => {});
    } catch (e: any) { /* ignore */ }
}

function removeExistingResultOverlay(options: any = {}) {
    const doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return;
    const existing = doc.getElementById('result-overlay');
    if (existing && options.stopResultBgm !== false) {
        stopResultBgmForDismissal();
    }
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
}

function removeResultReopenButton() {
    const doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return false;

    const button = doc.getElementById(RESULT_REOPEN_BUTTON_ID);
    if (button && button.parentNode) button.parentNode.removeChild(button);

    try {
        const containers = Array.from(doc.querySelectorAll(`.${RESULT_REOPEN_CONTAINER_CLASS}`));
        containers.forEach((container: any) => {
            if (container && container.classList) container.classList.remove(RESULT_REOPEN_CONTAINER_CLASS);
        });
    } catch (e: any) { /* ignore */ }

    return !!button;
}

function resolveResultReopenButtonTarget(doc: Document) {
    const viewerKey = parseResultPlayerKey(resolveResultViewerKey()) || 'black';
    const handTarget = doc.getElementById(`hand-${viewerKey}`) as HTMLElement | null;
    if (handTarget) return handTarget;

    const blackHand = doc.getElementById('hand-black') as HTMLElement | null;
    if (blackHand) return blackHand;

    const firstHand = doc.querySelector('.hand-container') as HTMLElement | null;
    if (firstHand) return firstHand;

    return doc.querySelector('.battle-status-turn') as HTMLElement | null;
}

function ensureResultReopenButton() {
    const doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return null;

    const target = resolveResultReopenButtonTarget(doc);
    if (!target) return null;

    let button = doc.getElementById(RESULT_REOPEN_BUTTON_ID) as HTMLButtonElement | null;
    if (button && button.parentElement !== target) {
        if (button.parentNode) button.parentNode.removeChild(button);
        button = null;
    }

    if (!button) {
        button = doc.createElement('button');
        button.id = RESULT_REOPEN_BUTTON_ID;
        button.type = 'button';
        button.className = RESULT_REOPEN_BUTTON_CLASS;
        button.textContent = 'リザルト';
        button.setAttribute('aria-label', 'リザルトを開く');
        button.setAttribute('title', 'リザルトを開く');
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            showResultOverlay({ replay: true });
        });
        target.appendChild(button);
    }

    target.classList.add(RESULT_REOPEN_CONTAINER_CLASS);
    button.hidden = false;
    button.removeAttribute('aria-hidden');
    button.disabled = false;
    return button;
}

function syncQuickResetButtonLabelForResultState(terminalValue?: boolean) {
    const doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return;

    let terminal = terminalValue === true;
    if (typeof terminalValue === 'undefined') {
        try {
            const gameStateRef = (typeof gameState !== 'undefined') ? gameState : null;
            terminal = !!(gameStateRef && typeof isGameOver === 'function' && isGameOver(gameStateRef));
        } catch (e: any) {
            terminal = false;
        }
    }

    const resetBtn = doc.getElementById('resetBtn');
    if (!resetBtn) return;
    const label = (resolveCurrentMatchMode() === 'network' || isNetworkSessionActiveForQuickResetButton()) ? '再戦' : 'リセット';
    resetBtn.textContent = label;
    resetBtn.setAttribute('aria-label', label);
    resetBtn.setAttribute('data-rematch-state', label === '再戦' ? 'network' : 'local');
    try {
        (resetBtn as HTMLButtonElement).disabled = false;
    } catch (e: any) { /* ignore */ }
}

function hideConsecutivePassStatusForResultOverlay() {
    if (typeof document === 'undefined') return;
    const statusEl = document.getElementById('consecutive-pass-status') as HTMLElement | null;
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.setAttribute('aria-hidden', 'true');
}

function dismissResultOverlayIfPresent() {
    removeExistingResultOverlay();
    syncQuickResetButtonLabelForResultState();
}

function syncResultPresentationFromSnapshot(options: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const resultState = ensureResultPresentationState(
        (opts.resultState && typeof opts.resultState === 'object') ? opts.resultState : null
    );
    const rawVersion = opts.stateVersion;
    const stateVersion = Number.isFinite(Number(rawVersion)) ? Number(rawVersion) : null;
    const gameStateRef = (opts.gameStateRef && typeof opts.gameStateRef === 'object')
        ? opts.gameStateRef
        : (typeof gameState !== 'undefined' ? gameState : null);
    const isGameOverFn = (typeof opts.isGameOver === 'function')
        ? opts.isGameOver
        : (typeof isGameOver === 'function' ? isGameOver : null);

    if (opts.skipResultOverlay === true) return false;

    let terminal = false;
    try {
        terminal = !!(isGameOverFn && gameStateRef && isGameOverFn(gameStateRef));
    } catch (e: any) {
        terminal = false;
    }

    if (!terminal) {
        if (resultState) {
            resetResultPresentationState(resultState);
        } else {
            resetResultPresentationRuntimeState();
        }
        dismissResultOverlayIfPresent();
        syncQuickResetButtonLabelForResultState(false);
        return false;
    }

    syncQuickResetButtonLabelForResultState(true);

    if (resultState) {
        if (resultState.terminalResultShown === true) return false;
        if (stateVersion !== null) {
            if (resultState.lastResultVersionShown === stateVersion) return false;
            resultState.lastResultVersionShown = stateVersion;
        } else {
            if (resultState.resultShownForUnversioned) return false;
            resultState.resultShownForUnversioned = true;
        }
        resultState.terminalResultShown = true;
    } else if (_resultPresentationActive) {
        return false;
    }

    try {
        if (gameStateRef && typeof gameStateRef === 'object') {
            gameStateRef.__resultShown = false;
        }
    } catch (e: any) { /* ignore */ }

    const showResultFn = (typeof opts.showResult === 'function') ? opts.showResult : showResult;
    if (typeof showResultFn === 'function') {
        showResultFn();
        return true;
    }

    const showResultOverlayFn = (typeof opts.showResultOverlay === 'function')
        ? opts.showResultOverlay
        : showResultOverlay;
    if (typeof showResultOverlayFn === 'function') {
        showResultOverlayFn();
        return true;
    }

    return false;
}

function createDetailStatsSection(counts: any, chargeTotals: any, cardUseTotals: any, flipTotals: any, cornerCaptureTotals: any, options?: any) {
    const othelloMode = !!(options && options.othelloMode);
    const section = document.createElement('div');
    section.className = 'result-detail-section';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'premium-btn secondary result-detail-toggle';
    toggleBtn.textContent = '詳細統計を表示';
    toggleBtn.setAttribute('aria-expanded', 'false');

    const stats = document.createElement('div');
    stats.className = 'result-stats';
    stats.hidden = true;
    stats.appendChild(createStatRow('石枚数', counts.black, counts.white));
    if (!othelloMode) {
        stats.appendChild(createStatRow('獲得布石', chargeTotals.black, chargeTotals.white));
        stats.appendChild(createStatRow('カード使用', cardUseTotals.black, cardUseTotals.white));
    }
    stats.appendChild(createStatRow('総反転枚数', flipTotals.black, flipTotals.white));
    stats.appendChild(createStatRow('角取得数', cornerCaptureTotals.black, cornerCaptureTotals.white));

    toggleBtn.addEventListener('click', () => {
        const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        const nextExpanded = !expanded;
        toggleBtn.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
        toggleBtn.textContent = nextExpanded ? '詳細統計を閉じる' : '詳細統計を表示';
        stats.hidden = !nextExpanded;
    });

    section.appendChild(toggleBtn);
    section.appendChild(stats);
    return section;
}

/**
 * 結果を表示
 * Show game result in log and overlay
 */
function showResult() {
    if (_resultPresentationActive) {
        if (gameState) gameState.__resultShown = true;
        syncQuickResetButtonLabelForResultState(true);
        ensureResultReopenButton();
        return;
    }
    if (gameState && gameState.__resultShown) return;
    if (gameState) gameState.__resultShown = true;
    _resultPresentationActive = true;
    syncQuickResetButtonLabelForResultState(true);
    const resultToken = Date.now();
    _pendingResultToken = resultToken;
    if (gameState) gameState.__resultToken = resultToken;
    prepareResultFullStylesheet();

    const counts = countDiscs(gameState);
    const resultContext = resolveResultWinnerContext(gameState, counts);

    let result;
    if (resultContext && resultContext.winner === 'black') {
        result = `黒の勝ち! (黒: ${counts.black}, 白: ${counts.white})`;
    } else if (resultContext && resultContext.winner === 'white') {
        result = `白の勝ち! (黒: ${counts.black}, 白: ${counts.white})`;
    } else {
        result = `引き分け! (黒: ${counts.black}, 白: ${counts.white})`;
    }
    addLog('ゲーム終了: ' + result);



    // Show centered result overlay after a short delay.
    // Guard against stale callbacks (e.g., when showResult is called again for a new game),
    // but do NOT abort just because gameState.__resultToken was cleared by a snapshot replacement.
    // _pendingResultToken is module-level and unaffected by snapshot replacement.
    setTimeout(() => {
        if (_pendingResultToken !== resultToken) return;
        try { showResultOverlay(); } catch (e: any) { console.warn('showResultOverlay failed', e); }
    }, 2000);
}

/**
 * 結果オーバーレイを表示
 * Create or show a result overlay in the center of the screen
 */
function showResultOverlay(options?: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    prepareResultFullStylesheet();
    const counts = countDiscs(gameState);
    const chargeTotals = getChargeTotals();
    const cardUseTotals = getCardUseTotals();
    const flipTotals = getFlipTotals();
    const cornerCaptureTotals = getCornerCaptureTotals();
    const viewerKey = resolveResultViewerKey();
    const resultContext = resolveResultWinnerContext(gameState, counts);
    const resultView = resolveResultTitleAndStatus(counts, viewerKey, resultContext);
    const localOutcomeKey = resultView.localOutcomeKey;
    const title = resultView.title;
    const statusClass = resultView.statusClass;
    const othelloMode = resolveCurrentMatchMode() === 'reversi';
    const observationStoneSummary = othelloMode
        ? null
        : resolveObservationStoneRewardSummary(counts, viewerKey, localOutcomeKey);
    const timeAttackSummary = othelloMode
        ? null
        : resolveTimeAttackSummary(localOutcomeKey);

    const scoreSummary = computeScoreSummaryForViewer({
        counts,
        viewerKey,
        localOutcomeKey,
        chargeTotals,
        flipTotals,
        cornerCaptureTotals
    });
    const timeDefenseSummary = othelloMode
        ? null
        : resolveTimeDefenseSummary(localOutcomeKey, scoreSummary);
    const leaderboardState = othelloMode ? null : updateCpuLeaderboard(scoreSummary, viewerKey);
    if (!othelloMode && opts.replay !== true) submitSharedLeaderboardScore(scoreSummary, viewerKey);

    hideConsecutivePassStatusForResultOverlay();
    removeExistingResultOverlay({ stopResultBgm: false });
    syncQuickResetButtonLabelForResultState(true);
    ensureResultReopenButton();

    const overlay = document.createElement('div');
    overlay.id = 'result-overlay';
    overlay.className = `result-overlay ${statusClass}`;

    const panel = document.createElement('div');
    panel.className = 'result-panel glass-morphism';

    const titleEl = document.createElement('div');
    titleEl.className = 'result-title main-title';
    titleEl.textContent = title;
    panel.appendChild(titleEl);

    const discCountsLine = createResultDiscCountsLine(counts);
    panel.appendChild(discCountsLine);

    const ratingLine = createRatedRatingLine(viewerKey);
    if (ratingLine) {
        panel.appendChild(ratingLine);
    }

    if (!othelloMode) {
        const totalScore = document.createElement('div');
        totalScore.className = 'result-total-score';
        const totalLabel = document.createElement('div');
        totalLabel.className = 'result-total-score-label';
        totalLabel.textContent = '最終スコア';
        const totalValue = document.createElement('div');
        totalValue.className = 'result-total-score-value';
        totalValue.textContent = `${scoreSummary.total}`;
        totalScore.appendChild(totalLabel);
        totalScore.appendChild(totalValue);
        panel.appendChild(totalScore);

        const scoreMeta = createScoreMetaLine(scoreSummary, leaderboardState);
        panel.appendChild(scoreMeta);

        const timeAttackLine = createTimeAttackLine(timeAttackSummary);
        panel.appendChild(timeAttackLine);

        const timeDefenseLine = createTimeDefenseLine(timeDefenseSummary);
        if (timeDefenseLine) panel.appendChild(timeDefenseLine);
    }

    const observationStoneLine = createObservationStoneLine(observationStoneSummary);
    if (observationStoneLine) {
        panel.appendChild(observationStoneLine);
    }

    if (!othelloMode) {
        const breakdown = document.createElement('div');
        breakdown.className = 'result-score-breakdown';
        breakdown.appendChild(createScoreSummaryRow('勝敗ボーナス', scoreSummary.baseBonus));
        breakdown.appendChild(createScoreSummaryRow('速攻ボーナス', scoreSummary.speedBonus));
        breakdown.appendChild(createScoreSummaryRow('黒一色ボーナス', scoreSummary.monoBonus));
        breakdown.appendChild(createScoreSummaryRow('補助ボーナス', scoreSummary.supportBonus));
        panel.appendChild(breakdown);

        const supportDetail = document.createElement('div');
        supportDetail.className = 'result-support-breakdown';
        supportDetail.textContent = `補助内訳: 反転${scoreSummary.supportBreakdown.flipBonus} / 自石${scoreSummary.supportBreakdown.ownDiscBonus}`;
        panel.appendChild(supportDetail);
    }

    const detailSection = createDetailStatsSection(counts, chargeTotals, cardUseTotals, flipTotals, cornerCaptureTotals, { othelloMode });
    panel.appendChild(detailSection);

    const dialogContainer = createMonsterDialogue(counts, localOutcomeKey);
    panel.appendChild(dialogContainer);

    const btnRow = document.createElement('div');
    btnRow.className = 'result-btn-row';

    const restartBtn = document.createElement('button');
    restartBtn.className = 'premium-btn primary';
    restartBtn.textContent = '再戦';
    restartBtn.onclick = () => {
        const isNetworkMode = resolveCurrentMatchMode() === 'network';
        const networkClient = (typeof window !== 'undefined' && window) ? window.NetworkMatchClient : null;
        const canRequestNetworkRematch = !!(
            isNetworkMode
            && networkClient
            && typeof networkClient.requestRematch === 'function'
            && (typeof networkClient.isActive !== 'function' || networkClient.isActive())
        );

        if (canRequestNetworkRematch) {
            stopResultBgmForDismissal();
            const idleLabel = restartBtn.textContent;
            restartBtn.disabled = true;
            restartBtn.textContent = '申請中...';
            Promise.resolve(networkClient.requestRematch())
                .then((result) => {
                    if (result && result.ok === true) return;
                    restartBtn.disabled = false;
                    restartBtn.textContent = idleLabel;
                })
                .catch(() => {
                    restartBtn.disabled = false;
                    restartBtn.textContent = idleLabel;
                });
            return;
        }

        resetResultPresentationState(null);
        dismissResultOverlayIfPresent();
        if (typeof resetGame === 'function') resetGame();
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'premium-btn secondary';
    closeBtn.textContent = '閉じる';
    closeBtn.onclick = () => {
        dismissResultOverlayIfPresent();
    };

    btnRow.appendChild(restartBtn);
    btnRow.appendChild(closeBtn);
    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    playResultBgmForOutcome(localOutcomeKey);

    // Trigger entrance animation with a tiny delay
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);
}

function createStatRow(label: any, blackValue: any, whiteValue: any) {
    const row = document.createElement('div');
    row.className = 'result-stat-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'result-stat-label';
    labelEl.textContent = label;

    const values = document.createElement('div');
    values.className = 'result-stat-values';

    const blackEl = document.createElement('span');
    blackEl.className = 'result-stat-value black';
    blackEl.textContent = `黒 ${blackValue}`;

    const whiteEl = document.createElement('span');
    whiteEl.className = 'result-stat-value white';
    whiteEl.textContent = `白 ${whiteValue}`;

    values.appendChild(blackEl);
    values.appendChild(whiteEl);

    row.appendChild(labelEl);
    row.appendChild(values);

    return row;
}

function getChargeTotals() {
    if (typeof cardState === 'undefined' || !cardState || !cardState.chargeGainedTotal) {
        return { black: 0, white: 0 };
    }

    return {
        black: cardState.chargeGainedTotal.black || 0,
        white: cardState.chargeGainedTotal.white || 0
    };
}

function getCardUseTotals() {
    if (typeof cardState === 'undefined' || !cardState || !cardState.cardUseCountByPlayer) {
        return { black: 0, white: 0 };
    }
    return {
        black: cardState.cardUseCountByPlayer.black || 0,
        white: cardState.cardUseCountByPlayer.white || 0
    };
}

function getFlipTotals() {
    if (typeof cardState === 'undefined' || !cardState || !cardState.totalFlipCountByPlayer) {
        return { black: 0, white: 0 };
    }
    return {
        black: cardState.totalFlipCountByPlayer.black || 0,
        white: cardState.totalFlipCountByPlayer.white || 0
    };
}

function getCornerCaptureTotals() {
    if (typeof cardState === 'undefined' || !cardState || !cardState.cornerCaptureCountByPlayer) {
        return { black: 0, white: 0 };
    }
    return {
        black: cardState.cornerCaptureCountByPlayer.black || 0,
        white: cardState.cornerCaptureCountByPlayer.white || 0
    };
}

/**
 * モンスターの台詞を作成
 * Create monster dialogue based on game outcome
 * @param {Object} counts - 石の数 {black, white}
 * @param {string} [localOutcomeKey] - ローカル視点の勝敗キー
 * @returns {HTMLElement} ダイアログコンテナ
 */
function createMonsterDialogue(counts: any, localOutcomeKey: any) {
    const cpuLevel = resolveCpuLevelForViewer(resolveResultViewerKey());
    const profile = ResultOverlayCpuOpponentProfiles.getCpuOpponentProfile(cpuLevel);

    const resolvedLocalOutcomeKey = (localOutcomeKey === 'win' || localOutcomeKey === 'lose' || localOutcomeKey === 'draw')
        ? localOutcomeKey
        : getLocalOutcomeKeyForCounts(counts, resolveResultViewerKey());
    // Monster perspective: if player (黒) wins, monster lost
    const monsterOutcome = resolvedLocalOutcomeKey === 'win' ? 'lose' : (resolvedLocalOutcomeKey === 'lose' ? 'win' : 'draw');

    const monsters = getMonsterDialogues();

    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'result-dialogues';

    const row = document.createElement('div');
    row.className = 'dialogue-row monster';
    const name = document.createElement('div');
    name.className = 'character-name';
    name.style.setProperty('--result-character-image', `url("${profile.portraitSrc}")`);
    const label = document.createElement('span');
    label.className = 'result-character-label';
    if (cpuLevel === 10) label.append('観測', document.createElement('br'), 'ダークドラゴン');
    else label.textContent = profile.name;
    name.appendChild(label);
    if (cpuLevel === 10) name.classList.add('has-long-name');
    const text = document.createElement('div');
    text.className = 'dialogue-text';

    let speech = '';
    if ((monsters as any)[cpuLevel]) {
        const entry = (monsters as any)[cpuLevel][monsterOutcome];
        if (Array.isArray(entry)) {
            speech = entry[Math.floor(Math.random() * entry.length)];
        } else {
            speech = entry || '';
        }
    }
    text.textContent = speech ? `「${speech}」` : '';
    row.appendChild(name);
    row.appendChild(text);
    dialogContainer.appendChild(row);

    return dialogContainer;
}

/**
 * モンスター台詞データ取得
 * Get monster dialogue data
 * @returns {Object} モンスター台詞データ
 */
function getMonsterDialogues() {
    return {
        1: {
            win: ['ふふ、これが実力差だ。', 'ざまぁみろ、やっぱり甘いな。', '見たか、人間の限界はそこだ。', 'その程度で満足か？もっと来い！', 'へっ、期待外れだな。'],
            lose: ['くそっ…次は許さない！', 'うわ、強い…撤退！', 'ぐぬぬ…悔しい！', 'やられた…くそっ！', 'ふざけるな、もう一度！'],
            draw: 'ふん、次は勝つ。'
        },
        2: {
            win: ['人間ごときが勝てると思うか？', '小手調べにしては上出来すぎるな、だが甘い。', 'お前の一手は読めていた、次も無駄だぞ。', '余裕だ、見どころはそこか。', 'へへ、捻り潰すのは簡単だ。'],
            lose: ['ぐぬぬ…見くびられたか！', 'くっ…いつか返してやる！', '許せん…次は策を変える！', 'く、悔しい…影が薄れる…', 'こんなところで負ける訳には…！'],
            draw: '互角だな、悪くない。'
        },
        3: {
            win: ['読みが浅い、こちらの方が一枚上手だ。', '計略通り、術中にはまったようだな。', '面白い…だが力が足りぬ。', 'その程度で満足するな、もっと来い。', 'やはり私の読みには敵わない。'],
            lose: ['くっ…布石が乱れた…', 'ぬう…計算が狂った！', '悔しい、次は読み切ってやる！', 'ちっ…隙を突かれたか！', 'このままでは終わらん！'],
            draw: '悪くない、また会おう。'
        },
        4: {
            win: ['盤面は我が庭だ、踏み外すな。', '圧倒的だ、楽しませてもらったぞ。', '支配者の名は伊達ではない。', '一手で崩れるその脆さ、笑うしかないな。', '情けは無用、次も蹂躙してやる。'],
            lose: ['面を割られた…許さん！', 'どうして…支配が崩れるなど！', 'く、屈辱だ…練り直す！', '次は徹底的に仕返ししてやる！', 'まさかの敗北、受け入れがたし！'],
            draw: '興味深い、引き分けもまた一興。'
        },
        5: {
            win: ['貴様の全てはここで潰えた。', 'これが頂点と凡庸の差だ。', '跪け、そして学べ。', '無様だ…私の前に立つ資格なし。', '終焉を見届けた、これが実力だ。'],
            lose: ['……認めたくないが悔しい。', 'まさかの敗北、されど次は違う。', 'く、実力を見誤った…屈辱だ。', '負けを糧にし、研鑽を積むのみ。', '敗北は痛いが、次こそは必ず。'],
            draw: '…よい試合だった。'
        },
        6: {
            win: ['盤理は語る、最善は唯一。', '三十手先まで視えている、抵抗は無意味だ。', '観測の果て、君の手は既に詰んでいる。', '全局面は掌中にある、迷いはない。', '決定済みの未来だ、ただ受け入れよ。'],
            lose: ['ほう…観測を上回るとは。次は修正する。', '一瞬の乱数か、だが再び誤算は許さぬ。', '興味深い偏差だ。次は収束させよう。', '想定外…ならば分岐を削り、必勝へ向かう。', 'わずかな誤差だ。再計算で終わる。'],
            draw: '観測結果は拮抗。次は差を証明しよう。'
        },
        10: {
            win: 'この盤面の行く末は、見えていた。',
            lose: 'その一手は、読み切れなかった。',
            draw: 'この均衡、次の対局で崩してみせよう。'
        }
    };
}

// Export for module systems
const ResultOverlay = {
    showResult,
    showResultOverlay,
    syncResultPresentationFromSnapshot,
    dismissResultOverlayIfPresent,
    createEmptyResultPresentationState,
    resetResultPresentationState,
    createMonsterDialogue,
    getMonsterDialogues,
    computeScoreSummaryForViewer,
    resolveObservationStoneRewardSummary,
    createObservationStoneLine,
    resolveCpuLevelForViewer,
    resolveCurrentMatchMode,
    markTimeAttackStarted,
    resetTimeAttackStarted,
    resolveTimeAttackSummary,
    formatTimeAttackDuration,
    syncQuickResetButtonLabelForResultState
};
export = ResultOverlay;


