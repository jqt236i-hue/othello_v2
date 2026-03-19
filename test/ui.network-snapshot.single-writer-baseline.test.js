/**
 * Phase 0: Single Writer 化のベースラインテスト
 *
 * applySnapshot 経由の playbackEvents 転送、busy state、pending selection を検証する。
 * Phase 1-5 で挙動を変更する際の回帰検知に使う。
 */
const { JSDOM } = require('jsdom');

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

describe('applySnapshot single-writer baseline', () => {
  let dom;
  let emittedEvents;
  let busyStateCalls;
  let syncPendingCalls;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;

    const initial = createSnapshot(10);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;

    emittedEvents = [];
    busyStateCalls = [];
    syncPendingCalls = [];

    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.BoardOps = {
      emitPresentationEvent: jest.fn((_ref, ev) => {
        emittedEvents.push(ev);
      })
    };
    global.syncPendingSelectionActionCache = jest.fn((pending) => {
      syncPendingCalls.push(pending);
    });
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.gameState;
    delete global.cardState;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.BoardOps;
    delete global.syncPendingSelectionActionCache;
    delete global.isProcessing;
    delete global.isCardAnimating;
    if (dom) dom.window.close();
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
        setBusyState: (flags) => busyStateCalls.push(flags)
      }
    });
  }

  test('playbackEvents がそのまま emitPlaybackEvents (PLAYBACK_EVENTS) に渡る', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);
    const events = [{ type: 'flip', phase: 1, targets: [{ r: 2, c: 3 }] }];

    const applied = ctrl.applySnapshot(snap, { playbackEvents: events });
    expect(applied).toBe(true);

    const pbEvent = emittedEvents.find(e => e.type === 'PLAYBACK_EVENTS');
    expect(pbEvent).toBeTruthy();
    expect(pbEvent.events).toBe(events);
    expect(pbEvent.meta.source).toBe('network_snapshot');
    expect(pbEvent.meta.suppressPlayback).not.toBe(true);
  });

  test('playbackEvents なしで shadow なしの場合 busy は false になる', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);

    ctrl.applySnapshot(snap, { playbackEvents: [] });

    const lastBusy = busyStateCalls[busyStateCalls.length - 1];
    expect(lastBusy.processing).toBe(false);
    expect(lastBusy.cardAnimating).toBe(false);
  });

  test('playbackEvents ありの場合 busy は true になる', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);

    ctrl.applySnapshot(snap, {
      playbackEvents: [{ type: 'flip', phase: 1, targets: [] }]
    });

    // setBusyState(shouldKeepBusy) is called with true when playbackEvents exist
    const busyCall = busyStateCalls.find(c => c.processing === true);
    expect(busyCall).toBeTruthy();
  });

  test('snapshot の pendingEffectByPlayer が cardState に反映される', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);
    snap.cardState.pendingEffectByPlayer = {
      black: { type: 'TRAP_WILL', stage: 'selectTarget' },
      white: null
    };

    ctrl.applySnapshot(snap, { playbackEvents: [] });

    expect(global.cardState.pendingEffectByPlayer.black).toEqual({
      type: 'TRAP_WILL',
      stage: 'selectTarget'
    });
  });

  test('snapshot 適用後に syncPendingSelectionActionCache が呼ばれる', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);
    snap.cardState.pendingEffectByPlayer = {
      black: { type: 'CONDEMN_WILL', stage: 'selectTarget' },
      white: null
    };

    ctrl.applySnapshot(snap, { playbackEvents: [] });

    expect(syncPendingCalls.length).toBeGreaterThanOrEqual(1);
    const lastSync = syncPendingCalls[syncPendingCalls.length - 1];
    expect(lastSync.black).toEqual({ type: 'CONDEMN_WILL', stage: 'selectTarget' });
  });

  test('snapshot 適用で時間停止の永続状態を保持しつつ transient queue を落とす', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);

    snap.cardState.timeStopConsecutiveTurnsRemainingByPlayer = { black: 2, white: 0 };
    snap.cardState.markers = [
      {
        id: 41,
        kind: 'specialStone',
        row: 2,
        col: 2,
        owner: 'black',
        data: { type: 'TIME_STOP', remainingOwnerTurns: 1 }
      }
    ];
    snap.cardState.presentationEvents = [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }];
    snap.cardState._presentationEventsPersist = [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 2 }] }];

    ctrl.applySnapshot(snap, { playbackEvents: [] });

    expect(global.cardState.timeStopConsecutiveTurnsRemainingByPlayer).toEqual({ black: 2, white: 0 });
    expect(global.cardState.markers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        row: 2,
        col: 2,
        owner: 'black',
        data: expect.objectContaining({ type: 'TIME_STOP', remainingOwnerTurns: 1 })
      })
    ]));
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(global.cardState._presentationEventsPersist).toEqual([]);
  });

  test('stale version の snapshot は適用されない', () => {
    const stateObj = { stateVersion: 15 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(10);

    const applied = ctrl.applySnapshot(snap, { playbackEvents: [] });
    expect(applied).toBe(false);
    expect(emittedEvents).toHaveLength(0);
  });

  test('force:true なら stale version でも適用される', () => {
    const stateObj = { stateVersion: 15 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(10);

    const applied = ctrl.applySnapshot(snap, { playbackEvents: [], force: true });
    expect(applied).toBe(true);
  });
});
