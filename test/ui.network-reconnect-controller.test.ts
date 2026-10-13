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

  function createMultiFlightHarness() {
    const deferreds: Array<ReturnType<typeof createDeferred>> = [];
    const scheduled: Array<() => void> = [];
    const telemetry = jest.fn();
    let appliedVersion = 3;
    const syncLatestStateWithRetry = jest.fn(() => {
      const deferred = createDeferred();
      deferreds.push(deferred);
      return deferred.promise;
    });
    const state: any = {
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
      getAppliedStateVersion: () => appliedVersion,
      syncLatestStateWithRetry,
      recordNetworkTelemetry: telemetry,
      scheduleTimeout: (fn: any) => {
        scheduled.push(fn);
        return scheduled.length;
      },
      clearScheduledTimeout: jest.fn(),
      reconnectRecoveryWaitMs: 1,
      computeRetryDelayMs: () => 1,
      openStream: jest.fn(),
      emitStatus: jest.fn()
    });
    const startReconnectRecovery = () => {
      controller.scheduleReconnectRecoverySync();
      const fn = scheduled.shift();
      if (typeof fn === 'function') fn();
    };
    const reopen = () => {
      state.eventSource = { close: jest.fn() };
    };
    return {
      controller, deferreds, reopen, startReconnectRecovery, state, syncLatestStateWithRetry, telemetry,
      setAppliedVersion: (value: number) => { appliedVersion = value; }
    };
  }

  test('a run detached by close cannot release the flight of the newer run', async () => {
    const h = createMultiFlightHarness();

    h.startReconnectRecovery();                       // run A
    expect(h.syncLatestStateWithRetry).toHaveBeenCalledTimes(1);
    h.controller.closeStream();
    h.reopen();
    h.controller.maybeSyncFromHeartbeat({ stateVersion: 4 }); // run B
    expect(h.syncLatestStateWithRetry).toHaveBeenCalledTimes(2);

    h.deferreds[0].resolve({ ok: true });              // A finishes after B started
    await flushRecoveryPromise();

    expect(h.state.networkRecoverySyncInFlight).toBe(true);
    expect(h.state.heartbeatResyncInFlight).toBe(true);
    h.startReconnectRecovery();                       // must not start a third flight
    h.controller.maybeSyncFromHeartbeat({ stateVersion: 5 });
    expect(h.syncLatestStateWithRetry).toHaveBeenCalledTimes(2);

    h.deferreds[1].resolve({ ok: true });
    await flushRecoveryPromise();
    expect(h.state.networkRecoverySyncInFlight).toBe(false);
    expect(h.state.heartbeatResyncInFlight).toBe(false);
    h.startReconnectRecovery();
    expect(h.syncLatestStateWithRetry).toHaveBeenCalledTimes(3);
  });

  test.each([
    ['success', (d: any) => d.resolve({ ok: true }), 'heartbeat_resync_succeeded'],
    ['failure', (d: any) => d.reject(new Error('offline')), 'heartbeat_resync_failed']
  ])('a detached heartbeat run does not report its late %s into the new session', async (_label, settle, eventName) => {
    const h = createMultiFlightHarness();

    h.controller.maybeSyncFromHeartbeat({ stateVersion: 4 }); // old session run
    h.controller.closeStream();
    expect(h.state.networkRecoverySyncInFlight).toBe(false);
    expect(h.state.heartbeatResyncInFlight).toBe(false);
    h.reopen();
    h.startReconnectRecovery();                       // new session may start immediately
    expect(h.syncLatestStateWithRetry).toHaveBeenCalledTimes(2);

    settle(h.deferreds[0]);
    await flushRecoveryPromise();

    expect(h.telemetry).not.toHaveBeenCalledWith(eventName, expect.anything());
    expect(h.state.networkRecoverySyncInFlight).toBe(true);

    h.deferreds[1].resolve({ ok: true });
    await flushRecoveryPromise();
    expect(h.state.networkRecoverySyncInFlight).toBe(false);
  });

  test('the current run still reports success and failure', async () => {
    const h = createMultiFlightHarness();

    h.controller.maybeSyncFromHeartbeat({ stateVersion: 4 });
    h.deferreds[0].resolve({ ok: true });
    await flushRecoveryPromise();
    expect(h.telemetry).toHaveBeenCalledWith('heartbeat_resync_succeeded', expect.any(Object));

    h.controller.maybeSyncFromHeartbeat({ stateVersion: 5 });
    h.deferreds[1].reject(new Error('offline'));
    await flushRecoveryPromise();
    expect(h.telemetry).toHaveBeenCalledWith('heartbeat_resync_failed', expect.any(Object));
    expect(h.state.heartbeatResyncInFlight).toBe(false);
  });
});
