const { createNetworkReconnectController } = require('../ui/network/reconnect-controller');

describe('NetworkReconnectController', () => {
  test('heartbeat resync and watchdog reconnect share one recovery flight', async () => {
    const syncLatestStateWithRetry = jest.fn(() => Promise.resolve({ ok: true }));
    const state = {
      heartbeatResyncInFlight: false,
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
        fn();
        return 1;
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

    controller.maybeSyncFromHeartbeat({ stateVersion: 4 });
    controller.scheduleReconnectRecoverySync();

    await Promise.resolve();
    await Promise.resolve();

    expect(syncLatestStateWithRetry).toHaveBeenCalledTimes(1);
    expect(syncLatestStateWithRetry).toHaveBeenCalledWith(expect.objectContaining({
      source: 'heartbeat_recovery'
    }));
  });
});
