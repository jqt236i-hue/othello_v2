import { JSDOM } from 'jsdom';

jest.mock('../ui/board-renderer.ts', () => ({
  getBoardVisualControllerReady: jest.fn(async () => undefined)
}));

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function createBoard(rows = 8, cols = 8) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function createSnapshot(stateVersion, gameStateOverrides = {}) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: null,
      turnStartReconciled: true,
      projectedSnapshotHash: `hash_${stateVersion}`
    },
    gameState: {
      currentPlayer: -1,
      turnNumber: 1,
      consecutivePasses: 0,
      ...gameStateOverrides
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      turnIndex: 1
    }
  };
}

function createPlaceAction(playerKey = 'black', turnIndex = 1) {
  return {
    type: 'place',
    playerKey,
    row: 2,
    col: 3,
    turnIndex
  };
}

function createPresentationFrame(playbackEvents, operationId = 'op_state_2') {
  return {
    roomId: 'ABC',
    visualSeq: 1,
    stateVersionFrom: 1,
    stateVersionTo: 2,
    operationId,
    actionType: 'place',
    playbackEvents,
    snapshotAfter: createSnapshot(2)
  };
}

async function flushNetworkPresentation() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

describe('NetworkMatchClient reconnect and resync', () => {
  let dom;
  let eventSources;
  let stateFetchCount;
  let presentationJournalFetchCount;
  let publishBodies;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.gameState = createSnapshot(1).gameState;
    global.cardState = createSnapshot(1).cardState;
    global.isGameOver = jest.fn((gameStateArg) => !!(
      gameStateArg && (
        Number(gameStateArg.turnNumber) >= 60 ||
        Number(gameStateArg.consecutivePasses) >= 2
      )
    ));

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event) => Object.freeze({
        kind: 'strict-network-settlement',
        visualSeq: event.meta.visualSeq,
        applyCommittedFrame: jest.fn(async () => true),
        settle: jest.fn(async () => true),
        cancel: jest.fn(async () => true)
      })),
      onBoardUpdated: jest.fn(async () => undefined)
    };

    eventSources = [];
    publishBodies = [];
    class MockEventSource {
      constructor(url) {
        this.url = String(url);
        this.readyState = MockEventSource.OPEN;
        this.listeners = {};
        eventSources.push(this);
      }

      addEventListener(name, handler) {
        this.listeners[name] = handler;
      }

      close() {
        this.readyState = MockEventSource.CLOSED;
      }
    }

    MockEventSource.CONNECTING = 0;
    MockEventSource.OPEN = 1;
    MockEventSource.CLOSED = 2;
    global.EventSource = MockEventSource;

    stateFetchCount = 0;
    presentationJournalFetchCount = 0;
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          presentationCursor: { visualSeq: 1, stateVersion: 2 },
          snapshot: createSnapshot(2)
        });
      }

      if (path === '/api/match/presentation-journal') {
        presentationJournalFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          baseVisualSeq: 0,
          baseVisualVersion: 1,
          baseSnapshot: createSnapshot(1),
          presentationCursor: { visualSeq: 1, stateVersion: 2 },
          presentationFrames: [createPresentationFrame([], 'op-state-sync-2')]
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 3,
          presentationCursor: { visualSeq: 2, stateVersion: 3 },
          snapshot: createSnapshot(3)
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
    jest.useRealTimers();

    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.gameState;
    delete global.cardState;
    delete global.isGameOver;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.PresentationHandler;
    delete global.BoardOps;
    delete global.EventSource;
    delete global.fetch;
  });

  test('初回stream open時は state API で再同期しない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(eventSources).toHaveLength(1);
    expect(stateFetchCount).toBe(0);

    const stream = eventSources[0];
    expect(typeof stream.onopen).toBe('function');
    stream.onopen();

    await Promise.resolve();
    await Promise.resolve();

    expect(stateFetchCount).toBe(0);
  });

  test('stream error後に再接続し、stream event が来なければ fallback で state API を再同期する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const firstStream = eventSources[0];
    firstStream.readyState = global.EventSource.CLOSED;
    expect(typeof firstStream.onerror).toBe('function');
    firstStream.onerror();

    jest.advanceTimersByTime(500);
    expect(eventSources).toHaveLength(2);

    const secondStream = eventSources[1];
    expect(typeof secondStream.onopen).toBe('function');
    secondStream.onopen();

    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();

    expect(stateFetchCount).toBe(1);
  });

  test('reconnect 後に snapshot が届けば fallback state sync を走らせない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const firstStream = eventSources[0];
    firstStream.readyState = global.EventSource.CLOSED;
    firstStream.onerror();

    jest.advanceTimersByTime(500);
    expect(eventSources).toHaveLength(2);

    const secondStream = eventSources[1];
    secondStream.onopen();
    const snapshotHandler = secondStream.listeners.snapshot;
    expect(typeof snapshotHandler).toBe('function');

    snapshotHandler({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        stateVersion: 2,
        seats: { black: true, white: true },
        snapshot: createSnapshot(2),
        playbackEvents: []
      })
    });

    jest.advanceTimersByTime(600);
    await Promise.resolve();
    await Promise.resolve();

    expect(stateFetchCount).toBe(0);
  });

  test('reconnect fallback sync 後も multi-stage pendingEffectId を次回 publish へ持ち越す', async () => {
    const pendingSnapshot = createSnapshot(2, {
      currentPlayer: 1,
      turnNumber: 2
    });
    pendingSnapshot.cardState.turnIndex = 2;
    pendingSnapshot.cardState.pendingEffectByPlayer.black = {
      type: 'BOARD_EXPANSION_GOD',
      stage: 'selectTarget',
      cardId: 'board_expand_god_01',
      pendingEffectId: 'pending_reconnect_1',
      selectedTargets: [{ row: 0, col: 0, directionKey: 'up-left' }],
      selectedCount: 1,
      maxSelections: 2
    };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'token_black',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot: pendingSnapshot
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 3,
          snapshot: createSnapshot(3, {
            currentPlayer: 1,
            turnNumber: 3
          })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const firstStream = eventSources[0];
    firstStream.readyState = global.EventSource.CLOSED;
    firstStream.onerror();

    jest.advanceTimersByTime(500);
    expect(eventSources).toHaveLength(2);

    const secondStream = eventSources[1];
    secondStream.onopen();

    await Promise.resolve();
    await Promise.resolve();
    const syncResult = await client.syncLatestState();

    expect(stateFetchCount).toBe(1);
    expect(syncResult).toEqual({ ok: true, appliedSnapshot: true });
    expect(client.getStateVersion()).toBe(2);
    expect(global.cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'BOARD_EXPANSION_GOD',
      pendingEffectId: 'pending_reconnect_1',
      selectedTargets: [{ row: 0, col: 0, directionKey: 'up-left' }]
    }));

    const pendingSelectionState = JSON.parse(JSON.stringify(global.cardState.pendingEffectByPlayer.black));
    const publishResult = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: {
        type: 'place',
        playerKey: 'black',
        row: 0,
        col: 1,
        turnIndex: 2,
        expansionTarget: { row: 7, col: 7, directionKey: 'down-right' },
        deferNetworkPublish: true,
        pendingSelectionState
      }
    });

    expect(publishResult.ok).toBe(true);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].baseVersion).toBe(2);
    expect(publishBodies[0].params.pendingSelectionState).toEqual(expect.objectContaining({
      type: 'BOARD_EXPANSION_GOD',
      pendingEffectId: 'pending_reconnect_1',
      selectedTargets: [{ row: 0, col: 0, directionKey: 'up-left' }]
    }));
    expect(publishBodies[0].params.expansionTarget).toEqual({ row: 7, col: 7, directionKey: 'down-right' });
  });

  test('state sync payload の roomBoardConfig が null でも snapshot の円形 boardConfig を保持する', async () => {
    global.fetch = jest.fn(async (url) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          roomBoardConfig: { rows: 10, cols: 10, shape: 'circle' },
          snapshot: createSnapshot(1, {
            board: createBoard(10, 10),
            boardConfig: { rows: 10, cols: 10, shape: 'circle', standard8x8: false }
          })
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          roomBoardConfig: null,
          stateVersion: 2,
          snapshot: createSnapshot(2, {
            board: createBoard(10, 10),
            boardConfig: { rows: 10, cols: 10, shape: 'circle', standard8x8: false }
          })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(client.getRoomBoardConfig()).toMatchObject({
      rows: 10,
      cols: 10,
      shape: 'circle',
      standard8x8: false
    });
    expect(global.gameState.board).toHaveLength(10);
    expect(global.gameState.board[0]).toHaveLength(10);

    const firstStream = eventSources[0];
    firstStream.readyState = global.EventSource.CLOSED;
    firstStream.onerror();

    jest.advanceTimersByTime(500);
    expect(eventSources).toHaveLength(2);

    const secondStream = eventSources[1];
    secondStream.onopen();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(400);
    await Promise.resolve();
    await Promise.resolve();

    expect(stateFetchCount).toBe(1);
    expect(client.getRoomBoardConfig()).toMatchObject({
      rows: 10,
      cols: 10,
      shape: 'circle',
      standard8x8: false
    });
    expect(global.gameState.board).toHaveLength(10);
    expect(global.gameState.board[0]).toHaveLength(10);
  });

  test('再接続後の state 再同期は一時失敗時に自動リトライする', async () => {
    let stateFailures = 1;
    global.fetch = jest.fn(async (url) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        if (stateFailures > 0) {
          stateFailures -= 1;
          return jsonResponse(503, { ok: false, reason: 'TEMPORARY_UNAVAILABLE' });
        }
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot: createSnapshot(2)
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      require('../ui/network-client.js');
      const client = window.NetworkMatchClient;
      expect(client).toBeTruthy();

      const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
      expect(joined.ok).toBe(true);
      expect(eventSources).toHaveLength(1);

      const firstStream = eventSources[0];
      firstStream.readyState = global.EventSource.CLOSED;
      firstStream.onerror();

      jest.advanceTimersByTime(1000);
      expect(eventSources).toHaveLength(2);

      const secondStream = eventSources[1];
      secondStream.onopen();

      for (let i = 0; i < 6; i += 1) {
        await Promise.resolve();
        jest.advanceTimersByTime(1200);
      }
      await Promise.resolve();
      await Promise.resolve();

      expect(stateFetchCount).toBe(2);
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('heartbeat無応答が続いた場合はwatchdogで再接続する', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      require('../ui/network-client.js');
      const client = window.NetworkMatchClient;
      expect(client).toBeTruthy();

      const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
      expect(joined.ok).toBe(true);
      expect(eventSources).toHaveLength(1);

      const firstStream = eventSources[0];
      expect(typeof firstStream.onopen).toBe('function');
      firstStream.onopen();

      jest.advanceTimersByTime(45500);
      jest.advanceTimersByTime(300);

      expect(eventSources).toHaveLength(2);
      expect(global.addLog).toHaveBeenCalledWith(expect.stringContaining('配信接続の応答がないため再接続します'));
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('heartbeatでより新しいstateVersionを受信した場合は自動再同期する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(eventSources).toHaveLength(1);
    expect(stateFetchCount).toBe(0);

    const stream = eventSources[0];
    const heartbeatHandler = stream.listeners.heartbeat;
    expect(typeof heartbeatHandler).toBe('function');

    heartbeatHandler({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        stateVersion: 2,
        serverTime: Date.now()
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(stateFetchCount).toBe(1);
  });

  test('force再同期でvisual cursorまで合った後は同版streamを再生し直さない', async () => {
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const syncResult = await client.syncLatestState();
    expect(syncResult).toEqual({ ok: true, appliedSnapshot: true });
    expect(presentationJournalFetchCount).toBe(1);
    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        events: [],
        meta: expect.objectContaining({
          visualSeq: 1,
          stateVersionFrom: 1,
          stateVersionTo: 2,
          strictNetworkPlayback: true
        })
      })
    );
    global.PresentationHandler.handlePresentationEvent.mockClear();

    const stream = eventSources[0];
    const snapshotHandler = stream.listeners.snapshot;
    expect(typeof snapshotHandler).toBe('function');

    const recoveredPlayback = [{ type: 'hand_add', phase: 1, targets: [{ player: 'white', count: 1 }] }];
    const recoveredSnapshot = createSnapshot(2);
    const snapshotEvent = {
      lastEventId: 'ABC_2_2',
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        seats: { black: true, white: true },
        stateVersion: 2,
        operationId: 'op-force-sync-2',
        presentationCursor: { visualSeq: 1, stateVersion: 2 },
        presentationFrames: [createPresentationFrame(recoveredPlayback, 'op-force-sync-2')],
        snapshot: recoveredSnapshot,
        playbackEvents: recoveredPlayback
      })
    };

    snapshotHandler(snapshotEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    expect(global.PresentationHandler.handlePresentationEvent).not.toHaveBeenCalled();
    expect(global.NetworkPresentationTimeline.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 2,
      pendingFrameCount: 0
    });

    snapshotHandler(snapshotEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    expect(global.PresentationHandler.handlePresentationEvent).not.toHaveBeenCalled();
    expect(client.getNetworkTelemetry().counts.stream_playback_recovered_after_force_sync || 0).toBe(0);
  });

  test('state sync applies recovered playback events from state payload', async () => {
    const recoveredPlayback = [{ type: 'move', phase: 1, targets: [{ from: { r: 3, col: 3 }, to: { r: 4, col: 3 }, reason: 'hyperactive_move' }] }];
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };
    global.fetch = jest.fn(async (url) => {
      const parsedUrl = new URL(String(url));
      if (parsedUrl.pathname === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }
      if (parsedUrl.pathname === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot: createSnapshot(2),
          operationId: 'op_state_2',
          presentationCursor: { visualSeq: 1, stateVersion: 2 },
          presentationFrames: [createPresentationFrame(recoveredPlayback, 'op_state_2')],
          playbackEvents: recoveredPlayback
        });
      }
      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const syncResult = await client.syncLatestState();
    expect(syncResult).toEqual({ ok: true, appliedSnapshot: true });
    await flushNetworkPresentation();

    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        events: recoveredPlayback,
        meta: expect.objectContaining({
          source: 'network_timeline',
          strictNetworkPlayback: true,
          visualSeq: 1
        })
      })
    );
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    const stateSyncTelemetry = client.getNetworkTelemetry().recentEvents
      .find((event) => event && event.type === 'state_sync_snapshot_applied');
    expect(stateSyncTelemetry && stateSyncTelemetry.details).toEqual(
      expect.objectContaining({
        playbackEventCount: 0,
        presentationFrameCount: 1,
        usedRecoveredPlayback: false
      })
    );

    const secondSyncResult = await client.syncLatestState();
    expect(secondSyncResult).toEqual({ ok: true, appliedSnapshot: false });
    await flushNetworkPresentation();
    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
  });

  test('大量replayのstream snapshotは局面だけ追いつきplaybackを捨てる', async () => {
    const replayPlayback = [{ type: 'move', phase: 1, targets: [{ from: { r: 3, col: 3 }, to: { r: 4, col: 3 }, reason: 'hyperactive_move' }] }];
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const stream = eventSources[0];
    const snapshotHandler = stream.listeners.snapshot;
    expect(typeof snapshotHandler).toBe('function');

    snapshotHandler({
      lastEventId: 'ABC_2_2',
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        seats: { black: true, white: true },
        stateVersion: 2,
        snapshot: createSnapshot(2, { turnNumber: 2 }),
        playbackEvents: replayPlayback,
        sseReplay: {
          replayed: true,
          index: 1,
          count: 12,
          remaining: 11,
          lastEventId: 'ABC_1_1'
        }
      })
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(client.getStateVersion()).toBe(2);
    expect(global.gameState.turnNumber).toBe(2);
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    expect(client.getNetworkTelemetry().counts.stream_replay_playback_suppressed).toBe(1);
  });

  test('publish拒否でforce rebaseした同版snapshotを後続streamで再生し直さない', async () => {
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 2 })
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        return jsonResponse(409, {
          ok: false,
          roomId: 'ABC',
          seats: { black: true, white: true },
          rejectedReason: 'VERSION_AHEAD',
          stateVersion: 2,
          presentationCursor: { visualSeq: 1, stateVersion: 2 },
          snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 2 })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const rejected = await client.publishSnapshot({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('white', 1)
    });
    expect(rejected).toEqual({ ok: false, reason: 'VERSION_AHEAD' });
    expect(client.getStateVersion()).toBe(2);

    const stream = eventSources[0];
    const snapshotHandler = stream.listeners.snapshot;
    expect(typeof snapshotHandler).toBe('function');

    const recoveredPlayback = [{ type: 'hand_add', phase: 1, targets: [{ player: 'white', count: 1 }] }];
    snapshotHandler({
      lastEventId: 'ABC_2_3',
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        seats: { black: true, white: true },
        stateVersion: 2,
        operationId: 'op-rejected-2',
        presentationCursor: { visualSeq: 1, stateVersion: 2 },
        presentationFrames: [createPresentationFrame(recoveredPlayback, 'op-rejected-2')],
        snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 2 }),
        playbackEvents: recoveredPlayback
      })
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    expect(global.PresentationHandler.handlePresentationEvent).not.toHaveBeenCalled();
    expect(client.getNetworkTelemetry().counts.stream_playback_recovered_after_force_sync || 0).toBe(0);
    expect(global.NetworkPresentationTimeline.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 2,
      pendingFrameCount: 0
    });
  });

  test('snapshot未適用の拒否でstateVersionだけ進んでもheartbeatが再同期を要求する', async () => {
    let resolveSecondPublish = null;
    const authoritativeSnapshot = createSnapshot(2, { currentPlayer: 1, turnNumber: 2 });

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot: authoritativeSnapshot
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        if (publishBodies.length === 1) {
          return jsonResponse(409, {
            ok: false,
            roomId: 'ABC',
            seats: { black: true, white: true },
            rejectedReason: 'VERSION_AHEAD',
            stateVersion: 2,
            snapshot: authoritativeSnapshot
          });
        }
        return new Promise((resolve) => {
          resolveSecondPublish = () => resolve(jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            seats: { black: true, white: true },
            stateVersion: 3,
            snapshot: createSnapshot(3, { currentPlayer: -1, turnNumber: 3 })
          }));
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const rejectedPublish = client.publishSnapshot({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('white', 1)
    });
    const queuedPublish = client.publishSnapshot({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('white', 2)
    });
    const rejected = await rejectedPublish;
    expect(rejected).toEqual({ ok: false, reason: 'VERSION_AHEAD' });
    expect(client.getStateVersion()).toBe(2);
    expect(global.gameState.turnNumber).toBe(1);

    const stream = eventSources[0];
    const heartbeatHandler = stream.listeners.heartbeat;
    expect(typeof heartbeatHandler).toBe('function');
    heartbeatHandler({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        stateVersion: 2,
        serverTime: Date.now()
      })
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(stateFetchCount).toBe(1);
    expect(global.gameState.turnNumber).toBe(2);
    expect(typeof resolveSecondPublish).toBe('function');
    resolveSecondPublish();
    const queuedResult = await queuedPublish;
    expect(queuedResult.ok).toBe(true);
  });

  test('pending publish中は同版stream recoveryを適用しない', async () => {
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    let resolvePublishResponse = null;
    const authoritativeSnapshot = createSnapshot(2, {
      currentPlayer: 1,
      turnNumber: 2,
      consecutivePasses: 0
    });
    authoritativeSnapshot.cardState.turnIndex = 2;

    const optimisticSnapshot = createSnapshot(2, {
      currentPlayer: 1,
      turnNumber: 3,
      consecutivePasses: 0
    });
    optimisticSnapshot.cardState.turnIndex = 3;
    optimisticSnapshot.cardState.markers = [{ row: 2, col: 3, type: 'GUARD', owner: 'white' }];

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot: authoritativeSnapshot
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        return new Promise((resolve) => {
          resolvePublishResponse = () => resolve(jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            seats: { black: true, white: true },
            stateVersion: 3,
            snapshot: {
              ...optimisticSnapshot,
              stateVersion: 3,
              _meta: {
                ...(optimisticSnapshot._meta || {}),
                version: 3
              }
            }
          }));
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const syncResult = await client.syncLatestState();
    expect(syncResult).toEqual({ ok: true, appliedSnapshot: true });

    global.gameState = JSON.parse(JSON.stringify(optimisticSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(optimisticSnapshot.cardState));

    const publishPromise = client.publishSnapshot({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [],
      snapshot: optimisticSnapshot,
      action: createPlaceAction('white', optimisticSnapshot.cardState.turnIndex)
    });

    await Promise.resolve();

    const stream = eventSources[0];
    const snapshotHandler = stream.listeners.snapshot;
    expect(typeof snapshotHandler).toBe('function');
    snapshotHandler({
      lastEventId: 'ABC_2_4',
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        seats: { black: true, white: true },
        stateVersion: 2,
        operationId: 'op-force-sync-2',
        snapshot: authoritativeSnapshot,
        playbackEvents: [{ type: 'hand_add', phase: 1, targets: [{ player: 'white', count: 1 }] }]
      })
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    expect(global.gameState.turnNumber).toBe(3);
    expect(global.cardState.markers).toEqual([{ row: 2, col: 3, type: 'GUARD', owner: 'white' }]);
    expect(client.getNetworkTelemetry().counts.stream_playback_recovered_after_force_sync || 0).toBe(0);

    expect(typeof resolvePublishResponse).toBe('function');
    resolvePublishResponse();
    const publishResult = await publishPromise;
    expect(publishResult.ok).toBe(true);
    expect(client.getStateVersion()).toBe(3);
  });

  test('再接続時は直近のSSE event idを lastEventId query に載せる', async () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      require('../ui/network-client.js');
      const client = window.NetworkMatchClient;
      expect(client).toBeTruthy();

      const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
      expect(joined.ok).toBe(true);
      expect(eventSources).toHaveLength(1);

      const firstStream = eventSources[0];
      const snapshotHandler = firstStream.listeners.snapshot;
      expect(typeof snapshotHandler).toBe('function');
      snapshotHandler({
        lastEventId: 'ABC_2_2',
        data: JSON.stringify({
          ok: true,
          roomId: 'ABC',
          stateVersion: 2,
          seats: { black: true, white: true },
          snapshot: createSnapshot(2),
          playbackEvents: []
        })
      });

      firstStream.readyState = global.EventSource.CLOSED;
      firstStream.onerror();

      jest.advanceTimersByTime(500);
      expect(eventSources).toHaveLength(2);
      expect(eventSources[1].url).toContain('lastEventId=ABC_2_2');
    } finally {
      randomSpy.mockRestore();
    }
  });

  test('pending publish中のforce syncは同版snapshotでローカル局面を巻き戻さない', async () => {
    let resolvePublishResponse = null;
    const optimisticSnapshot = createSnapshot(1, {
      currentPlayer: 1,
      turnNumber: 2,
      consecutivePasses: 0
    });
    optimisticSnapshot.cardState.turnIndex = 2;
    optimisticSnapshot.cardState.markers = [{ row: 2, col: 3, type: 'GUARD', owner: 'white' }];

    global.fetch = jest.fn(async (url) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/publish') {
        return new Promise((resolve) => {
          resolvePublishResponse = () => resolve(jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            seats: { black: true, white: true },
            stateVersion: 2,
            snapshot: {
              ...optimisticSnapshot,
              stateVersion: 2,
              _meta: {
                ...(optimisticSnapshot._meta || {}),
                version: 2
              }
            }
          }));
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    global.gameState = JSON.parse(JSON.stringify(optimisticSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(optimisticSnapshot.cardState));

    const publishPromise = client.publishSnapshot({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [],
      snapshot: optimisticSnapshot,
      action: createPlaceAction('white', optimisticSnapshot.cardState.turnIndex)
    });

    await Promise.resolve();

    const syncResult = await client.syncLatestState();
    expect(syncResult).toEqual({ ok: true, appliedSnapshot: false });
    expect(stateFetchCount).toBe(1);
    expect(global.gameState.turnNumber).toBe(2);
    expect(global.cardState.markers).toEqual([{ row: 2, col: 3, type: 'GUARD', owner: 'white' }]);

    expect(typeof resolvePublishResponse).toBe('function');
    resolvePublishResponse();
    const publishResult = await publishPromise;
    expect(publishResult.ok).toBe(true);
    expect(client.getStateVersion()).toBe(2);
  });

  test('pending publish中でも同版 hash 不一致 snapshot は force sync で適用する', async () => {
    let resolvePublishResponse = null;
    const optimisticSnapshot = createSnapshot(1, {
      currentPlayer: 1,
      turnNumber: 2,
      consecutivePasses: 0
    });
    optimisticSnapshot._meta.projectedSnapshotHash = 'hash_local_1';
    optimisticSnapshot.cardState.turnIndex = 2;
    optimisticSnapshot.cardState.markers = [{ row: 2, col: 3, type: 'GUARD', owner: 'white' }];

    const authoritativeSnapshot = createSnapshot(1, {
      currentPlayer: -1,
      turnNumber: 7,
      consecutivePasses: 1
    });
    authoritativeSnapshot._meta.projectedSnapshotHash = 'hash_remote_1';

    global.fetch = jest.fn(async (url) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: optimisticSnapshot
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: authoritativeSnapshot
        });
      }

      if (path === '/api/match/publish') {
        return new Promise((resolve) => {
          resolvePublishResponse = () => resolve(jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            seats: { black: true, white: true },
            stateVersion: 2,
            snapshot: createSnapshot(2, { currentPlayer: -1, turnNumber: 8, consecutivePasses: 2 })
          }));
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    global.gameState = JSON.parse(JSON.stringify(optimisticSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(optimisticSnapshot.cardState));

    const publishPromise = client.publishSnapshot({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [],
      snapshot: optimisticSnapshot,
      action: createPlaceAction('white', optimisticSnapshot.cardState.turnIndex)
    });

    await Promise.resolve();

    const syncResult = await client.syncLatestState();
    expect(syncResult).toEqual({ ok: true, appliedSnapshot: true });
    expect(stateFetchCount).toBe(1);
    expect(global.gameState.turnNumber).toBe(7);
    expect(global.cardState.markers).toEqual([]);

    expect(typeof resolvePublishResponse).toBe('function');
    resolvePublishResponse();
    const publishResult = await publishPromise;
    expect(publishResult.ok).toBe(true);
  });

  test('requestRematch は reset_game publish ではなく再戦申請を送る', async () => {
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          presentationCursor: { visualSeq: 0, stateVersion: 1 },
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/rematch-request') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          requestId: 'rematch_req_1',
          stateVersion: 1
        });
      }

      if (path === '/api/match/publish') {
        throw new Error('requestRematch should not publish reset_game directly');
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const result = await client.requestRematch();
    expect(result && result.ok).toBe(true);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0]).toEqual(expect.objectContaining({
      roomId: 'ABC',
      seatKey: 'white',
      seatToken: 'token_white'
    }));
  });

  test('requestRematch は最新デッキ同期の完了後に再戦申請を送る', async () => {
    let resolveDeckSync;
    const syncActiveNetworkDeckSelection = jest.fn(() => new Promise((resolve) => {
      resolveDeckSync = () => resolve({ ok: true });
    }));
    window.DeckBuilderController = { syncActiveNetworkDeckSelection };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1)
        });
      }

      if (path === '/api/match/rematch-request') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          requestId: 'rematch_req_1',
          stateVersion: 1
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const resultPromise = client.requestRematch();
    await Promise.resolve();
    await Promise.resolve();

    expect(syncActiveNetworkDeckSelection).toHaveBeenCalledTimes(1);
    expect(publishBodies).toHaveLength(0);
    expect(client.hasPendingRematchRequest()).toBe(true);

    const duplicateResult = await client.requestRematch();
    expect(duplicateResult).toEqual({
      ok: true,
      pending: true,
      requestId: ''
    });
    expect(syncActiveNetworkDeckSelection).toHaveBeenCalledTimes(1);

    expect(typeof resolveDeckSync).toBe('function');
    resolveDeckSync();
    const result = await resultPromise;

    expect(result && result.ok).toBe(true);
    expect(client.hasPendingRematchRequest()).toBe(true);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0]).toEqual(expect.objectContaining({
      roomId: 'ABC',
      seatKey: 'white',
      seatToken: 'token_white'
    }));

    expect(typeof eventSources[0]?.listeners?.presence).toBe('function');
    eventSources[0].listeners.presence({
      data: JSON.stringify({
        ok: true,
        type: 'rematch_response',
        requestId: 'rematch_req_1',
        seatKey: 'black',
        accepted: true
      })
    });
    expect(client.hasPendingRematchRequest()).toBe(false);
  });

  test('acceptRematchRequest は最新デッキ同期の完了後に応答と reset_game を送る', async () => {
    let resolveDeckSync;
    const syncActiveNetworkDeckSelection = jest.fn(() => new Promise((resolve) => {
      resolveDeckSync = () => resolve({ ok: true });
    }));
    const requestPaths = [];
    window.DeckBuilderController = { syncActiveNetworkDeckSelection };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1, { currentPlayer: -1, turnNumber: 60, consecutivePasses: 2 })
        });
      }

      if (path === '/api/match/rematch-response') {
        requestPaths.push(path);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          requestId: 'rematch_req_1',
          accepted: true,
          stateVersion: 1
        });
      }

      if (path === '/api/match/publish') {
        requestPaths.push(path);
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 0, consecutivePasses: 0 })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const resultPromise = client.acceptRematchRequest('rematch_req_1');
    await Promise.resolve();
    await Promise.resolve();

    expect(syncActiveNetworkDeckSelection).toHaveBeenCalledTimes(1);
    expect(requestPaths).toEqual([]);
    expect(publishBodies).toHaveLength(0);

    expect(typeof resolveDeckSync).toBe('function');
    resolveDeckSync();
    const result = await resultPromise;

    expect(result && result.ok).toBe(true);
    expect(requestPaths).toEqual(['/api/match/rematch-response', '/api/match/publish']);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('reset_game');
  });

  test('acceptRematchRequest は VERSION_AHEAD 後に再戦済みの最新局面へ同期したら再送しない', async () => {
    let publishAttempt = 0;
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1, { currentPlayer: -1, turnNumber: 60, consecutivePasses: 2 })
        });
      }

      if (path === '/api/match/state') {
        stateFetchCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          presentationCursor: { visualSeq: 1, stateVersion: 2 },
          snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 0, consecutivePasses: 0 })
        });
      }

      if (path === '/api/match/rematch-response') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          requestId: 'rematch_req_1',
          accepted: true,
          stateVersion: 1
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        publishAttempt += 1;
        if (publishAttempt === 1) {
          return jsonResponse(409, {
            ok: false,
            rejectedReason: 'VERSION_AHEAD',
            roomId: 'ABC',
            seats: { black: true, white: true },
            stateVersion: 2,
            presentationCursor: { visualSeq: 1, stateVersion: 2 },
            snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 0, consecutivePasses: 0 })
          });
        }
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 3,
          snapshot: createSnapshot(3, { currentPlayer: 1, turnNumber: 0, consecutivePasses: 0 })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const result = await client.acceptRematchRequest('rematch_req_1');
    expect(result).toEqual({ ok: true, reason: 'ALREADY_REMATCHED' });
    expect(stateFetchCount).toBe(1);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('reset_game');
    expect(publishBodies[0].action).toEqual({ type: 'reset_game', playerKey: 'white' });
  });

  test('acceptRematchRequest の self stream snapshot は非終局なら result overlay を閉じる', async () => {
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 1,
          snapshot: createSnapshot(1, { currentPlayer: -1, turnNumber: 60, consecutivePasses: 2 })
        });
      }

      if (path === '/api/match/rematch-response') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          requestId: 'rematch_req_1',
          accepted: true,
          stateVersion: 1
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(String(init.body || '{}'));
        publishBodies.push(body);
        const snapshot = createSnapshot(2, { currentPlayer: 1, turnNumber: 0, consecutivePasses: 0 });
        const stream = eventSources[0];
        const snapshotHandler = stream && stream.listeners ? stream.listeners.snapshot : null;
        if (typeof snapshotHandler === 'function') {
          snapshotHandler({
            data: JSON.stringify({
              ok: true,
              operationId: body.operationId,
              actionType: 'reset_game',
              stateVersion: 2,
              snapshot,
              playbackEvents: []
            })
          });
        }
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seats: { black: true, white: true },
          stateVersion: 2,
          snapshot,
          playbackEvents: []
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    document.body.innerHTML = '<button id="resetBtn">再戦</button><div id="result-overlay"><button>再戦中...</button></div>';
    window.MATCH_MODE = 'network';

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(eventSources).toHaveLength(1);
    expect(typeof eventSources[0].listeners.snapshot).toBe('function');

    document.body.innerHTML = '<button id="resetBtn">再戦</button><div id="result-overlay"><button>再戦中...</button></div>';

    const result = await client.acceptRematchRequest('rematch_req_1');
    expect(result && result.ok).toBe(true);

    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('reset_game');
    expect(document.getElementById('result-overlay')).toBeNull();
    expect(document.getElementById('resetBtn')?.textContent).toBe('再戦');
    expect(global.gameState.currentPlayer).toBe(1);
    expect(global.gameState.consecutivePasses).toBe(0);
  });

  test('非終局スナップショットの適用時に result overlay を自動で閉じる', async () => {
    document.body.innerHTML = '<div id="result-overlay"></div>';

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    expect(document.getElementById('result-overlay')).toBeNull();
  });
});
