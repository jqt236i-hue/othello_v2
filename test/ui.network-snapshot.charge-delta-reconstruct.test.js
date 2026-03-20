function createBaseCardState(options = {}) {
  const sourceCharge = (options.charge && typeof options.charge === 'object') ? options.charge : {};
  const sourceEvents = Array.isArray(options.chargeDeltaEvents) ? options.chargeDeltaEvents : [];
  return {
    selectedCardId: null,
    selectedCardOwnerKey: null,
    hands: { black: [], white: [] },
    charge: {
      black: Number.isFinite(Number(sourceCharge.black)) ? Number(sourceCharge.black) : 10,
      white: Number.isFinite(Number(sourceCharge.white)) ? Number(sourceCharge.white) : 10
    },
    chargeDeltaEvents: sourceEvents.map((event) => ({ ...event })),
    boardBonusByCell: {},
    boardBonusConsumedByCell: {},
    pendingEffectByPlayer: { black: null, white: null },
    hasUsedCardThisTurnByPlayer: { black: false, white: false },
    hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
    lastUsedCardByPlayer: { black: null, white: null },
    markers: [],
    discard: [],
    turnIndex: Number.isFinite(Number(options.turnIndex)) ? Number(options.turnIndex) : 1,
    presentationEvents: [],
    _presentationEventsPersist: []
  };
}

function createSnapshot(stateVersion, options = {}) {
  return {
    stateVersion,
    gameState: {
      currentPlayer: 1,
      turnNumber: stateVersion,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    },
    cardState: createBaseCardState(options)
  };
}

describe('network snapshot charge delta reconstruction', () => {
  beforeEach(() => {
    jest.resetModules();
    const initial = createSnapshot(10);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;
    global.__networkTransientChargeDeltaEvents = [];
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.VisualPlaybackActive = false;
    global.isProcessing = false;
    global.isCardAnimating = false;
  });

  afterEach(() => {
    delete global.gameState;
    delete global.cardState;
    delete global.__networkTransientChargeDeltaEvents;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.VisualPlaybackActive;
    delete global.isProcessing;
    delete global.isCardAnimating;
  });

  function createController(stateObj) {
    const { createNetworkSnapshotController } = require('../ui/network/snapshot');
    return createNetworkSnapshotController({
      getState: () => stateObj,
      emitCardStateChange: global.emitCardStateChange,
      emitGameStateChange: global.emitGameStateChange,
      emitBoardUpdate: global.emitBoardUpdate,
      renderCardUI: global.renderCardUI
    });
  }

  test('reconstructs missing charge delta events for incremental snapshots', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    global.cardState.charge = { black: 5, white: 3 };

    const applied = ctrl.applySnapshot(createSnapshot(11, {
      charge: { black: 7, white: 1 },
      chargeDeltaEvents: []
    }), { playbackEvents: [] });

    expect(applied).toBe(true);
    expect(global.cardState.chargeDeltaEvents).toEqual([]);
    expect(global.__networkTransientChargeDeltaEvents).toEqual([
      { seq: 1, player: 'black', before: 5, after: 7, delta: 2, reason: 'network_snapshot_charge_sync' },
      { seq: 2, player: 'white', before: 3, after: 1, delta: -2, reason: 'network_snapshot_charge_sync' }
    ]);
    expect(global.renderCardUI).toHaveBeenCalledTimes(1);
  });

  test('does not synthesize charge delta events for force-sync snapshots', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    global.cardState.charge = { black: 5, white: 3 };

    const applied = ctrl.applySnapshot(createSnapshot(11, {
      charge: { black: 7, white: 3 },
      chargeDeltaEvents: []
    }), { force: true });

    expect(applied).toBe(true);
    expect(global.cardState.chargeDeltaEvents).toEqual([]);
    expect(global.__networkTransientChargeDeltaEvents).toEqual([]);
  });

  test('keeps authoritative charge delta events without duplicating them', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    global.cardState.charge = { black: 5, white: 3 };

    const authoritativeEvents = [
      { seq: 7, player: 'black', before: 5, after: 8, delta: 3, reason: 'server_gain' }
    ];
    const applied = ctrl.applySnapshot(createSnapshot(11, {
      charge: { black: 8, white: 3 },
      chargeDeltaEvents: authoritativeEvents
    }), { playbackEvents: [] });

    expect(applied).toBe(true);
    expect(global.cardState.chargeDeltaEvents).toEqual(authoritativeEvents);
    expect(global.__networkTransientChargeDeltaEvents).toEqual([]);
  });
});
