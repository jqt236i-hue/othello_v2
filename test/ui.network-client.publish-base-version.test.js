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