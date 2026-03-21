const { JSDOM } = require('jsdom');

describe('NetworkMatchClient result sync', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.gameState = { currentPlayer: 1, turnNumber: 1 };
    global.cardState = { markers: [] };

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.ensureLegacyMarkers = jest.fn((state) => {
      state.specialStones = [{ row: 1, col: 2, type: 'WORK' }];
      state.bombs = [{ row: 3, col: 4, remainingTurns: 2 }];
    });
    window.ensureLegacyMarkers = global.ensureLegacyMarkers;

    global.isGameOver = jest.fn(() => true);
    global.showResult = jest.fn();
  });

  afterEach(() => {
    try { if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close(); } catch (e) {}

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.gameState;
    delete global.cardState;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.BoardOps;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.ensureLegacyMarkers;
    delete global.isGameOver;
    delete global.showResult;
  });

  test('終局スナップショット受信で結果表示を一度だけ行う', () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const terminalSnapshot = {
      stateVersion: 7,
      gameState: { currentPlayer: -1, turnNumber: 40, __resultShown: true },
      cardState: { markers: [] }
    };

    const first = client.applySnapshot(terminalSnapshot, { force: true });
    const second = client.applySnapshot(terminalSnapshot, { force: true });

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(global.showResult).toHaveBeenCalledTimes(1);
  });

  test('skipResultOverlay 指定時は結果表示を行わない', () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const terminalSnapshot = {
      stateVersion: 8,
      gameState: { currentPlayer: -1, turnNumber: 41, __resultShown: true },
      cardState: { markers: [] }
    };

    client.applySnapshot(terminalSnapshot, { force: true, skipResultOverlay: true });

    expect(global.showResult).not.toHaveBeenCalled();
  });

  test('playbackEventsがあるスナップショット反映では即時renderCardUIしない', () => {
    global.cardState = { markers: [], presentationEvents: [] };
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const snapshot = {
      stateVersion: 9,
      gameState: { currentPlayer: 1, turnNumber: 42, __resultShown: false },
      cardState: { markers: [], presentationEvents: [] }
    };

    client.applySnapshot(snapshot, {
      force: true,
      skipResultOverlay: true,
      playbackEvents: [{ type: 'hand_remove', phase: 1, targets: [{ player: 'white', count: 1 }] }]
    });

    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.renderCardUI).not.toHaveBeenCalled();
  });

  test('network snapshot clears stale presentation queues and keeps busy lock while playback starts', () => {
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.cardState = {
      markers: [],
      presentationEvents: [{ type: 'stale_live' }],
      _presentationEventsPersist: [{ type: 'stale_persist' }]
    };
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    client.applySnapshot({
      stateVersion: 10,
      gameState: { currentPlayer: 1, turnNumber: 42, __resultShown: false },
      cardState: {
        markers: [],
        presentationEvents: [{ type: 'stale_from_snapshot' }],
        _presentationEventsPersist: [{ type: 'stale_persist_from_snapshot' }]
      }
    }, {
      force: true,
      skipResultOverlay: true,
      playbackEvents: [{ type: 'hand_add', phase: 1, targets: [{ player: 'black', count: 1 }] }]
    });

    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.cardState.presentationEvents).toHaveLength(1);
    expect(global.cardState.presentationEvents[0].type).toBe('PLAYBACK_EVENTS');
    expect(global.cardState._presentationEventsPersist).toEqual([]);
  });

  test('force sync without incoming playback preserves local presentation queues', () => {
    global.isProcessing = true;
    global.isCardAnimating = true;
    global.cardState = {
      markers: [],
      presentationEvents: [{ type: 'local_live' }],
      _presentationEventsPersist: [{ type: 'local_persist' }]
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    client.applySnapshot({
      stateVersion: 11,
      gameState: { currentPlayer: 1, turnNumber: 44, __resultShown: false },
      cardState: {
        markers: [],
        presentationEvents: [{ type: 'stale_from_snapshot' }],
        _presentationEventsPersist: [{ type: 'stale_persist_from_snapshot' }]
      }
    }, {
      force: true,
      skipResultOverlay: true
    });

    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);
    expect(global.cardState.presentationEvents).toEqual([{ type: 'local_live' }]);
    expect(global.cardState._presentationEventsPersist).toEqual([{ type: 'local_persist' }]);
    expect(global.renderCardUI).not.toHaveBeenCalled();
  });

  test('visual playback only does not rearm busy lock on force sync when local queues are empty', () => {
    const playbackState = require('../ui/playback-state-manager');
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.cardState = {
      markers: [],
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    playbackState.setPlaybackActive(true);

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    client.applySnapshot({
      stateVersion: 12,
      gameState: { currentPlayer: 1, turnNumber: 45, __resultShown: false },
      cardState: {
        markers: [],
        presentationEvents: [{ type: 'stale_from_snapshot' }],
        _presentationEventsPersist: [{ type: 'stale_persist_from_snapshot' }]
      }
    }, {
      force: true,
      skipResultOverlay: true
    });

    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(global.cardState._presentationEventsPersist).toEqual([]);
    expect(global.renderCardUI).not.toHaveBeenCalled();
    playbackState.setPlaybackActive(false);
  });

  test('force snapshot without playback clears stale board update context', () => {
    const playbackState = require('../ui/playback-state-manager');
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    playbackState.armBoardUpdateContext({
      suppressFallbackFlip: true,
      source: 'network-client',
      reason: 'stale_self_snapshot_sync'
    });
    expect(playbackState.getSuppressNextDiffFlip()).toBe(true);

    client.applySnapshot({
      stateVersion: 13,
      gameState: { currentPlayer: 1, turnNumber: 46, __resultShown: false },
      cardState: { markers: [] }
    }, {
      force: true,
      skipResultOverlay: true
    });

    expect(playbackState.getBoardUpdateContext()).toBeNull();
    expect(playbackState.getSuppressNextDiffFlip()).toBe(false);
    expect(window.__suppressNextDiffFlip).toBe(false);
  });

  test('incoming snapshot transient state is stripped and telemetry records it', () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const applied = client.applySnapshot({
      stateVersion: 14,
      gameState: { currentPlayer: 1, turnNumber: 47, __resultShown: true },
      cardState: {
        markers: [],
        presentationEvents: [{ type: 'snapshot_live' }],
        _presentationEventsPersist: [{ type: 'snapshot_persist' }],
        _currentActionMeta: { type: 'PLACE' }
      }
    }, {
      force: true,
      skipResultOverlay: true
    });

    expect(applied).toBe(true);
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(global.cardState._presentationEventsPersist).toEqual([]);
    expect(global.cardState._currentActionMeta).toBeUndefined();
    expect(global.gameState.__resultShown).toBeUndefined();
    expect(client.getNetworkTelemetry().counts.snapshot_transient_state_stripped).toBe(1);
  });

  test('non-force snapshot without stateVersion is rejected and telemetry records it', () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const applied = client.applySnapshot({
      gameState: { currentPlayer: 1, turnNumber: 48 },
      cardState: { markers: [] }
    }, {
      force: false,
      skipResultOverlay: true
    });

    expect(applied).toBe(false);
    expect(client.getNetworkTelemetry().counts.snapshot_missing_state_version_rejected).toBe(1);
  });

  test('snapshot apply rehydrates legacy marker fields for fallback UI paths', () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const snapshot = {
      stateVersion: 10,
      gameState: { currentPlayer: 1, turnNumber: 43, __resultShown: false },
      cardState: {
        markers: [
          { id: 1, kind: 'specialStone', row: 1, col: 2, owner: 'black', data: { type: 'WORK' } },
          { id: 2, kind: 'specialStone', row: 3, col: 4, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }
        ]
      }
    };

    client.applySnapshot(snapshot, { force: true, skipResultOverlay: true });

    expect(global.ensureLegacyMarkers).toHaveBeenCalledTimes(1);
    expect(global.ensureLegacyMarkers).toHaveBeenCalledWith(global.cardState);
    expect(global.cardState.specialStones).toEqual([{ row: 1, col: 2, type: 'WORK' }]);
    expect(global.cardState.bombs).toEqual([{ row: 3, col: 4, remainingTurns: 2 }]);
  });
});
