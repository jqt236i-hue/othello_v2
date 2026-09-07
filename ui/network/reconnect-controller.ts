import type { NetworkReconnectState } from './client-state';
'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function createNetworkReconnectController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  // Legacy getState remains an adapter for existing standalone consumers.
  const getState = cfg.state ? () => cfg.state : (typeof cfg.getState === 'function' ? cfg.getState : () => null);
  const scheduleTimeout = typeof cfg.scheduleTimeout === 'function'
    ? cfg.scheduleTimeout
    : function (fn: any, ms: number) { return setTimeout(fn, ms); };
  const clearScheduledTimeout = typeof cfg.clearScheduledTimeout === 'function'
    ? cfg.clearScheduledTimeout
    : function (id: any) { clearTimeout(id); };

  function readState(): NetworkReconnectState {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_reconnect_state_required');
    }
    return state;
  }

  function runRecoverySync(kind: string, syncOptions: any, handlers?: any): boolean {
    const state = readState();
    if (state.networkRecoverySyncInFlight === true || state.heartbeatResyncInFlight === true) {
      return false;
    }
    state.networkRecoverySyncInFlight = true;
    if (kind === 'heartbeat') {
      state.heartbeatResyncInFlight = true;
    }
    Promise.resolve(
      typeof cfg.syncLatestStateWithRetry === 'function'
        ? cfg.syncLatestStateWithRetry(syncOptions)
        : null
    )
      .then(function (result: any) {
        if (handlers && typeof handlers.onSuccess === 'function') {
          handlers.onSuccess(result);
        }
      })
      .catch(function (error: any) {
        if (handlers && typeof handlers.onFailure === 'function') {
          handlers.onFailure(error);
        }
      })
      .finally(function () {
        state.networkRecoverySyncInFlight = false;
        if (kind === 'heartbeat') {
          state.heartbeatResyncInFlight = false;
        }
      });
    return true;
  }

  function maybeSyncFromHeartbeat(payload: any): void {
    const state = readState();
    const remoteVersion = Number.isFinite(Number(payload && payload.stateVersion))
      ? Number(payload.stateVersion)
      : null;
    if (remoteVersion === null) return;

    const localVersion = typeof cfg.getAppliedStateVersion === 'function'
      ? cfg.getAppliedStateVersion()
      : null;
    if (localVersion !== null && remoteVersion <= localVersion) return;
    if (state.heartbeatResyncInFlight || state.networkRecoverySyncInFlight === true) return;

    if (typeof cfg.recordNetworkTelemetry === 'function') {
      cfg.recordNetworkTelemetry('heartbeat_resync_requested', {
        remoteVersion: remoteVersion,
        localVersion: localVersion
      });
    }
    runRecoverySync('heartbeat', { maxAttempts: 2, baseDelayMs: 300, source: 'heartbeat_recovery' }, {
      onSuccess: function () {
        if (typeof cfg.recordNetworkTelemetry === 'function') {
          cfg.recordNetworkTelemetry('heartbeat_resync_succeeded', {
            remoteVersion: remoteVersion,
            localVersionBefore: localVersion,
            localVersionAfter: Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null
          });
        }
      },
      onFailure: function () {
        if (typeof cfg.recordNetworkTelemetry === 'function') {
          cfg.recordNetworkTelemetry('heartbeat_resync_failed', {
            remoteVersion: remoteVersion,
            localVersion: localVersion
          });
        }
      }
    });
  }

  function clearReconnectTimer(): void {
    const state = readState();
    if (state.reconnectTimerId !== null) {
      clearScheduledTimeout(state.reconnectTimerId);
      state.reconnectTimerId = null;
    }
  }

  function clearReconnectRecoveryTimer(): void {
    const state = readState();
    if (state.reconnectRecoveryTimerId !== null) {
      clearScheduledTimeout(state.reconnectRecoveryTimerId);
      state.reconnectRecoveryTimerId = null;
    }
  }

  function completeReconnectRecoveryFromStream(): void {
    const state = readState();
    if (!state.reconnectRecoveryPending) return;
    state.reconnectRecoveryPending = false;
    clearReconnectRecoveryTimer();
  }

  function scheduleReconnectRecoverySync(): void {
    const state = readState();
    clearReconnectRecoveryTimer();
    state.reconnectRecoveryPending = true;
    state.reconnectRecoveryTimerId = scheduleTimeout(function () {
      state.reconnectRecoveryTimerId = null;
      if (!state.reconnectRecoveryPending) return;
      state.reconnectRecoveryPending = false;
      runRecoverySync('reconnect', { maxAttempts: 3, baseDelayMs: 350, source: 'state_sync' });
    }, cfg.reconnectRecoveryWaitMs);
  }

  function clearStreamWatchdogTimer(): void {
    const state = readState();
    if (!state.streamWatchdogTimerId) return;
    clearScheduledTimeout(state.streamWatchdogTimerId);
    state.streamWatchdogTimerId = 0;
  }

  function markStreamActivity(): void {
    const state = readState();
    state.lastStreamActivityAt = Date.now();
  }

  function rememberStreamEventId(event: any): void {
    const state = readState();
    const eventId = String(
      event && typeof event === 'object'
        ? (event.lastEventId || event.eventId || '')
        : ''
    ).trim();
    if (!eventId) return;
    state.lastStreamEventId = eventId;
  }

  function scheduleStreamWatchdog(): void {
    const state = readState();
    clearStreamWatchdogTimer();
    if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
    if (!state.eventSource) return;

    state.streamWatchdogTimerId = scheduleTimeout(function () {
      state.streamWatchdogTimerId = 0;
      if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
      if (!state.eventSource) return;

      const lastActivityAt = Number.isFinite(Number(state.lastStreamActivityAt))
        ? Number(state.lastStreamActivityAt)
        : 0;
      const elapsedMs = Date.now() - lastActivityAt;

      if (elapsedMs >= cfg.streamStaleTimeoutMs) {
        if (typeof cfg.emitStatus === 'function') {
          cfg.emitStatus('ネット対戦: 配信接続の応答がないため再接続します', true);
        }
        try {
          if (state.eventSource) {
            state.eventSource.close();
          }
        } catch (e) { /* ignore */ }
        state.eventSource = null;
        scheduleStreamReconnect();
        return;
      }

      scheduleStreamWatchdog();
    }, cfg.streamWatchdogIntervalMs);
  }

  function scheduleStreamReconnect(): void {
    const state = readState();
    if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
    if (state.reconnectTimerId !== null) return;

    const attempt = Number.isFinite(Number(state.reconnectAttempt))
      ? Number(state.reconnectAttempt)
      : 0;
    const delayMs = typeof cfg.computeRetryDelayMs === 'function'
      ? cfg.computeRetryDelayMs(cfg.reconnectBaseDelayMs, cfg.reconnectMaxDelayMs, attempt)
      : cfg.reconnectBaseDelayMs;
    state.reconnectAttempt = attempt + 1;

    state.reconnectTimerId = scheduleTimeout(function () {
      state.reconnectTimerId = null;
      if (typeof cfg.isActive === 'function' && cfg.isActive() !== true) return;
      if (typeof cfg.openStream === 'function') {
        cfg.openStream({ reconnect: true });
      }
    }, delayMs);
  }

  function closeStream(): void {
    const state = readState();
    clearReconnectTimer();
    clearReconnectRecoveryTimer();
    state.reconnectRecoveryPending = false;
    state.networkRecoverySyncInFlight = false;
    clearStreamWatchdogTimer();
    if (state.eventSource) {
      try { state.eventSource.close(); } catch (e) { /* ignore */ }
      state.eventSource = null;
    }
    state.lastStreamActivityAt = 0;
  }

  return {
    maybeSyncFromHeartbeat,
    clearReconnectTimer,
    clearReconnectRecoveryTimer,
    completeReconnectRecoveryFromStream,
    scheduleReconnectRecoverySync,
    clearStreamWatchdogTimer,
    markStreamActivity,
    rememberStreamEventId,
    scheduleStreamWatchdog,
    scheduleStreamReconnect,
    closeStream
  };
}

const NetworkReconnectController = {
  createNetworkReconnectController
};

export = NetworkReconnectController;
