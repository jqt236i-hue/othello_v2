import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

/**
 * @file result-overlay.js
 * @description ゲーム終了時の結果表示オーバーレイ
 */

const SCORE_CONFIG = Object.freeze({
    version: 5,
    winBase: 5000,
    drawBase: 2000,
    loseBase: 0,
    speedBase: 2500,
    speedStartTurn: 0,
    speedZeroTurn: 100,
    monoBonus: 1500,
    supportMax: 3000,
    supportFlipMax: 1500,
    supportFlipTargetCount: 150,
    supportOwnDiscMax: 1500,
    supportOwnDiscTargetCount: 76,
    theoreticalMax: 12000
});

const SCORE_LEADERBOARD_STORAGE_KEY = `othello_cpu_leaderboard_v${SCORE_CONFIG.version}`;
const _observationStoneRewardByToken = new Map();

// Module-level token: survives gameState replacement by network snapshots.
// Updated each time showResult() is called so stale delayed callbacks can detect
// that a newer invocation has superseded them.
let _pendingResultToken: any = null;

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
const ResultOverlayBoardUtilsNewModule = resolveResultOverlayModuleOrNull('../shared/board-utils', 'BoardUtils');
const ResultOverlaySoundEngineAccessModule = resolveResultOverlayModuleOrNull('./sound-engine-access', 'SoundEngineAccessModule');

