const { JSDOM } = require('jsdom');

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function createSnapshot(stateVersion) {
  return {
    stateVersion,
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

describe('NetworkMatchClient queued publish', () => {
  let dom;
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

    global.EventSource = class MockEventSource {
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
      playbackEvents: []
    });

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: []
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);

    expect(publishPayloads).toHaveLength(2);
    expect(publishPayloads[0].baseVersion).toBe(10);
    expect(publishPayloads[1].baseVersion).toBe(11);
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
            ...body.snapshot,
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
      snapshot: useCardSnapshot
    });

    global.gameState = JSON.parse(JSON.stringify(placedSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(placedSnapshot.cardState));

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: []
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);

    expect(publishPayloads).toHaveLength(2);
    expect(publishPayloads[1].baseVersion).toBe(11);
    expect(publishPayloads[1].snapshot.gameState.turnNumber).toBe(3);
    expect(publishPayloads[1].snapshot.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(publishPayloads[1].snapshot.cardState.markers).toEqual([
      { row: 2, col: 3, type: 'PERMA_PROTECTED', owner: 'black' }
    ]);
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
            ...body.snapshot,
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
      snapshot: firstSnapshot
    });

    global.gameState = JSON.parse(JSON.stringify(finalSnapshot.gameState));
    global.cardState = JSON.parse(JSON.stringify(finalSnapshot.cardState));

    const secondPublish = client.publishSnapshot({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [],
      snapshot: finalSnapshot
    });

    const [firstResult, secondResult] = await Promise.all([firstPublish, secondPublish]);
    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);

    expect(localStateSeenAtSecondPublish).toEqual({
      gameState: finalSnapshot.gameState,
      cardState: finalSnapshot.cardState
    });
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

  test('createRoom は deckCode を送信し player別 roomDeck を保持する', async () => {
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
              white: 64
            },
            source: 'room'
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
      deckCode: 'D1C1:test_card*3'
    });

    expect(created.ok).toBe(true);
    expect(createBody).toEqual({
      playerName: 'くろ',
      deckCode: 'D1C1:test_card*3'
    });
    expect(client.getRoomDeck()).toEqual({
      mode: 'perPlayer',
      deckCode: '',
      deckSize: null,
      deckCodeByPlayer: {
        black: 'D1C1:test_card*3',
        white: ''
      },
      deckSizeByPlayer: {
        black: 30,
        white: 64
      },
      source: 'room'
    });
  });

  test('joinRoom は deckCode を送信し player別 roomDeck を保持する', async () => {
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
      deckCode: 'D1C1:white_card*3'
    });

    expect(joined.ok).toBe(true);
    expect(joinBody).toEqual({
      roomId: 'ABC',
      playerName: 'しろ',
      deckCode: 'D1C1:white_card*3'
    });
    expect(client.getRoomDeck()).toEqual({
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
      playbackEvents: []
    });

    expect(result.ok).toBe(true);
    expect(publishBodies).toHaveLength(2);
    expect(publishBodies[0].operationId).toBeTruthy();
    expect(publishBodies[1].operationId).toBe(publishBodies[0].operationId);
  });
});
