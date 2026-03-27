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
    global.__playbackActiveSince = null;
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
    delete global.__playbackActiveSince;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.AnimationEngine;
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
        clearPlaybackLock: jest.fn(() => {
          busyStateCalls.push({ clearPlaybackLock: true });
          global.isProcessing = false;
          global.isCardAnimating = false;
          global.VisualPlaybackActive = false;
          global.__playbackActiveSince = null;
          playbackActive = false;
        }),
        getProcessing: jest.fn(() => global.isProcessing === true),
        getCardAnimating: jest.fn(() => global.isCardAnimating === true || playbackActive === true),
        getPlaybackActive: jest.fn(() => playbackActive === true),
        getPlaybackStartedAt: jest.fn(() => {
          const startedAt = Number(global.__playbackActiveSince);
          return Number.isFinite(startedAt) ? startedAt : null;
        })
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

  test('force snapshot clears stale playback lock when no new playback exists and engine is idle', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);

    playbackActive = true;
    global.VisualPlaybackActive = true;
    global.__playbackActiveSince = 100;
    global.AnimationEngine = { isPlaying: false };

    const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });

    expect(applied).toBe(true);
    expect(playbackActive).toBe(false);
    expect(global.VisualPlaybackActive).toBe(false);
    expect(busyStateCalls).toEqual([
      { processing: false, cardAnimating: false },
      { clearPlaybackLock: true }
    ]);
  });

  test('force snapshot keeps playback lock while engine still reports active playback', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);

    playbackActive = true;
    global.VisualPlaybackActive = true;
    global.__playbackActiveSince = 100;
    global.AnimationEngine = { isPlaying: true };

    const applied = ctrl.applySnapshot(createSnapshot(11), { playbackEvents: [] });

    expect(applied).toBe(true);
    expect(playbackActive).toBe(true);
    expect(global.VisualPlaybackActive).toBe(true);
    expect(busyStateCalls).toEqual([
      { processing: false, cardAnimating: false }
    ]);
  });
});
