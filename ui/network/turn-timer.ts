'use strict';

function createNetworkTurnTimerController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };
  const scheduleTimeout = typeof cfg.scheduleTimeout === 'function'
    ? cfg.scheduleTimeout
    : function (fn: any, ms: number) { return setTimeout(fn, ms); };
  const clearScheduledTimeout = typeof cfg.clearScheduledTimeout === 'function'
    ? cfg.clearScheduledTimeout
    : function (id: any) { clearTimeout(id); };
  const now = typeof cfg.now === 'function' ? cfg.now : function () { return Date.now(); };
  const defaultLimitSeconds = Number.isFinite(Number(cfg.defaultLimitSeconds))
    ? Math.max(1, Math.trunc(Number(cfg.defaultLimitSeconds)))
    : 120;

  function readState(): any {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_turn_timer_state_required');
    }
    return state;
  }

  function normalizePlayerKey(value: any): string {
    if (typeof cfg.normalizePlayerKey === 'function') {
      return cfg.normalizePlayerKey(value);
    }
    const normalized = String(value || '').trim().toLowerCase();
    return normalized === 'white' ? 'white' : 'black';
  }

  function normalizeTurnTimerPayload(value: any): any {
    const source = (value && typeof value === 'object') ? value : {};
    const limitSeconds = Number.isFinite(Number(source.limitSeconds))
      ? Math.max(1, Math.trunc(Number(source.limitSeconds)))
      : defaultLimitSeconds;
    const turnSeatKey = normalizePlayerKey(source.turnSeatKey);
    const turnStartedAt = Number.isFinite(Number(source.turnStartedAt))
      ? Math.max(0, Math.trunc(Number(source.turnStartedAt)))
      : null;
    const turnDeadlineAt = Number.isFinite(Number(source.turnDeadlineAt))
      ? Math.max(0, Math.trunc(Number(source.turnDeadlineAt)))
      : null;
    const active = !!source.active && turnDeadlineAt !== null;

    return {
      limitSeconds,
      active,
      turnSeatKey,
      turnStartedAt: active ? turnStartedAt : null,
      turnDeadlineAt: active ? turnDeadlineAt : null
    };
  }

  function updateServerTimeOffset(serverTimeValue: any): void {
    const state = readState();
    const serverTime = Number(serverTimeValue);
    if (!Number.isFinite(serverTime)) return;
    state.serverTimeOffsetMs = serverTime - now();
  }

  function getAdjustedNowMs(): number {
    const state = readState();
    return now() + (Number.isFinite(Number(state.serverTimeOffsetMs)) ? Number(state.serverTimeOffsetMs) : 0);
  }

  function getTurnTimerInfo(): any {
    const state = readState();
    const timer = normalizeTurnTimerPayload(state.turnTimer);
    const deadlineAt = Number.isFinite(Number(timer.turnDeadlineAt)) ? Number(timer.turnDeadlineAt) : null;
    const active = !!timer.active && deadlineAt !== null;
    const remainingMs = active ? Math.max(0, deadlineAt - getAdjustedNowMs()) : null;

    return {
      limitSeconds: timer.limitSeconds,
      active,
      turnSeatKey: timer.turnSeatKey,
      turnStartedAt: active ? timer.turnStartedAt : null,
      turnDeadlineAt: active ? deadlineAt : null,
      remainingMs,
      isOwnTurn: active && timer.turnSeatKey === state.seatKey
    };
  }

  function emitTurnTimerChanged(): void {
    const state = readState();
    if (typeof state.turnTimerListener !== 'function') return;
    try {
      state.turnTimerListener(getTurnTimerInfo());
    } catch (e) { /* ignore */ }
  }

  function clearTurnTimerTick(): void {
    const state = readState();
    if (!state.turnTimerTickHandle) return;
    clearScheduledTimeout(state.turnTimerTickHandle);
    state.turnTimerTickHandle = 0;
  }

  function maybeSyncLatestStateAfterTimeout(timerInfo: any): void {
    const state = readState();
    if (!timerInfo || timerInfo.active !== true) return;
    if (!Number.isFinite(Number(timerInfo.turnDeadlineAt))) return;
    if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
    if (!state.seatToken) return;

    const deadlineAt = Number(timerInfo.turnDeadlineAt);
    if (state.turnTimerSyncRequestedDeadline === deadlineAt) return;
    state.turnTimerSyncRequestedDeadline = deadlineAt;

    Promise.resolve(
      typeof cfg.syncLatestState === 'function'
        ? cfg.syncLatestState()
        : null
    ).catch(function () {
      // keep countdown loop stable even when one sync request fails
    });
  }

  function scheduleTurnTimerTick(): void {
    const state = readState();
    clearTurnTimerTick();

    const info = getTurnTimerInfo();
    emitTurnTimerChanged();

    if (!info.active) return;

    const waitMs = (info.remainingMs !== null && info.remainingMs <= 10000) ? 250 : 1000;
    state.turnTimerTickHandle = scheduleTimeout(function () {
      state.turnTimerTickHandle = 0;
      const nextInfo = getTurnTimerInfo();
      emitTurnTimerChanged();
      if (nextInfo.active && nextInfo.remainingMs !== null && nextInfo.remainingMs <= 0) {
        maybeSyncLatestStateAfterTimeout(nextInfo);
      }
      scheduleTurnTimerTick();
    }, waitMs);
  }

  function resetTurnTimerState(): void {
    const state = readState();
    state.turnTimer = normalizeTurnTimerPayload(null);
    state.turnTimerSyncRequestedDeadline = null;
    state.serverTimeOffsetMs = 0;
    state.heartbeatResyncInFlight = false;
    clearTurnTimerTick();
    emitTurnTimerChanged();
  }

  function updateTurnTimerFromPayload(payload: any): void {
    const state = readState();
    if (!payload || typeof payload !== 'object') return;

    updateServerTimeOffset(payload.serverTime);

    if (!Object.prototype.hasOwnProperty.call(payload, 'turnTimer')) return;

    const prevDeadline = Number.isFinite(Number(state.turnTimer && state.turnTimer.turnDeadlineAt))
      ? Number(state.turnTimer.turnDeadlineAt)
      : null;
    const nextTimer = normalizeTurnTimerPayload(payload.turnTimer);

    state.turnTimer = nextTimer;

    const nextDeadline = Number.isFinite(Number(nextTimer.turnDeadlineAt)) ? Number(nextTimer.turnDeadlineAt) : null;
    if (!nextTimer.active || nextDeadline !== prevDeadline) {
      state.turnTimerSyncRequestedDeadline = null;
    }

    scheduleTurnTimerTick();
  }

  function setTurnTimerListener(listener: any): void {
    const state = readState();
    state.turnTimerListener = (typeof listener === 'function') ? listener : null;
    emitTurnTimerChanged();
  }

  return {
    getTurnTimerInfo,
    resetTurnTimerState,
    updateTurnTimerFromPayload,
    setTurnTimerListener
  };
}

const NetworkTurnTimerModule = {
  createNetworkTurnTimerController
};

export = NetworkTurnTimerModule;
