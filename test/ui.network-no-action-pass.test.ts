const { createNetworkNoActionPassMonitor } = require('../ui/network/no-action-pass');

function createHarness(overrides?: any) {
  let nowMs = 1000;
  const root: any = {
    gameState: { currentPlayer: 1, consecutivePasses: 0 },
    cardState: {},
    ensureCurrentPlayerCanActOrPass: jest.fn(() => true),
    ...(overrides?.root || {})
  };
  const client: any = {
    isActive: () => true,
    isSpectator: () => false,
    getRoomId: () => 'ABC',
    getStateVersion: () => overrides?.stateVersion ?? 5,
    getNetworkAutoEnabled: () => false,
    ...(overrides?.client || {})
  };
  let pendingPublish = overrides?.pendingPublish === true;
  const monitor = createNetworkNoActionPassMonitor({
    root,
    client,
    hasPendingLocalPublishes: () => pendingPublish,
    settleDelayMs: 700,
    now: () => nowMs
  });
  return {
    root,
    client,
    monitor,
    advance(ms: number) { nowMs += ms; },
    setPendingPublish(value: boolean) { pendingPublish = value; }
  };
}

describe('network no-action pass monitor', () => {
  test('asks the pass handler once per received version after the board has settled', () => {
    const harness = createHarness();

    expect(harness.monitor.check()).toBe(false);
    harness.advance(300);
    expect(harness.monitor.check()).toBe(false);
    harness.advance(500);
    expect(harness.monitor.check()).toBe(true);
    expect(harness.root.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);

    harness.advance(1000);
    harness.monitor.check();
    expect(harness.root.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });

  test('waits while playback or an own publish is still running', () => {
    const harness = createHarness({ root: { VisualPlaybackActive: true } });
    harness.advance(2000);
    harness.monitor.check();
    expect(harness.root.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();

    harness.root.VisualPlaybackActive = false;
    harness.setPendingPublish(true);
    harness.monitor.check();
    harness.advance(2000);
    harness.monitor.check();
    expect(harness.root.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();

    harness.setPendingPublish(false);
    harness.monitor.check();
    harness.advance(800);
    harness.monitor.check();
    expect(harness.root.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });

  test('does nothing for spectators, finished games, or AUTO matches', () => {
    for (const overrides of [
      { client: { isSpectator: () => true } },
      { root: { gameState: { currentPlayer: 1, consecutivePasses: 2 } } },
      { root: { AUTO_MODE_ACTIVE: true } },
      { client: { getNetworkAutoEnabled: () => true } },
      { client: { isActive: () => false } }
    ]) {
      const harness = createHarness(overrides);
      harness.monitor.check();
      harness.advance(2000);
      harness.monitor.check();
      expect(harness.root.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    }
  });
});
