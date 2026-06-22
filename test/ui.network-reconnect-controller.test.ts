const { createNetworkReconnectController } = require('../ui/network/reconnect-controller');

describe('NetworkReconnectController', () => {
  function createDeferred() {
    let resolve: any;
    let reject: any;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  async function flushRecoveryPromise() {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  }

  function createHarness() {
    const deferred = createDeferred();
    const scheduled: Array<() => void> = [];
    const syncLatestStateWithRetry = jest.fn(() => deferred.promise);
    const state = {
      heartbeatResyncInFlight: false,
      networkRecoverySyncInFlight: false,
      reconnectRecoveryPending: false,
      reconnectRecoveryTimerId: null,
      eventSource: { close: jest.fn() },
      lastStreamActivityAt: 0,
      streamWatchdogTimerId: 0,
      reconnectTimerId: null,
      reconnectAttempt: 0
    };
    const controller = createNetworkReconnectController({
      getState: () => state,
      isActive: () => true,
      getAppliedStateVersion: () => 3,
      syncLatestStateWithRetry,
      recordNetworkTelemetry: jest.fn(),
      scheduleTimeout: (fn: any) => {
        scheduled.push(fn);
        return scheduled.length;
      },
      clearScheduledTimeout: jest.fn(),
      streamStaleTimeoutMs: 1,
      streamWatchdogIntervalMs: 1,
      reconnectBaseDelayMs: 1,
      reconnectMaxDelayMs: 1,
      reconnectRecoveryWaitMs: 1,
      computeRetryDelayMs: () => 1,
      openStream: jest.fn(),
      emitStatus: jest.fn()
    });
    const runNextScheduled = () => {
      const fn = scheduled.shift();
      if (typeof fn === 'function') fn();
    };
    return { controller, deferred, runNextScheduled, scheduled, state, syncLatestStateWithRetry };
  }

  test('heartbeat resync and watchdog reconnect share one recovery flight', async () => {
    const { controller, deferred, runNextScheduled, state, syncLatestStateWithRetry } = createHarness();

    controller.maybeSyncFromHeartbeat({ stateVersion: 4 });
    controller.scheduleReconnectRecoverySync();
    runNextScheduled();

    expect(syncLatestStateWithRetry).toHaveBeenCalledTimes(1);
    expect(state.networkRecoverySyncInFlight).toBe(true);
    expect(state.heartbeatResyncInFlight).toBe(true);
    expect(syncLatestStateWithRetry).toHaveBeenCalledWith(expect.objectContaining({
      source: 'heartbeat_recovery'
    }));

    deferred.resolve({ ok: true });
    await flushRecoveryPromise();

    expect(state.networkRecoverySyncInFlight).toBe(false);
    expect(state.heartbeatResyncInFlight).toBe(false);
  });

  test('heartbeatResyncInFlight prevents duplicate heartbeat recovery', async () => {
    const { controller, deferred, state, syncLatestStateWithRetry } = createHarness();

    controller.maybeSyncFromHeartbeat({ stateVersion: 4 });
    controller.maybeSyncFromHeartbeat({ stateVersion: 5 });

    expect(syncLatestStateWithRetry).toHaveBeenCalledTimes(1);
    expect(state.networkRecoverySyncInFlight).toBe(true);
    expect(state.heartbeatResyncInFlight).toBe(true);
    expect(syncLatestStateWithRetry).toHaveBeenCalledWith(expect.objectContaining({
      source: 'heartbeat_recovery'
    }));

    deferred.resolve({ ok: true });
    await flushRecoveryPromise();

    expect(state.networkRecoverySyncInFlight).toBe(false);
    expect(state.heartbeatResyncInFlight).toBe(false);
  });

  test('networkRecoverySyncInFlight prevents duplicate reconnect recovery', async () => {
    const { controller, deferred, runNextScheduled, state, syncLatestStateWithRetry } = createHarness();

    controller.scheduleReconnectRecoverySync();
    runNextScheduled();
    controller.scheduleReconnectRecoverySync();
    runNextScheduled();

    expect(syncLatestStateWithRetry).toHaveBeenCalledTimes(1);
    expect(state.networkRecoverySyncInFlight).toBe(true);
    expect(syncLatestStateWithRetry).toHaveBeenCalledWith(expect.objectContaining({
      source: 'state_sync'
    }));

    deferred.resolve({ ok: true });
    await flushRecoveryPromise();

    expect(state.networkRecoverySyncInFlight).toBe(false);
  });
});
