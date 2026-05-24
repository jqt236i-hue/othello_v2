import { JSDOM } from 'jsdom';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
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
      turnNumber: 1
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

describe('NetworkMatchClient apply coordinator', () => {
  let dom;
  let eventSources;
  let publishPayloads;
  let resolvePublishResponse;
  let responsePayload;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.gameState = createSnapshot(10).gameState;
    global.cardState = createSnapshot(10).cardState;

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.showResult = jest.fn();
    global.isGameOver = jest.fn((gs) => !!(gs && gs.currentPlayer === -1));
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    eventSources = [];
    publishPayloads = [];
    responsePayload = null;
    resolvePublishResponse = null;

    global.EventSource = class MockEventSource {
      constructor() {
        eventSources.push(this);
      }
      addEventListener() {}
      close() {}
    };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 10,
          snapshot: createSnapshot(10)
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        return new Promise((resolve) => {
          resolvePublishResponse = () => resolve(jsonResponse(200, responsePayload));
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
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
    delete global.BLACK;
    delete global.WHITE;
    delete global.gameState;
    delete global.cardState;
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.BoardOps;
    delete global.showResult;
    delete global.isGameOver;
    delete global.EventSource;
    delete global.fetch;
  });

  test('self stream snapshot を適用済みなら同版 publish response snapshot を再適用しない', async () => {    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const streamSnapshot = createSnapshot(11, { topLevelStateVersion: 5, metaVersion: 11 });
    streamSnapshot.gameState.turnNumber = 2;
    streamSnapshot.cardState.markers = [{ row: 4, col: 4, type: 'STREAM_MARKER' }];

    const staleResponseSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    staleResponseSnapshot.gameState.turnNumber = 99;
    staleResponseSnapshot.cardState.markers = [{ row: 7, col: 7, type: 'STALE_RESPONSE_MARKER' }];

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      snapshot: staleResponseSnapshot,
      playbackEvents: [{
        type: 'move',
        phase: 1,
        targets: [{ from: { r: 2, col: 3 }, to: { r: 2, col: 4 } }]
      }]
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [{
          type: 'move',
          phase: 1,
          targets: [{ from: { r: 2, col: 3 }, to: { r: 2, col: 4 } }]
        }],
        snapshot: streamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(global.gameState.turnNumber).toBe(2);
    expect(global.cardState.markers).toEqual([{ row: 4, col: 4, type: 'STREAM_MARKER' }]);
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);

    resolvePublishResponse();
    const result = await publishPromise;

    expect(result.ok).toBe(true);
    expect(client.getStateVersion()).toBe(11);
    expect(global.gameState.turnNumber).toBe(2);
    expect(global.cardState.markers).toEqual([{ row: 4, col: 4, type: 'STREAM_MARKER' }]);
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_skipped).toBe(1);
  });

  test('self stream snapshot 適用後に古い publish response が返っても stateVersion を巻き戻さない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const streamSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    streamSnapshot.gameState.turnNumber = 2;

    const staleResponseSnapshot = createSnapshot(10, { topLevelStateVersion: 10, metaVersion: 10 });
    staleResponseSnapshot.gameState.turnNumber = 99;

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 10,
      snapshot: staleResponseSnapshot,
      playbackEvents: []
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [],
        snapshot: streamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(client.getStateVersion()).toBe(11);

    resolvePublishResponse();
    const result = await publishPromise;

    expect(result.ok).toBe(true);
    expect(client.getStateVersion()).toBe(11);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_skipped).toBe(1);
  });

  // REGRESSION: terminal self-operation stream snapshots must still present the result once.
  test('終局操作が自操作の場合も結果画面を表示すべき（自操作スキップバグ）', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    // Terminal stream snapshot (self-operation match): game ends with black's move
    const terminalStreamSnapshot = createSnapshot(11, { topLevelStateVersion: 5, metaVersion: 11 });
    terminalStreamSnapshot.gameState.currentPlayer = -1; // terminal state
    terminalStreamSnapshot.gameState.turnNumber = 40;

    // Publish-response snapshot (same metaVersion=11, will be skipped by coordinator)
    const terminalResponseSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    terminalResponseSnapshot.gameState.currentPlayer = -1;
    terminalResponseSnapshot.gameState.turnNumber = 40;

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      snapshot: terminalResponseSnapshot,
      playbackEvents: []
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    // Stream arrives with matching operationId. Terminal self snapshots must not suppress result display.
    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [],
        snapshot: terminalStreamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    // Game state should now be terminal
    expect(global.gameState.currentPlayer).toBe(-1);

    // Publish response arrives → skipped (same stateVersion already applied via stream)
    resolvePublishResponse();
    const result = await publishPromise;
    expect(result.ok).toBe(true);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_skipped).toBe(1);

    expect(global.showResult).toHaveBeenCalledTimes(1);
  });

  test('終局自操作でより新しい publish response が適用されても結果表示は一度だけ', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const terminalStreamSnapshot = createSnapshot(11, { topLevelStateVersion: 5, metaVersion: 11 });
    terminalStreamSnapshot.gameState.currentPlayer = -1;
    terminalStreamSnapshot.gameState.turnNumber = 40;

    const newerTerminalResponseSnapshot = createSnapshot(12, { topLevelStateVersion: 12, metaVersion: 12 });
    newerTerminalResponseSnapshot.gameState.currentPlayer = -1;
    newerTerminalResponseSnapshot.gameState.turnNumber = 40;

    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 12,
      snapshot: newerTerminalResponseSnapshot,
      playbackEvents: []
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [],
        snapshot: terminalStreamSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(global.showResult).toHaveBeenCalledTimes(1);

    resolvePublishResponse();
    const result = await publishPromise;

    expect(result.ok).toBe(true);
    expect(client.getNetworkTelemetry().counts.publish_response_snapshot_applied).toBe(1);
    expect(global.showResult).toHaveBeenCalledTimes(1);
  });

  test('shadow 済み publish response の同版 stream は playback recovery を二重発火しない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const responseSnapshot = createSnapshot(11, { topLevelStateVersion: 11, metaVersion: 11 });
    const playbackEvents = [{ type: 'hand_add', phase: 1, targets: [{ player: 'black', count: 1 }] }];
    responsePayload = {
      ok: true,
      roomId: 'ABC',
      stateVersion: 11,
      snapshot: responseSnapshot,
      playbackEvents
    };

    const publishPromise = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents,
      action: createPlaceAction('black', 1)
    });

    await Promise.resolve();
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;

    resolvePublishResponse();
    const result = await publishPromise;
    expect(result.ok).toBe(true);
    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents,
        snapshot: responseSnapshot
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalledTimes(1);
    expect(client.getNetworkTelemetry().counts.stream_playback_recovered_after_force_sync || 0).toBe(0);
  });
});