function createEmptyResultPresentationState() {
    return {
        lastResultVersionShown: null,
        resultShownForUnversioned: false
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
    return resultState;
}

function resetResultPresentationState(resultState: any) {
    const target = ensureResultPresentationState(resultState);
    if (!target) return createEmptyResultPresentationState();
    target.lastResultVersionShown = null;
    target.resultShownForUnversioned = false;
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

function countDiscsFromBoardState(gameStateRef: any) {
    const stateRef = (gameStateRef && typeof gameStateRef === 'object') ? gameStateRef : null;
    const board = stateRef && Array.isArray(stateRef.board) ? stateRef.board : [];
    if (ResultOverlayBoardUtilsNewModule && typeof ResultOverlayBoardUtilsNewModule.countDiscs === 'function') {
        return normalizeDiscCounts(ResultOverlayBoardUtilsNewModule.countDiscs(board));
    }
    const counts = { black: 0, white: 0 };
    for (let row = 0; row < board.length; row += 1) {
        const boardRow = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < boardRow.length; col += 1) {
            const value = Number(boardRow[col]);
            if (value === 1) counts.black += 1;
            else if (value === -1) counts.white += 1;
        }
    }
    return counts;
}

function countDiscs(gameStateRef: any) {
    const stateRef = (gameStateRef && typeof gameStateRef === 'object')
        ? gameStateRef
        : (typeof gameState !== 'undefined' ? gameState : null);
    try {
        if (
            typeof globalThis !== 'undefined' &&
            typeof (globalThis as any).countDiscs === 'function' &&
            (globalThis as any).countDiscs !== countDiscs
        ) {
            return normalizeDiscCounts((globalThis as any).countDiscs(stateRef));
        }
    } catch (e: any) { /* ignore */ }
    return countDiscsFromBoardState(stateRef);
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

function clampCpuLevel(value: any) {
    const level = toFiniteInteger(value, 1);
    return Math.max(1, Math.min(6, level));
}

function resolveCpuLevelForViewer(viewerKey: any) {
    const localKey = parseResultPlayerKey(viewerKey) || 'black';
    const enemyKey = localKey === 'white' ? 'black' : 'white';
    const source = (typeof cpuSmartness !== 'undefined' && cpuSmartness && typeof cpuSmartness === 'object')
        ? cpuSmartness
        : null;
    if (!source) return 1;
    const raw = source[enemyKey] ?? source.white ?? source.black ?? 1;
    return clampCpuLevel(raw);
}

function resolveTurnCountForScore() {
    if (typeof cardState !== 'undefined' && cardState && cardState.turnCountByPlayer) {
        const blackTurns = Math.max(0, toFiniteInteger(cardState.turnCountByPlayer.black, 0));
        const whiteTurns = Math.max(0, toFiniteInteger(cardState.turnCountByPlayer.white, 0));
        const totalTurns = blackTurns + whiteTurns;
        if (totalTurns > 0) return totalTurns;
    }

    if (typeof cardState !== 'undefined' && cardState && Number.isFinite(Number(cardState.turnIndex))) {
        const turnIndex = Math.max(0, toFiniteInteger(cardState.turnIndex, 0));
        if (turnIndex > 0) return turnIndex;
    }

    if (typeof gameState !== 'undefined' && gameState && Number.isFinite(Number(gameState.turnNumber))) {
        return Math.max(0, toFiniteInteger(gameState.turnNumber, 0) + 1);
    }

    return 0;
}

function computeResultBaseBonus(localOutcomeKey: any) {
    if (localOutcomeKey === 'win') return SCORE_CONFIG.winBase;
    if (localOutcomeKey === 'draw') return SCORE_CONFIG.drawBase;
    return SCORE_CONFIG.loseBase;
}

function computeSpeedBonus(turnCount: any) {
    const totalTurns = Math.max(0, toFiniteInteger(turnCount, 0));
    if (totalTurns <= SCORE_CONFIG.speedStartTurn) return SCORE_CONFIG.speedBase;
    if (totalTurns >= SCORE_CONFIG.speedZeroTurn) return 0;

    const speedRangeTurns = Math.max(1, SCORE_CONFIG.speedZeroTurn - SCORE_CONFIG.speedStartTurn);
    const remainTurns = SCORE_CONFIG.speedZeroTurn - totalTurns;
    const scaled = Math.floor((SCORE_CONFIG.speedBase * remainTurns) / speedRangeTurns);
    return Math.max(0, scaled);
}

function computeSupportComponentBonus(rawCount: any, targetCount: any, maxBonus: any) {
    const count = Math.max(0, toFiniteInteger(rawCount, 0));
    const target = Math.max(1, toFiniteInteger(targetCount, 1));
    const cap = Math.max(0, toFiniteInteger(maxBonus, 0));
    if (cap === 0) return 0;
    const scaled = Math.floor((count * cap) / target);
    return Math.min(cap, scaled);
}

function computeSupportBreakdown(localDiscCount: any, localFlipCount: any) {
    const discCount = Math.max(0, toFiniteInteger(localDiscCount, 0));
    const flipCount = Math.max(0, toFiniteInteger(localFlipCount, 0));

    const flipBonus = computeSupportComponentBonus(
        flipCount,
        SCORE_CONFIG.supportFlipTargetCount,
        SCORE_CONFIG.supportFlipMax
    );
    const ownDiscBonus = computeSupportComponentBonus(
        discCount,
        SCORE_CONFIG.supportOwnDiscTargetCount,
        SCORE_CONFIG.supportOwnDiscMax
    );

    const sum = flipBonus + ownDiscBonus;
    return {
        flipBonus,
        ownDiscBonus,
        total: Math.min(SCORE_CONFIG.supportMax, sum)
    };
}

function computeScoreSummaryForViewer(options: any) {
    const opts = options || {};
    const counts = opts.counts || { black: 0, white: 0 };
    const viewerKey = parseResultPlayerKey(opts.viewerKey) || 'black';
    const localCounts = getLocalAndOpponentCountsForViewer(counts, viewerKey);
    const localOutcomeKey = (opts.localOutcomeKey === 'win' || opts.localOutcomeKey === 'lose' || opts.localOutcomeKey === 'draw')
        ? opts.localOutcomeKey
        : getLocalOutcomeKeyForCounts(counts, viewerKey);
    const turnCount = resolveTurnCountForScore();

    const baseBonus = computeResultBaseBonus(localOutcomeKey);
    let speedBonus = 0;
    let monoBonus = 0;
    let supportBonus = 0;
    let supportBreakdown = { flipBonus: 0, ownDiscBonus: 0, total: 0 };

    if (localOutcomeKey === 'win') {
        speedBonus = computeSpeedBonus(turnCount);
        monoBonus = localCounts.opponentCount === 0 ? SCORE_CONFIG.monoBonus : 0;

        const localFlipCount = Math.max(0, toFiniteInteger(opts.flipTotals && opts.flipTotals[localCounts.localKey], 0));
        supportBreakdown = computeSupportBreakdown(localCounts.localCount, localFlipCount);
        supportBonus = supportBreakdown.total;
    }

    const total = baseBonus + speedBonus + monoBonus + supportBonus;
    return {
        version: SCORE_CONFIG.version,
        total,
        baseBonus,
        speedBonus,
        monoBonus,
        supportBonus,
        supportBreakdown,
        turnCount,
        localOutcomeKey,
        localKey: localCounts.localKey,
        localDiscCount: localCounts.localCount,
        opponentDiscCount: localCounts.opponentCount,
        theoreticalMax: SCORE_CONFIG.theoreticalMax
    };
}

function updateCpuLeaderboard(scoreSummary: any, viewerKey: any) {
    const cpuLevel = resolveCpuLevelForViewer(viewerKey);
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

function canUseObservationStoneProgress() {
    return !!(
        ResultOverlayGachaHelpersModule
        && ResultOverlayGachaProgressModule
        && typeof ResultOverlayGachaProgressModule.getObservationStones === 'function'
    );
}

function getObservationStoneBalanceForResult() {
    if (!canUseObservationStoneProgress()) return 0;
    const rootRef = (typeof window !== 'undefined' && window)
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    return Math.max(0, toFiniteInteger(ResultOverlayGachaProgressModule.getObservationStones(rootRef), 0));
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
    const baseSummary = {
        visible: false,
        eligible: false,
        granted: false,
        base: 0,
        bonus: 0,
        total: 0,
        balance: getObservationStoneBalanceForResult()
    };

    if (!canUseObservationStoneProgress()) {
        return baseSummary;
    }
    if (!isObservationStoneRewardEligibleMatch()) {
        return baseSummary;
    }

    const token = resolveObservationStoneRewardToken(counts, viewerKey, localOutcomeKey);
    if (_observationStoneRewardByToken.has(token)) {
        const cached = _observationStoneRewardByToken.get(token);
        return Object.assign({}, cached, {
            balance: getObservationStoneBalanceForResult()
        });
    }

    const rootRef = (typeof window !== 'undefined' && window)
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    const baseReward = Math.max(
        0,
        toFiniteInteger(ResultOverlayGachaHelpersModule.OBSERVATION_STONE_REWARD_BASE, 100)
    );
    const bonusReward = localOutcomeKey === 'win' && (typeof ResultOverlayGachaHelpersModule.rollObservationBonus === 'function')
        ? Math.max(0, toFiniteInteger(ResultOverlayGachaHelpersModule.rollObservationBonus(), 0))
        : 0;
    const totalReward = baseReward + bonusReward;

    if (typeof ResultOverlayGachaProgressModule.awardObservationStones === 'function') {
        ResultOverlayGachaProgressModule.awardObservationStones(rootRef, totalReward);
    }

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
        balance: getObservationStoneBalanceForResult()
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

function canAutoSubmitSharedLeaderboard(client: any) {
    try {
        if (!client || typeof client.submitScore !== 'function') return false;
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

function submitSharedLeaderboardScore(scoreSummary: any, viewerKey: any) {
    try {
        if (typeof window === 'undefined') return;
        const client = window.LeaderboardClient;
        if (!canAutoSubmitSharedLeaderboard(client)) return;

        const mode = resolveCurrentMatchMode();
        const cpuLevel = resolveCpuLevelForViewer(viewerKey);
        client.submitScore(scoreSummary, { mode, cpuLevel, limit: 10 })
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
    const label = terminal ? '再戦' : 'リセット';
    resetBtn.textContent = label;
    resetBtn.setAttribute('aria-label', label);
    resetBtn.setAttribute('data-rematch-state', terminal ? 'terminal' : 'active');
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
            resultState.resultShownForUnversioned = false;
        }
        dismissResultOverlayIfPresent();
        syncQuickResetButtonLabelForResultState(false);
        return false;
    }

    syncQuickResetButtonLabelForResultState(true);

    if (resultState) {
        if (stateVersion !== null) {
            if (resultState.lastResultVersionShown === stateVersion) return false;
            resultState.lastResultVersionShown = stateVersion;
        } else {
            if (resultState.resultShownForUnversioned) return false;
            resultState.resultShownForUnversioned = true;
        }
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
    if (gameState && gameState.__resultShown) return;
    if (gameState) gameState.__resultShown = true;
    syncQuickResetButtonLabelForResultState(true);
    const resultToken = Date.now();
    _pendingResultToken = resultToken;
    if (gameState) gameState.__resultToken = resultToken;

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
function showResultOverlay() {
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

    const scoreSummary = computeScoreSummaryForViewer({
        counts,
        viewerKey,
        localOutcomeKey,
        chargeTotals,
        flipTotals,
        cornerCaptureTotals
    });
    const leaderboardState = othelloMode ? null : updateCpuLeaderboard(scoreSummary, viewerKey);
    if (!othelloMode) submitSharedLeaderboardScore(scoreSummary, viewerKey);

    hideConsecutivePassStatusForResultOverlay();
    removeExistingResultOverlay({ stopResultBgm: false });
    syncQuickResetButtonLabelForResultState(true);

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
            restartBtn.textContent = '再戦中...';
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
    const levelNames = ['不明', '盤喰いの小鬼', '反転の影', '布石を紡ぐ者', '盤面支配者', '終局を告げる者', '盤理の観測者'];
    const cpuLevel = resolveCpuLevelForViewer(resolveResultViewerKey());

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
    name.textContent = levelNames[cpuLevel] || (`モンスターLv${cpuLevel}`);
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
    syncQuickResetButtonLabelForResultState
};
export = ResultOverlay;






