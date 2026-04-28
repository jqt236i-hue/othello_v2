import { JSDOM } from 'jsdom';

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
      currentPlayer: -1,
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

describe('NetworkMatchClient seat normalization', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.gameState = createSnapshot(3).gameState;
    global.cardState = createSnapshot(3).cardState;

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();

    global.EventSource = class MockEventSource {
      addEventListener() {}
      close() {}
    };

    global.fetch = jest.fn(async (url) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: ' WHITE ',
          seatToken: 'token_white',
          seats: { black: true, white: true },
          stateVersion: 3,
          snapshot: createSnapshot(3)
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

  test('join応答のseatKeyが大文字や空白付きでも白席として扱う', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'しろ' });

    expect(joined.ok).toBe(true);
    expect(joined.seatKey).toBe('white');
    expect(client.getSeatKey()).toBe('white');
    expect(window.LOCAL_PLAYER_KEY).toBe('white');
    expect(window.BOARD_VIEWER_KEY).toBe('white');
    expect(window.__LOCAL_PLAYER_KEY).toBe('white');
  });

  test('保存済みseatTokenが不一致で失敗した場合は通常joinを再試行する', async () => {
    const roomId = 'ABC';
    const seatStorageKey = `network_match_seat_${roomId}`;
    localStorage.setItem(seatStorageKey, JSON.stringify({
      roomId,
      seatKey: 'black',
      seatToken: 'stale_token'
    }));

    const joinBodies = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        const body = JSON.parse(init.body || '{}');
        joinBodies.push(body);

        if (joinBodies.length === 1) {
          return jsonResponse(409, { ok: false, reason: 'ROOM_FULL' });
        }

        return jsonResponse(200, {
          ok: true,
          roomId,
          seatKey: 'white',
          seatToken: 'token_white_new',
          seats: { black: true, white: true },
          stateVersion: 4,
          snapshot: createSnapshot(4)
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const joined = await client.joinRoom(roomId, { serverUrl: 'http://localhost:8787', playerName: 'しろ' });
    expect(joined.ok).toBe(true);
    expect(joined.seatKey).toBe('white');

    expect(joinBodies).toHaveLength(2);
    expect(joinBodies[0].seatKey).toBe('black');
    expect(joinBodies[0].seatToken).toBe('stale_token');
    expect(joinBodies[1].seatKey).toBeUndefined();
    expect(joinBodies[1].seatToken).toBeUndefined();

    const storedRaw = localStorage.getItem(seatStorageKey);
    expect(storedRaw).toBeTruthy();
    const stored = JSON.parse(storedRaw);
    expect(stored.seatKey).toBe('white');
    expect(stored.seatToken).toBe('token_white_new');
  });
});
