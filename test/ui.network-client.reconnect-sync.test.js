const { JSDOM } = require('jsdom');

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

describe('NetworkMatchClient reconnect and resync', () => {
  let dom;
  let eventSources;
  let stateFetchCount;
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
          snapshot: createSnapshot(2)
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
    delete global.BoardOps;
    delete global.EventSource;
    delete global.fetch;
  });

  test('初回stream open時は state API で再同期しない', async () => {
    const client = require('../ui/network-client.js');
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
    const client = require('../ui/network-client.js');
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
    const client = require('../ui/network-client.js');
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

  test('state sync payload の roomBoardConfig が null でも snapshot の custom boardConfig を保持する', async () => {
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
          roomBoardConfig: { rows: 7, cols: 9 },
          snapshot: createSnapshot(1, {
            board: createBoard(7, 9),
            boardConfig: { rows: 7, cols: 9, standard8x8: false }
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
            board: createBoard(7, 9),
            boardConfig: { rows: 7, cols: 9, standard8x8: false }
          })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const client = require('../ui/network-client.js');
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(client.getRoomBoardConfig()).toMatchObject({
      rows: 7,
      cols: 9,
      standard8x8: false
    });
    expect(global.gameState.board).toHaveLength(7);
    expect(global.gameState.board[0]).toHaveLength(9);

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
      rows: 7,
      cols: 9,
      standard8x8: false
    });
    expect(global.gameState.board).toHaveLength(7);
    expect(global.gameState.board[0]).toHaveLength(9);
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
      const client = require('../ui/network-client.js');
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
      const client = require('../ui/network-client.js');
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
    const client = require('../ui/network-client.js');
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

  test('force再同期で局面だけ先に合った後でも同版streamのplaybackを1回だけ回復する', async () => {
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    const client = require('../ui/network-client.js');
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const syncResult = await client.syncLatestState();
    expect(syncResult).toEqual({ ok: true, appliedSnapshot: true });

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
        snapshot: recoveredSnapshot,
        playbackEvents: recoveredPlayback
      })
    };

    snapshotHandler(snapshotEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.cardState.presentationEvents).toEqual([
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        events: recoveredPlayback
      })
    ]);

    snapshotHandler(snapshotEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(client.getNetworkTelemetry().counts.stream_playback_recovered_after_force_sync).toBe(1);
  });

  test('publish拒否でforce適用した同版snapshotでも後続stream playbackを回復する', async () => {
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
          snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 2 })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const client = require('../ui/network-client.js');
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
        snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 2 }),
        playbackEvents: recoveredPlayback
      })
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.cardState.presentationEvents).toEqual([
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        events: recoveredPlayback
      })
    ]);
    expect(client.getNetworkTelemetry().counts.stream_playback_recovered_after_force_sync).toBe(1);
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

    const client = require('../ui/network-client.js');
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

    const client = require('../ui/network-client.js');
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
      const client = require('../ui/network-client.js');
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

    const client = require('../ui/network-client.js');
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

    const client = require('../ui/network-client.js');
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

  test('requestRematch は reset_game publish を送る', async () => {
    const client = require('../ui/network-client.js');
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const result = await client.requestRematch();
    expect(result && result.ok).toBe(true);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('reset_game');
    expect(publishBodies[0].playerKey).toBe('white');
    expect(publishBodies[0].action).toEqual({ type: 'reset_game', playerKey: 'white' });
  });

  test('requestRematch は VERSION_AHEAD 後に再戦済みの最新局面へ同期したら再送しない', async () => {
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
          snapshot: createSnapshot(2, { currentPlayer: 1, turnNumber: 0, consecutivePasses: 0 })
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

    const client = require('../ui/network-client.js');
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    const result = await client.requestRematch();
    expect(result).toEqual({ ok: true, reason: 'ALREADY_REMATCHED' });
    expect(stateFetchCount).toBe(1);
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('reset_game');
    expect(publishBodies[0].action).toEqual({ type: 'reset_game', playerKey: 'white' });
  });

  test('非終局スナップショットの適用時に result overlay を自動で閉じる', async () => {
    document.body.innerHTML = '<div id="result-overlay"></div>';

    const client = require('../ui/network-client.js');
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);

    expect(document.getElementById('result-overlay')).toBeNull();
  });
});
