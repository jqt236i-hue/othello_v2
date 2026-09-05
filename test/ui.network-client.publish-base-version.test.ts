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
  const boardConfig = gameStateOverrides.boardConfig || {
    rows: 8,
    cols: 8,
    shape: 'rectangle',
    standard8x8: true
  };
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      boardContractVersion: 2,
      projectedForSeat: null,
      turnStartReconciled: true
    },
    gameState: {
      currentPlayer: 1,
      turnNumber: 1,
      board: gameStateOverrides.board || createBoard(boardConfig.rows, boardConfig.cols),
      boardConfig,
      boardExpansion: { active: false, cells: [] },
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

function createUseCardAction(playerKey = 'black', useCardId = 'sample_card', turnIndex = 1) {
  return {
    type: 'use_card',
    playerKey,
    useCardId,
    turnIndex
  };
}

function createPresentationFrame(playbackEvents, operationId) {
  return {
    roomId: 'ABC',
    visualSeq: 1,
    stateVersionFrom: 10,
    stateVersionTo: 11,
    operationId,
    actionType: 'place',
    playbackEvents,
    snapshotAfter: createSnapshot(11)
  };
}

async function flushPresentation() {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('NetworkMatchClient queued publish', () => {
  let dom;
  let eventSources;
  let publishPayloads;
  let publishCount;

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
    global.EventSource = class MockEventSource {
      constructor() {
        eventSources.push(this);
      }
      addEventListener() {}
      close() {}
    };

    publishPayloads = [];
    publishCount = 0;

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
        publishCount += 1;

        if (publishCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            stateVersion: 11,
            snapshot: createSnapshot(11)
          });
        }

        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 12,
          snapshot: createSnapshot(12)
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
    delete global.PresentationHandler;
    delete global.BoardOps;
    delete global.EventSource;
    delete global.fetch;
  });

  test('2回目の送信で最新の版番号を使う', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const firstPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'use_card',
      playbackEvents: [],
      action: createUseCardAction('black', 'sample_card', 1)
    });

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);

    expect(publishPayloads).toHaveLength(2);
    expect(publishPayloads[0].baseVersion).toBe(10);
    expect(publishPayloads[1].baseVersion).toBe(11);
    expect(publishPayloads[0].presentationEnvelopeVersion).toBe(2);
    expect(publishPayloads[1].presentationEnvelopeVersion).toBe(2);
  });

  test('stream snapshot適用後の次回publishは更新済みstateVersionをbaseVersionに使う', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(client.getStateVersion()).toBe(10);
    expect(eventSources).toHaveLength(1);

    const streamSnapshot = createSnapshot(11);
    streamSnapshot.gameState.turnNumber = 2;
    streamSnapshot.cardState.turnIndex = 2;
    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        seats: { black: true, white: true },
        stateVersion: 11,
        snapshot: streamSnapshot,
        playbackEvents: []
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(client.getStateVersion()).toBe(11);

    // A local preview/rollback may temporarily expose an older live turn.
    // Publish freshness must retain the accepted authoritative scalar.
    global.cardState.turnIndex = 1;

    const publishResult = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 10)
    });

    expect(publishResult.ok).toBe(true);
    expect(publishPayloads).toHaveLength(1);
    expect(publishPayloads[0].baseVersion).toBe(11);
    expect(publishPayloads[0].turnIndex).toBe(2);
    expect(publishPayloads[0].presentationEnvelopeVersion).toBe(2);
  });

  test('後続送信は待機中でも呼び出し時点のスナップショットを保持する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const useCardSnapshot = createSnapshot(11);
    useCardSnapshot.gameState.turnNumber = 2;
    useCardSnapshot.cardState.charge.black = 7;
    useCardSnapshot.cardState.pendingEffectByPlayer.black = {
      type: 'PERMA_PROTECT_NEXT_STONE',
      stage: null
    };
    useCardSnapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
    useCardSnapshot.cardState.turnIndex = 2;

    const placedSnapshot = createSnapshot(12);
    placedSnapshot.gameState.currentPlayer = -1;
    placedSnapshot.gameState.turnNumber = 3;
    placedSnapshot.cardState.charge.black = 7;
    placedSnapshot.cardState.pendingEffectByPlayer.black = null;
    placedSnapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
    placedSnapshot.cardState.markers = [{ row: 2, col: 3, type: 'PERMA_PROTECTED', owner: 'black' }];
    placedSnapshot.cardState.turnIndex = 3;

    publishPayloads.length = 0;
    publishCount = 0;
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        publishCount += 1;

        if (publishCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            stateVersion: 11,
            snapshot: {
              ...useCardSnapshot,
              stateVersion: 11
            }
          });
        }

        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 12,
          snapshot: {
            ...placedSnapshot,
            stateVersion: 12
          }
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const firstPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'use_card',
      playbackEvents: [],
      snapshot: useCardSnapshot,
      action: createUseCardAction('black', 'sample_card', useCardSnapshot.cardState.turnIndex)
    });

    global.gameState = JSON.parse(JSON.stringify(placedSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(placedSnapshot.cardState));

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', placedSnapshot.cardState.turnIndex)
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);

    expect(publishPayloads).toHaveLength(2);
    expect(publishPayloads[1].baseVersion).toBe(11);
    expect(publishPayloads[1].snapshot).toBeUndefined();
    expect(publishPayloads[1].playbackEvents).toBeUndefined();
    expect(publishPayloads[1].params).toEqual({ row: 2, col: 3 });
  });

  test('後続publish送信後の先行操作SSEはstateVersion更新済みのため適用をスキップする', async () => {
    let resolveSecondPublish = null;

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
        publishCount += 1;

        if (publishCount === 1) {
          return jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            stateVersion: 11,
            snapshot: createSnapshot(11)
          });
        }

        return new Promise((resolve) => {
          resolveSecondPublish = () => resolve(jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            stateVersion: 12,
            snapshot: createSnapshot(12)
          }));
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const firstPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      snapshot: createSnapshot(11),
      action: createPlaceAction('black', 1)
    });

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      snapshot: createSnapshot(12),
      action: createPlaceAction('black', 1)
    });

    const firstResult = await firstPublish;
    expect(firstResult.ok).toBe(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(publishPayloads).toHaveLength(2);
    const firstOperationId = publishPayloads[0].operationId;

    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId: firstOperationId,
        playerKey: 'black',
        actionType: 'place',
        playbackEvents: [{
          type: 'hand_remove',
          phase: 1,
          targets: [{ player: 'black', count: 1 }]
        }],
        snapshot: createSnapshot(11)
      })
    });

    // Single Writer: POST応答でstateVersionが11に更新済みのため、
    // 同バージョンのSSEはstaleとして拒否される (events は emit されない)
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();

    expect(typeof resolveSecondPublish).toBe('function');
    resolveSecondPublish();

    const secondResult = await secondPublish;
    expect(secondResult.ok).toBe(true);
  });

  test('publish成功応答のサーバー playbackEvents がtimelineでstrict再生される', async () => {
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    // Mock: サーバー応答に playbackEvents を含める (Single Writer)
    publishPayloads.length = 0;
    publishCount = 0;
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
        const playbackEvents = [{
          type: 'move',
          phase: 1,
          targets: [{ from: { r: 3, col: 3 }, to: { r: 3, col: 4 } }]
        }];
        publishPayloads.push(body);
        publishCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          operationId: body.operationId,
          stateVersion: 11,
          snapshot: createSnapshot(11),
          presentationCursor: { visualSeq: 1, stateVersion: 11 },
          presentationFrames: [createPresentationFrame(playbackEvents, body.operationId)],
          playbackEvents
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const result = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    expect(result.ok).toBe(true);
    await flushPresentation();
    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PLAYBACK_EVENTS',
        events: [{
          type: 'move',
          phase: 1,
          targets: [{ from: { r: 3, col: 3 }, to: { r: 3, col: 4 } }]
        }],
        meta: expect.objectContaining({
          source: 'network_timeline',
          strictNetworkPlayback: true,
          visualSeq: 1
        })
      })
    );
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
  });

  test('publish応答先着後のself SSEで同一 version は重複適用されない', async () => {
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    // Mock: サーバー応答に playbackEvents を含める (Single Writer)
    publishPayloads.length = 0;
    publishCount = 0;
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
        const playbackEvents = [
          {
            type: 'move',
            phase: 1,
            targets: [{ from: { r: 3, col: 3 }, to: { r: 3, col: 4 } }]
          },
          {
            type: 'flip',
            phase: 2,
            targets: [{ r: 3, col: 4, ownerBefore: -1, ownerAfter: 1 }]
          }
        ];
        publishPayloads.push(body);
        publishCount += 1;
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          operationId: body.operationId,
          stateVersion: 11,
          snapshot: createSnapshot(11),
          presentationCursor: { visualSeq: 1, stateVersion: 11 },
          presentationFrames: [createPresentationFrame(playbackEvents, body.operationId)],
          playbackEvents
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

    const publishResult = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    expect(publishResult.ok).toBe(true);
    expect(publishPayloads).toHaveLength(1);
    const operationId = publishPayloads[0].operationId;
    await flushPresentation();

    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();

    // 同一 version の SSE が届いても、stale として reject される
    eventSources[0].onmessage({
      data: JSON.stringify({
        ok: true,
        roomId: 'ABC',
        operationId,
        playerKey: 'black',
        actionType: 'place',
        presentationCursor: { visualSeq: 1, stateVersion: 11 },
        presentationFrames: [createPresentationFrame([
          {
            type: 'move',
            phase: 1,
            targets: [{ from: { r: 3, col: 3 }, to: { r: 3, col: 4 } }]
          },
          {
            type: 'flip',
            phase: 2,
            targets: [{ r: 3, col: 4, ownerBefore: -1, ownerAfter: 1 }]
          }
        ], operationId)],
        playbackEvents: [
          {
            type: 'move',
            phase: 1,
            targets: [{ from: { r: 3, col: 3 }, to: { r: 3, col: 4 } }]
          },
          {
            type: 'flip',
            phase: 2,
            targets: [{ r: 3, col: 4, ownerBefore: -1, ownerAfter: 1 }]
          }
        ],
        snapshot: createSnapshot(11)
      })
    });

    await flushPresentation();
    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
  });

  test('self SSE先着後のpublish応答で同一 version は重複適用されない', async () => {
    global.BoardOps = {
      emitPresentationEvent: jest.fn((state, ev) => {
        if (!state || !ev) return;
        if (!Array.isArray(state.presentationEvents)) state.presentationEvents = [];
        state.presentationEvents.push(ev);
      })
    };

    let resolvePublishResponse;
    const echoedPlaybackEvents = [
      {
        type: 'move',
        phase: 1,
        targets: [{ from: { r: 3, col: 3 }, to: { r: 3, col: 4 } }]
      },
      {
        type: 'flip',
        phase: 2,
        targets: [{ r: 3, col: 4, ownerBefore: -1, ownerAfter: 1 }]
      }
    ];

    publishPayloads.length = 0;
    publishCount = 0;
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
        publishCount += 1;
        return await new Promise((resolve) => {
          resolvePublishResponse = () => resolve(jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            presentationCursor: { visualSeq: 1, stateVersion: 11 },
            presentationFrames: [createPresentationFrame(echoedPlaybackEvents, body.operationId)],
            stateVersion: 11,
            snapshot: createSnapshot(11),
            playbackEvents: echoedPlaybackEvents,
            operationId: body.operationId
          }));
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);
    expect(eventSources).toHaveLength(1);

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
        presentationCursor: { visualSeq: 1, stateVersion: 11 },
        presentationFrames: [createPresentationFrame(echoedPlaybackEvents, operationId)],
        playbackEvents: echoedPlaybackEvents,
        snapshot: createSnapshot(11)
      })
    });

    await Promise.resolve();
    await Promise.resolve();

    await flushPresentation();
    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();

    expect(typeof resolvePublishResponse).toBe('function');
    resolvePublishResponse();

    const publishResult = await publishPromise;
    expect(publishResult.ok).toBe(true);
    await flushPresentation();
    expect(global.PresentationHandler.handlePresentationEvent).toHaveBeenCalledTimes(1);
    expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
  });

  test('先行publish成功応答で後続ローカル状態を巻き戻さない', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const firstSnapshot = createSnapshot(11);
    firstSnapshot.gameState.turnNumber = 2;
    firstSnapshot.cardState.pendingEffectByPlayer.black = {
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget',
      firstTarget: { row: 2, col: 3 }
    };
    firstSnapshot.cardState.turnIndex = 2;

    const finalSnapshot = createSnapshot(12);
    finalSnapshot.gameState.currentPlayer = -1;
    finalSnapshot.gameState.turnNumber = 3;
    finalSnapshot.cardState.pendingEffectByPlayer.black = null;
    finalSnapshot.cardState.turnIndex = 3;
    finalSnapshot.cardState.markers = [{ row: 4, col: 4, type: 'GUARD', owner: 'black' }];
    const expectedFinalState = {
      gameState: JSON.parse(JSON.stringify(finalSnapshot.gameState)),
      cardState: JSON.parse(JSON.stringify(finalSnapshot.cardState))
    };

    let localStateSeenAtSecondPublish = null;
    publishPayloads.length = 0;
    publishCount = 0;
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        publishCount += 1;

        if (publishCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return jsonResponse(200, {
            ok: true,
            roomId: 'ABC',
            stateVersion: 11,
            snapshot: {
              ...firstSnapshot,
              stateVersion: 11
            }
          });
        }

        localStateSeenAtSecondPublish = {
          gameState: JSON.parse(JSON.stringify(global.gameState)),
          cardState: JSON.parse(JSON.stringify(global.cardState))
        };

        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 12,
          snapshot: {
            ...finalSnapshot,
            stateVersion: 12
          }
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const firstPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      snapshot: firstSnapshot,
      action: createPlaceAction('black', firstSnapshot.cardState.turnIndex)
    });

    global.gameState = JSON.parse(JSON.stringify(finalSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(finalSnapshot.cardState));

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      snapshot: finalSnapshot,
      action: createPlaceAction('black', finalSnapshot.cardState.turnIndex)
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);

    expect(localStateSeenAtSecondPublish).toEqual(expectedFinalState);
  });

  test('先行publish拒否応答でも後続ローカル状態を巻き戻さず baseVersion だけ更新する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const rejectedSnapshot = createSnapshot(11);
    rejectedSnapshot.gameState.turnNumber = 2;
    rejectedSnapshot.cardState.pendingEffectByPlayer.black = {
      type: 'POSITION_SWAP_WILL',
      stage: 'selectTarget',
      firstTarget: { row: 2, col: 3 }
    };
    rejectedSnapshot.cardState.turnIndex = 2;

    const finalSnapshot = createSnapshot(12);
    finalSnapshot.gameState.currentPlayer = -1;
    finalSnapshot.gameState.turnNumber = 3;
    finalSnapshot.cardState.pendingEffectByPlayer.black = null;
    finalSnapshot.cardState.turnIndex = 3;
    finalSnapshot.cardState.markers = [{ row: 4, col: 4, type: 'GUARD', owner: 'black' }];
    const expectedFinalState = {
      gameState: JSON.parse(JSON.stringify(finalSnapshot.gameState)),
      cardState: JSON.parse(JSON.stringify(finalSnapshot.cardState))
    };

    let localStateSeenAtSecondPublish = null;
    publishPayloads.length = 0;
    publishCount = 0;
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        publishCount += 1;

        if (publishCount === 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          return jsonResponse(409, {
            ok: false,
            rejectedReason: 'VERSION_AHEAD',
            stateVersion: 11,
            snapshot: {
              ...rejectedSnapshot,
              stateVersion: 11
            }
          });
        }

        localStateSeenAtSecondPublish = {
          gameState: JSON.parse(JSON.stringify(global.gameState)),
          cardState: JSON.parse(JSON.stringify(global.cardState))
        };

        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 12,
          snapshot: {
            ...finalSnapshot,
            stateVersion: 12
          }
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const firstPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      snapshot: rejectedSnapshot,
      action: createPlaceAction('black', rejectedSnapshot.cardState.turnIndex)
    });

    global.gameState = JSON.parse(JSON.stringify(finalSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(finalSnapshot.cardState));

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      snapshot: finalSnapshot,
      action: createPlaceAction('black', finalSnapshot.cardState.turnIndex)
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);
    expect(firstResult.ok).toBe(false);
    expect(firstResult.reason).toBe('VERSION_AHEAD');
    expect(secondResult.ok).toBe(true);

    expect(publishPayloads).toHaveLength(2);
    expect(publishPayloads[1].baseVersion).toBe(11);
    expect(localStateSeenAtSecondPublish).toEqual(expectedFinalState);
    const telemetry = client.getNetworkTelemetry();
    expect(telemetry.counts.publish_version_ahead).toBe(1);
    expect(telemetry.counts.publish_version_mismatch).toBe(1);
  });

  test('同版 VERSION_MISMATCH 拒否は rejection snapshot を force apply せず telemetry に残す', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const rejectedSnapshot = createSnapshot(10);
    rejectedSnapshot.gameState.turnNumber = 99;
    rejectedSnapshot.cardState.markers = [{ row: 7, col: 7, type: 'FORCED_REJECT_MARKER' }];

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        return jsonResponse(409, {
          ok: false,
          roomId: 'ABC',
          rejectedReason: 'VERSION_MISMATCH',
          stateVersion: 10,
          snapshot: rejectedSnapshot,
          publishMeta: {
            kind: 'rejected',
            operationId: body.operationId,
            actionType: body.actionType,
            receivedBaseVersion: body.baseVersion,
            authoritativeStateVersion: 10,
            rejectedReason: 'VERSION_MISMATCH'
          }
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const result = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('VERSION_MISMATCH');
    expect(global.gameState.turnNumber).toBe(1);
    expect(global.cardState.markers).toEqual([]);

    const telemetry = client.getNetworkTelemetry();
    expect(telemetry.counts.publish_version_mismatch).toBe(1);
    expect(telemetry.counts.publish_rejection_snapshot_skipped).toBe(1);
    expect(telemetry.recentEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'publish_rejection_snapshot_skipped',
        details: expect.objectContaining({
          skipReason: 'same_version_version_mismatch'
        })
      })
    ]));
  });

  test('VERSION_AHEAD 拒否は最新 state に同期して同じ operationId で一度だけ再送する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const syncedSnapshot = createSnapshot(11);
    syncedSnapshot.gameState.turnNumber = 2;
    syncedSnapshot.cardState.turnIndex = 2;
    const acceptedSnapshot = createSnapshot(12);
    acceptedSnapshot.gameState.currentPlayer = -1;
    acceptedSnapshot.gameState.turnNumber = 3;
    acceptedSnapshot.cardState.turnIndex = 3;

    publishPayloads.length = 0;
    let publishAttempts = 0;
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/state') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 11,
          snapshot: syncedSnapshot
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        publishAttempts += 1;
        if (publishAttempts === 1) {
          return jsonResponse(409, {
            ok: false,
            roomId: 'ABC',
            rejectedReason: 'VERSION_AHEAD',
            stateVersion: 11,
            snapshot: syncedSnapshot
          });
        }
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 12,
          snapshot: acceptedSnapshot
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const result = await client.publishCommand({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    expect(result.ok).toBe(true);
    expect(publishPayloads).toHaveLength(2);
    expect(publishPayloads[0].baseVersion).toBe(10);
    expect(publishPayloads[1].baseVersion).toBe(11);
    expect(publishPayloads[1].turnIndex).toBe(2);
    expect(publishPayloads[1].action.turnIndex).toBe(2);
    expect(publishPayloads[1].operationId).toBe(publishPayloads[0].operationId);
    expect(client.getStateVersion()).toBe(12);

    const telemetry = client.getNetworkTelemetry();
    expect(telemetry.counts.publish_version_conflict_retry).toBe(1);
    expect(telemetry.counts.publish_version_conflict_retry_accepted).toBe(1);
  });

  test('idempotent replay 応答を telemetry に残す', async () => {
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
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 11,
          snapshot: createSnapshot(11),
          idempotentReplay: true,
          publishMeta: {
            kind: 'idempotent_replay',
            operationId: body.operationId,
            actionType: body.actionType,
            receivedBaseVersion: body.baseVersion,
            authoritativeStateVersion: 11,
            replayedStateVersion: 11
          }
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const result = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    expect(result.ok).toBe(true);
    expect(client.getNetworkTelemetry().counts.publish_idempotent_replay_ack).toBe(1);
  });

  test('部屋番号が3文字でない場合は参加を事前に拒否する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const result = await client.joinRoom('ABCDE', { serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ROOM_ID_INVALID');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('チャットは20文字超過を送信前に拒否する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    global.fetch.mockClear();

    const result = await client.sendChatMessage('あ'.repeat(21));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('MESSAGE_TOO_LONG');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('未接続時の getRoomBoardConfig は通常盤面を部屋固定として返さない', () => {
    global.gameState.boardConfig = { rows: 8, cols: 8, standard8x8: true };

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    expect(client.isActive()).toBe(false);
    expect(client.getRoomBoardConfig()).toBeNull();
  });

  test('createRoom は deckCode、roomBoardConfig、持ち時間を送信し部屋メタデータを保持する', async () => {
    let createBody = null;

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/create') {
        createBody = JSON.parse(init.body || '{}');
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'seat-token',
          roomDeck: {
            mode: 'perPlayer',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: {
              black: 'D1C1:test_card*3',
              white: ''
            },
            deckSizeByPlayer: {
              black: 30,
              white: 30
            },
            source: 'room'
          },
          roomBoardConfig: {
            rows: 7,
            cols: 9
          },
          stateVersion: 10,
          snapshot: createSnapshot(10)
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({
      serverUrl: 'http://localhost:8787',
      playerName: 'くろ',
      deckCode: 'D1C1:test_card*3',
      turnTimeSeconds: 37,
      roomBoardConfig: {
        rows: 7,
        cols: 9
      }
    });

    expect(created.ok).toBe(true);
    expect(createBody).toEqual({
      playerName: 'くろ',
      roomName: '無名部屋',
      deckCode: 'D1C1:test_card*3',
      turnTimeSeconds: 37,
      roomBoardConfig: {
        rows: 7,
        cols: 9
      },
      selectedHandSkinId: 'default'
    });
    expect(client.getRoomDeck()).toEqual({
      mode: 'perPlayer',
      deckSize: null,
      deckSizeByPlayer: {
        black: 30,
        white: 30
      },
      source: 'room'
    });
    expect(client.getRoomBoardConfig()).toMatchObject({
      rows: 7,
      cols: 9,
      standard8x8: false
    });
  });

  test('joinRoom は deckCode だけを送り roomBoardConfig は部屋正本を保持する', async () => {
    let joinBody = null;

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        joinBody = JSON.parse(init.body || '{}');
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'white',
          seatToken: 'seat-token-white',
          roomDeck: {
            mode: 'perPlayer',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: {
              black: 'D1C1:black_card*3',
              white: 'D1C1:white_card*3'
            },
            deckSizeByPlayer: {
              black: 30,
              white: 30
            },
            source: 'room'
          },
          roomBoardConfig: {
            rows: 6,
            cols: 8
          },
          stateVersion: 10,
          snapshot: createSnapshot(10)
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', {
      serverUrl: 'http://localhost:8787',
      playerName: 'しろ',
      deckCode: 'D1C1:white_card*3',
      roomBoardConfig: {
        rows: 4,
        cols: 4
      }
    });

    expect(joined.ok).toBe(true);
    expect(joinBody).toEqual({
      roomId: 'ABC',
      playerName: 'しろ',
      deckCode: 'D1C1:white_card*3',
      selectedHandSkinId: 'default'
    });
    expect(client.getRoomDeck()).toEqual({
      mode: 'perPlayer',
      deckSize: null,
      deckSizeByPlayer: {
        black: 30,
        white: 30
      },
      source: 'room'
    });
    expect(client.getRoomBoardConfig()).toMatchObject({
      rows: 6,
      cols: 8,
      standard8x8: false
    });
  });

  test('createRoom は roomBoardConfig が無くても snapshot の custom boardConfig を保持する', async () => {
    global.fetch = jest.fn(async (url) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 10,
          snapshot: createSnapshot(10, {
            boardConfig: { rows: 7, cols: 9, standard8x8: false }
          })
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({
      serverUrl: 'http://localhost:8787',
      playerName: 'くろ'
    });

    expect(created.ok).toBe(true);
    expect(client.getRoomBoardConfig()).toMatchObject({
      rows: 7,
      cols: 9,
      standard8x8: false
    });
  });

  test('publishが一時失敗した場合は同operationIdで自動再送する', async () => {
    const publishBodies = [];
    let publishAttempt = 0;

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 20,
          snapshot: createSnapshot(20)
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        publishAttempt += 1;

        if (publishAttempt === 1) {
          return jsonResponse(503, { ok: false, rejectedReason: 'TEMPORARY_UNAVAILABLE' });
        }

        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          stateVersion: 21,
          snapshot: createSnapshot(21)
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const result = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      action: createPlaceAction('black', 1)
    });

    expect(result.ok).toBe(true);
    expect(publishBodies).toHaveLength(2);
    expect(publishBodies[0].operationId).toBeTruthy();
    expect(publishBodies[1].operationId).toBe(publishBodies[0].operationId);
  });
});
