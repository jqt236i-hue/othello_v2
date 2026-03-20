function createBaseCardState() {
  return {
    selectedCardId: null,
    selectedCardOwnerKey: null,
    hands: { black: [], white: [] },
    charge: { black: 10, white: 10 },
    boardBonusByCell: {},
    boardBonusConsumedByCell: {},
    pendingEffectByPlayer: { black: null, white: null },
    hasUsedCardThisTurnByPlayer: { black: false, white: false },
    hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
    lastUsedCardByPlayer: { black: null, white: null },
    markers: [],
    discard: [],
    turnIndex: 1,
    presentationEvents: [],
    _presentationEventsPersist: []
  };
}

function createSnapshot(stateVersion) {
  return {
    stateVersion,
    gameState: {
      currentPlayer: 1,
      turnNumber: stateVersion,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    },
    cardState: createBaseCardState()
  };
}

function createPlaybackBatch(phase) {
  return [{
    type: 'PLAYBACK_EVENTS',
    events: [{ type: 'flip', phase, targets: [{ r: 2, col: 3 }] }]
  }];
}

describe('network snapshot pending presentation reconcile', () => {
  let busyStateCalls;
  let playbackActive;

  beforeEach(() => {
    jest.resetModules();

    const initial = createSnapshot(10);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.VisualPlaybackActive = false;
    global.isProcessing = false;
    global.isCardAnimating = false;

    busyStateCalls = [];
    playbackActive = false;
  });

  afterEach(() => {
    delete global.gameState;
    delete global.cardState;
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
      renderCardUI: global.renderCardUI,
      playbackState: {
        setBusyState: jest.fn((flags) => {
          busyStateCalls.push(flags);
          global.isProcessing = !!(flags && flags.processing === true);
          global.isCardAnimating = !!(flags && flags.cardAnimating === true);
        }),
        getPlaybackActive: jest.fn(() => playbackActive === true)
      }
    });
  }

  test('restored queues are cleared when refresh leaves stale pending presentation behind', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const liveQueue = createPlaybackBatch(1);
    const persistQueue = createPlaybackBatch(2);

    global.cardState.presentationEvents = liveQueue.slice();
    global.cardState._presentationEventsPersist = persistQueue.slice();

    const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });

    expect(applied).toBe(true);
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(global.cardState._presentationEventsPersist).toEqual([]);
    expect(busyStateCalls).toEqual([
      { processing: true, cardAnimating: true },
      { processing: false, cardAnimating: false }
    ]);
  });

  test('restored queues stay intact while local busy state is already active', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const liveQueue = createPlaybackBatch(1);
    const persistQueue = createPlaybackBatch(2);

    global.isProcessing = true;
    global.isCardAnimating = true;
    global.cardState.presentationEvents = liveQueue.slice();
    global.cardState._presentationEventsPersist = persistQueue.slice();

    const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });

    expect(applied).toBe(true);
    expect(global.cardState.presentationEvents).toEqual(liveQueue);
    expect(global.cardState._presentationEventsPersist).toEqual(persistQueue);
    expect(busyStateCalls).toEqual([
      { processing: true, cardAnimating: true }
    ]);
  });
});
