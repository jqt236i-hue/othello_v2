import { JSDOM } from 'jsdom';

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function createSnapshot(stateVersion, board) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: null,
      turnStartReconciled: true
    },
    gameState: {
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0,
      board: board || Array.from({ length: 8 }, () => Array(8).fill(0))
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

describe('NetworkMatchClient snapshot effect logs', () => {
  let dom;
  let eventSourceInstance;
  let initialSnapshot;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;
    global.BLACK = 1;
    global.WHITE = -1;

    initialSnapshot = createSnapshot(3);
    global.gameState = initialSnapshot.gameState;
    global.cardState = initialSnapshot.cardState;

    global.addLog = jest.fn();
    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    window.addLog = global.addLog;
    window.emitLogAdded = global.emitLogAdded;

    global.EventSource = class MockEventSource {
      constructor() {
        eventSourceInstance = this;
      }
      addEventListener() {}
      close() {}
    };
    global.EventSource.OPEN = 1;
    window.EventSource = global.EventSource;

    global.fetch = jest.fn(async (url, options = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/join') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          seatToken: 'token_black',
          seats: { black: true, white: true },
          stateVersion: 3,
          snapshot: initialSnapshot
        });
      }

      if (path === '/api/match/publish') {
        const body = options && options.body ? JSON.parse(String(options.body)) : {};
        return jsonResponse(200, {
          ok: true,
          roomId: 'ABC',
          seatKey: 'black',
          playerKey: 'black',
          actionType: 'use_card',
          operationId: body.operationId || null,
          stateVersion: 4,
          seats: { black: true, white: true },
          snapshot: createSnapshot(4),
          playbackEvents: [],
          effectLogs: ['黒がカードを使用: 交換']
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
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.EventSource;
    delete global.fetch;
  });

  test('remote snapshot effect logs are emitted once through the effect-log channel', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(joined.ok).toBe(true);
    expect(eventSourceInstance).toBeTruthy();

    global.emitLogAdded.mockClear();
    global.addLog.mockClear();

    const nextBoard = Array.from({ length: 8 }, () => Array(8).fill(0));
    nextBoard[2][3] = 1;
    nextBoard[3][3] = 1;
    nextBoard[3][4] = -1;
    nextBoard[4][4] = -1;

    const payload = {
      ok: true,
      roomId: 'ABC',
      operationId: 'remote-use-card-1',
      playerKey: 'white',
      actionType: 'use_card',
      playbackEvents: [],
      effectLogs: ['白がカードを使用: 交換', '白: 交換でD3を変換'],
      snapshot: createSnapshot(4, nextBoard)
    };

    eventSourceInstance.onmessage({ data: JSON.stringify(payload) });
    await Promise.resolve();
    await Promise.resolve();

    eventSourceInstance.onmessage({ data: JSON.stringify(payload) });
    await Promise.resolve();
    await Promise.resolve();

    expect(global.emitLogAdded.mock.calls).toEqual([
      ['白がカードを使用: 交換', 'effect'],
      ['白: 交換でD3を変換', 'effect']
    ]);
    expect(global.addLog).not.toHaveBeenCalled();
  });

  test('accepted publish response emits snapshot effect logs through the effect-log channel', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;

    const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(joined.ok).toBe(true);

    global.emitLogAdded.mockClear();
    global.addLog.mockClear();

    const result = await client.publishSnapshot({
      playerKey: 'black',
      actionType: 'use_card',
      action: {
        type: 'use_card',
        playerKey: 'black',
        cardId: 'swap_01'
      },
      playbackEvents: []
    });

    expect(result.ok).toBe(true);
    expect(global.emitLogAdded).toHaveBeenCalledWith('黒がカードを使用: 交換', 'effect');
    expect(global.addLog).not.toHaveBeenCalled();
  });
});
