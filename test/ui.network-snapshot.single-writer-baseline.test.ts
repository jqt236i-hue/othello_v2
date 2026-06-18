/**
 * Phase 0: Single Writer 化のベースラインテスト
 *
 * applySnapshot 経由の playbackEvents 転送、busy state、pending selection を検証する。
 * Phase 1-5 で挙動を変更する際の回帰検知に使う。
 */
import { JSDOM } from 'jsdom';

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

function createSnapshot(stateVersion, options = {}) {
  const topLevelStateVersion = Number.isFinite(Number(options.topLevelStateVersion))
    ? Number(options.topLevelStateVersion)
    : stateVersion;
  const metaVersion = Number.isFinite(Number(options.metaVersion))
    ? Number(options.metaVersion)
    : stateVersion;
  return {
    stateVersion: topLevelStateVersion,
    _meta: {
      authority: 'server',
      version: metaVersion,
      projectedForSeat: Object.prototype.hasOwnProperty.call(options, 'projectedForSeat')
        ? options.projectedForSeat
        : null,
      turnStartReconciled: options.turnStartReconciled !== false
    },
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
  let armBoardUpdateContextCalls;

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
    armBoardUpdateContextCalls = [];

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
    try {
      const pendingCoordinator = require('../game/turn/pending-coordinator.js');
      if (pendingCoordinator && typeof pendingCoordinator.clearPendingSelectionActionCache === 'function') {
        pendingCoordinator.clearPendingSelectionActionCache();
      }
    } catch (e) { /* ignore */ }
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
    delete global.updateCardDetailPanel;
    delete global.BoardOps;
    delete global.handlePresentationEvent;
    delete global.onBoardUpdated;
    delete global.syncPendingSelectionActionCache;
    delete global.isProcessing;
    delete global.isCardAnimating;
    if (dom) dom.window.close();
  });

  function createController(stateObj, playbackStateOverrides = {}) {
    const { createNetworkSnapshotController } = require('../ui/network/snapshot.js');
    const playbackState = Object.assign({
      setBusyState: (flags) => busyStateCalls.push(flags),
      armBoardUpdateContext: jest.fn((context) => {
        armBoardUpdateContextCalls.push(context);
        return context;
      })
    }, playbackStateOverrides || {});
    return createNetworkSnapshotController({
      getState: () => stateObj,
      emitCardStateChange: global.emitCardStateChange,
      emitGameStateChange: global.emitGameStateChange,
      emitBoardUpdate: global.emitBoardUpdate,
      renderCardUI: global.renderCardUI,
      playbackState
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
    expect(pbEvent.meta.strictNetworkPlayback).toBe(true);
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
    expect(busyStateCalls.find(c => c.playbackActive === true)).toBeTruthy();
  });

  test('playbackEvents ありの場合 emitBoardUpdate 前に playback lock を立てる', () => {
    const stateObj = { stateVersion: 10 };
    let busyAtBoardUpdate = null;
    global.emitBoardUpdate = jest.fn(() => {
      busyAtBoardUpdate = busyStateCalls[busyStateCalls.length - 1] || null;
      return true;
    });
    const ctrl = createController(stateObj);

    ctrl.applySnapshot(createSnapshot(11), {
      playbackEvents: [{ type: 'flip', phase: 1, targets: [] }]
    });

    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(busyAtBoardUpdate).toEqual(expect.objectContaining({
      processing: true,
      cardAnimating: true,
      playbackActive: true
    }));
  });

  test('network playback は presentation drain を開始し、最終盤面 board update を playback 後へ遅延する', async () => {
    const stateObj = { stateVersion: 10 };
    const order = [];
    global.onBoardUpdated = jest.fn(() => {
      order.push('presentation-drain');
      return Promise.resolve();
    });
    global.emitBoardUpdate = jest.fn(() => {
      order.push('board-update');
      return true;
    });
    const ctrl = createController(stateObj);

    ctrl.applySnapshot(createSnapshot(11), {
      playbackEvents: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }]
    });

    expect(global.onBoardUpdated).toHaveBeenCalledTimes(1);
    expect(global.emitBoardUpdate).not.toHaveBeenCalled();
    expect(order).toEqual(['presentation-drain']);

    await Promise.resolve();
    await Promise.resolve();

    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(order).toEqual(['presentation-drain', 'board-update']);
  });

  test('network playback 後 refresh は event-bus 処理済みでも detail UI を直接同期する', async () => {
    const stateObj = { stateVersion: 10 };
    global.emitCardStateChange = jest.fn(() => true);
    global.updateCardDetailPanel = jest.fn();
    global.onBoardUpdated = jest.fn(() => Promise.resolve());
    global.emitBoardUpdate = jest.fn(() => true);
    const ctrl = createController(stateObj);

    ctrl.applySnapshot(createSnapshot(11), {
      playbackEvents: [{ type: 'flip', phase: 1, targets: [] }]
    });

    expect(global.updateCardDetailPanel).not.toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();

    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(global.updateCardDetailPanel).toHaveBeenCalledTimes(1);
  });

  test('network playback は直接 PresentationHandler に渡し、最終盤面 board update を playback 後へ遅延する', async () => {
    const stateObj = { stateVersion: 10 };
    const order = [];
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        emittedEvents.push(ev);
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        if (!Array.isArray(state._presentationEventsPersist)) state._presentationEventsPersist = [];
        state.presentationEvents.push(ev);
        state._presentationEventsPersist.push(ev);
      })
    };
    global.handlePresentationEvent = jest.fn((ev) => {
      order.push('direct-playback');
      expect(ev).toEqual(expect.objectContaining({ type: 'PLAYBACK_EVENTS' }));
      return Promise.resolve();
    });
    global.emitBoardUpdate = jest.fn(() => {
      order.push('board-update');
      return true;
    });
    const ctrl = createController(stateObj);

    ctrl.applySnapshot(createSnapshot(11), {
      playbackEvents: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }]
    });

    expect(global.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.emitBoardUpdate).not.toHaveBeenCalled();
    expect(order).toEqual(['direct-playback']);
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(global.cardState._presentationEventsPersist).toEqual([]);

    await Promise.resolve();
    await Promise.resolve();

    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(order).toEqual(['direct-playback', 'board-update']);
  });

  test('network playback 完了後に残った playback lock を snapshot 側で解除する', async () => {
    const stateObj = { stateVersion: 10 };
    let playbackActive = false;
    let processing = false;
    let cardAnimating = false;
    const clearPlaybackLock = jest.fn(() => {
      playbackActive = false;
      processing = false;
      cardAnimating = false;
      global.VisualPlaybackActive = false;
      global.isProcessing = false;
      global.isCardAnimating = false;
      global.__playbackActiveSince = null;
    });
    global.handlePresentationEvent = jest.fn(() => Promise.resolve());
    global.emitBoardUpdate = jest.fn(() => true);
    const ctrl = createController(stateObj, {
      setBusyState: jest.fn((flags) => {
        busyStateCalls.push(flags);
        if (Object.prototype.hasOwnProperty.call(flags || {}, 'processing')) {
          processing = flags.processing === true;
          global.isProcessing = processing;
        }
        if (Object.prototype.hasOwnProperty.call(flags || {}, 'cardAnimating')) {
          cardAnimating = flags.cardAnimating === true;
          global.isCardAnimating = cardAnimating;
        }
        if (Object.prototype.hasOwnProperty.call(flags || {}, 'playbackActive')) {
          playbackActive = flags.playbackActive === true;
          global.VisualPlaybackActive = playbackActive;
          global.__playbackActiveSince = playbackActive ? 123 : null;
        }
      }),
      setPlaybackStartedAt: jest.fn((value) => {
        global.__playbackActiveSince = Number.isFinite(Number(value)) ? Number(value) : null;
      }),
      getProcessing: jest.fn(() => processing),
      getCardAnimating: jest.fn(() => cardAnimating),
      getPlaybackActive: jest.fn(() => playbackActive),
      clearPlaybackLock
    });

    ctrl.applySnapshot(createSnapshot(11), {
      playbackEvents: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }]
    });

    expect(playbackActive).toBe(true);
    expect(global.emitBoardUpdate).not.toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();

    expect(clearPlaybackLock).toHaveBeenCalledTimes(1);
    expect(playbackActive).toBe(false);
    expect(global.VisualPlaybackActive).toBe(false);
    expect(global.emitBoardUpdate).toHaveBeenCalledTimes(1);
  });

  test('BoardOps の enqueue が失敗しても direct queue fallback で network playback を再生する', async () => {
    const stateObj = { stateVersion: 10 };
    const order = [];
    global.BoardOps = {
      emitPresentationEvent: jest.fn(() => {
        throw new Error('board ops unavailable');
      })
    };
    global.handlePresentationEvent = jest.fn((ev) => {
      order.push('direct-playback');
      expect(ev).toEqual(expect.objectContaining({ type: 'PLAYBACK_EVENTS' }));
      return Promise.resolve();
    });
    global.emitBoardUpdate = jest.fn(() => {
      order.push('board-update');
      return true;
    });
    const ctrl = createController(stateObj);

    const applied = ctrl.applySnapshot(createSnapshot(11), {
      playbackEvents: [{ type: 'destroy', phase: 1, targets: [{ r: 2, col: 3 }] }]
    });

    expect(applied).toBe(true);
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(global.cardState._presentationEventsPersist).toEqual([]);
    expect(order).toEqual(['direct-playback']);

    await Promise.resolve();
    await Promise.resolve();

    expect(order).toEqual(['direct-playback', 'board-update']);
  });

  test('playbackEvents ありの場合 diff fallback flip を抑止する board update context を arm する', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);

    ctrl.applySnapshot(snap, {
      playbackEvents: [{ type: 'flip', phase: 1, targets: [] }]
    });

    expect(armBoardUpdateContextCalls).toContainEqual(expect.objectContaining({
      suppressFallbackFlip: true,
      source: 'network_snapshot',
      reason: 'snapshot_playback_suppress_fallback_flip'
    }));
  });

  test('カード効果 playbackEvents ありの snapshot は即時 hand UI 再描画をせず playback に渡す', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);
    const events = [
      {
        type: 'status_applied',
        rawType: 'STATUS_APPLIED',
        phase: 1,
        targets: [{ r: 2, col: 3, after: { color: 1, special: 'TIME_BOMB', timer: 3, owner: 'black' } }],
        meta: { special: 'TIME_BOMB', owner: 'black', timer: 3 }
      },
      {
        type: 'capture_to_hand_animation',
        phase: 2,
        targets: [{ player: 'black', cardId: 'freeze_01', reason: 'capture_will' }]
      },
      {
        type: 'hand_remove',
        phase: 3,
        targets: [{ player: 'white', cardId: 'guard_01', reason: 'condemn_will' }]
      },
      {
        type: 'observer_bubble',
        rawType: 'SPECIAL_STONE_BUBBLE',
        phase: 4,
        targets: [{ r: 2, col: 3, owner: 'black', special: 'TIME_STOP' }]
      }
    ];

    const applied = ctrl.applySnapshot(snap, { playbackEvents: events });

    expect(applied).toBe(true);
    expect(global.renderCardUI).not.toHaveBeenCalled();
    expect(global.emitBoardUpdate).toHaveBeenCalled();
    expect(emittedEvents).toContainEqual(expect.objectContaining({
      type: 'PLAYBACK_EVENTS',
      events,
      meta: expect.objectContaining({
        source: 'network_snapshot',
        suppressPlayback: false
      })
    }));
    expect(busyStateCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ processing: true, cardAnimating: true, playbackActive: true })
    ]));
    expect(armBoardUpdateContextCalls).toContainEqual(expect.objectContaining({
      suppressFallbackFlip: true,
      source: 'network_snapshot',
      reason: 'snapshot_playback_suppress_fallback_flip'
    }));
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
    expect(lastSync).toEqual(expect.objectContaining({
      turnIndex: 1,
      pendingEffectByPlayer: expect.objectContaining({
        black: { type: 'CONDEMN_WILL', stage: 'selectTarget' }
      })
    }));
  });

  test('snapshot 実経路で same-type stale pending action cache を turnIndex 差分で prune する', () => {
    const PendingCoordinator = require('../game/turn/pending-coordinator.js');
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    PendingCoordinator.createPendingSelectionAction(
      'black',
      'BOARD_EXPANSION_GOD',
      { anchor: { row: 4, col: 4 } },
      {
        cardState: {
          turnIndex: 6,
          pendingEffectByPlayer: {
            black: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget', selectedTargets: [{ row: 2, col: 3 }] },
            white: null
          }
        }
      }
    );
    global.syncPendingSelectionActionCache = PendingCoordinator.syncPendingSelectionActionCache;

    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);
    snap.cardState.turnIndex = 7;
    snap.cardState.pendingEffectByPlayer = {
      black: { type: 'BOARD_EXPANSION_GOD', stage: 'selectTarget' },
      white: null
    };

    ctrl.applySnapshot(snap, { playbackEvents: [] });

    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
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

  test('_meta がない snapshot は適用されない', () => {
    const stateObj = { stateVersion: 10 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11);
    delete snap._meta;

    const applied = ctrl.applySnapshot(snap, { playbackEvents: [] });

    expect(applied).toBe(false);
    expect(stateObj.stateVersion).toBe(10);
    expect(global.gameState.turnNumber).toBe(10);
    expect(emittedEvents).toHaveLength(0);
    expect(busyStateCalls).toHaveLength(0);
  });

  test('stale shadow playback early return は snapshot 未適用のまま busy を解放して suppressPlayback event を emit する', () => {
    const stateObj = { stateVersion: 15 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(10);
    const shadowEvents = [{ type: 'flip', phase: 1, targets: [{ r: 2, c: 3 }] }];

    const applied = ctrl.applySnapshot(snap, {
      allowStaleShadowPlayback: true,
      shadowPlaybackEvents: shadowEvents
    });

    expect(applied).toBe(false);
    expect(busyStateCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ processing: true, cardAnimating: true }),
      expect.objectContaining({ processing: false, cardAnimating: false })
    ]));
    expect(busyStateCalls[busyStateCalls.length - 1]).toEqual(
      expect.objectContaining({ processing: false, cardAnimating: false })
    );
    expect(emittedEvents).toContainEqual(
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        events: shadowEvents,
        meta: expect.objectContaining({
          source: 'self_snapshot_sync',
          suppressPlayback: true
        })
      })
    );
  });

  test('_meta.version が top-level stateVersion より優先される', () => {
    const stateObj = { stateVersion: 10, authoritativeMatchState: {} };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(11, { topLevelStateVersion: 3, metaVersion: 11 });

    const applied = ctrl.applySnapshot(snap, { playbackEvents: [] });

    expect(applied).toBe(true);
    expect(stateObj.stateVersion).toBe(11);
    expect(stateObj.authoritativeMatchState).toEqual(expect.objectContaining({
      stateVersion: 11,
      authority: 'server',
      projectedForSeat: null,
      turnStartReconciled: true
    }));
  });

  test('force:true なら stale version でも適用される', () => {
    const stateObj = { stateVersion: 15 };
    const ctrl = createController(stateObj);
    const snap = createSnapshot(10);

    const applied = ctrl.applySnapshot(snap, { playbackEvents: [], force: true });
    expect(applied).toBe(true);
  });
});
