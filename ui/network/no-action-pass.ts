'use strict';

import CardRuntimeIntegrity = require('../card-runtime-integrity');

// ネット対戦では手番開始処理（turn-manager の自動パス判定）がクライアントで走らないため、
// 合法手も使用可能カードも無い手番が来ても誰もパスを送らず、パスボタンか時間切れを待つしかなかった。
// 受信した版ごとに一度、演出が落ち着いてから pass-handler の自動パス判定を呼ぶ（01-rulebook.md §2.5）。
// 送信の可否（操作する席か、行動が残っていないか）は ensureCurrentPlayerCanActOrPass が判定する。

type NoActionPassRoot = Record<string, any>;

type NoActionPassClient = {
  isActive?: () => boolean;
  isSpectator?: () => boolean;
  getRoomId?: () => any;
  getStateVersion?: () => any;
  getNetworkAutoEnabled?: () => boolean;
};

type NoActionPassMonitorConfig = {
  root: NoActionPassRoot;
  client: NoActionPassClient;
  hasPendingLocalPublishes?: () => boolean;
  settleDelayMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  setIntervalFn?: (callback: () => void, ms: number) => any;
  clearIntervalFn?: (handle: any) => void;
};

const DEFAULT_SETTLE_DELAY_MS = 700;
const DEFAULT_POLL_INTERVAL_MS = 250;

function isPlaybackBusy(root: NoActionPassRoot): boolean {
  try {
    if (root.isProcessing === true || root.isCardAnimating === true || root.VisualPlaybackActive === true) return true;
    const playback = root.PlaybackStateManager;
    if (playback) {
      if (typeof playback.getPlaybackActive === 'function' && playback.getPlaybackActive() === true) return true;
      if (typeof playback.getProcessing === 'function' && playback.getProcessing() === true) return true;
      if (typeof playback.getCardAnimating === 'function' && playback.getCardAnimating() === true) return true;
      if (typeof playback.hasPendingVisualPlayback === 'function' && playback.hasPendingVisualPlayback(root.cardState) === true) return true;
    }
  } catch (_error) {
    return true;
  }
  return false;
}

function createNetworkNoActionPassMonitor(config: NoActionPassMonitorConfig) {
  const root = config.root;
  const client = config.client;
  const settleDelayMs = Number.isFinite(Number(config.settleDelayMs)) ? Number(config.settleDelayMs) : DEFAULT_SETTLE_DELAY_MS;
  const now = typeof config.now === 'function' ? config.now : () => Date.now();
  let evaluatedKey = '';
  let idleKey = '';
  let idleSince = 0;
  let intervalHandle: any = null;

  function readTurnKey(): string {
    if (!client || typeof client.isActive !== 'function' || client.isActive() !== true) return '';
    if (typeof client.isSpectator === 'function' && client.isSpectator() === true) return '';
    const gameState = root.gameState;
    if (!gameState || typeof gameState !== 'object') return '';
    if (gameState.__resultShown === true || Number(gameState.consecutivePasses) >= 2) return '';
    const roomId = typeof client.getRoomId === 'function' ? String(client.getRoomId() || '') : '';
    const stateVersion = typeof client.getStateVersion === 'function' ? client.getStateVersion() : null;
    if (!roomId || stateVersion === null || typeof stateVersion === 'undefined') return '';
    return `${roomId}:${stateVersion}:${gameState.currentPlayer}`;
  }

  function check(): boolean {
    const key = readTurnKey();
    if (!key || key === evaluatedKey) return false;
    if (CardRuntimeIntegrity.isCardRuntimeIntegrityBlocked()) return false;
    // AUTO は auto-play がパスを含めて送る。
    if (root.AUTO_MODE_ACTIVE === true) return false;
    if (typeof client.getNetworkAutoEnabled === 'function' && client.getNetworkAutoEnabled() === true) return false;
    if (
      isPlaybackBusy(root)
      || (typeof config.hasPendingLocalPublishes === 'function' && config.hasPendingLocalPublishes() === true)
    ) {
      idleKey = '';
      return false;
    }
    const currentTime = now();
    if (idleKey !== key) {
      idleKey = key;
      idleSince = currentTime;
    }
    // 盤面の結果を見せてから送る。
    if (currentTime - idleSince < settleDelayMs) return false;
    evaluatedKey = key;
    const ensure = root.ensureCurrentPlayerCanActOrPass;
    if (typeof ensure !== 'function') return false;
    try {
      return ensure() === true;
    } catch (_error) {
      return false;
    }
  }

  function start(): void {
    if (intervalHandle !== null) return;
    const setIntervalFn = config.setIntervalFn || ((callback: () => void, ms: number) => {
      const handle: any = setInterval(callback, ms);
      // Node（テスト）ではこの監視だけでプロセスを生かさない。
      if (handle && typeof handle.unref === 'function') handle.unref();
      return handle;
    });
    const pollIntervalMs = Number.isFinite(Number(config.pollIntervalMs)) ? Number(config.pollIntervalMs) : DEFAULT_POLL_INTERVAL_MS;
    intervalHandle = setIntervalFn(() => { check(); }, pollIntervalMs);
  }

  function stop(): void {
    if (intervalHandle === null) return;
    const clearIntervalFn = config.clearIntervalFn || ((handle: any) => clearInterval(handle));
    clearIntervalFn(intervalHandle);
    intervalHandle = null;
  }

  return { check, start, stop };
}

export = {
  createNetworkNoActionPassMonitor
};
