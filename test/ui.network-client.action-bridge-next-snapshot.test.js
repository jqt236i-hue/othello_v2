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
      hands: { black: ['sample_card'], white: [] },
      charge: { black: 10, white: 10 },
        boardBonusByCell: { '2,3': 5 },
        boardBonusConsumedByCell: {},
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      turnIndex: 1
    }
  };
}

describe('NetworkMatchClient action bridge snapshot', () => {
  let dom;
  let publishPayloads;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;

    const initial = createSnapshot(20);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();

    global.EventSource = class MockEventSource {
      addEventListener() {}
      close() {}
    };

    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn((_cs, _gs, _player, action) => {
        if (action && action.type === 'destroy_hand_card') {
          return {
            ok: true,
            nextGameState: {
              currentPlayer: 1,
              turnNumber: 2
            },
            nextCardState: {
              ...createSnapshot(20).cardState,
              hands: { black: [], white: [] },
              hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
              discard: ['sample_card']
            },
            playbackEvents: []
          };
        }
        return {
          ok: true,
          nextGameState: {
            currentPlayer: 1,
            turnNumber: 2
          },
          nextCardState: {
            ...createSnapshot(20).cardState,
            charge: { black: 7, white: 10 },
            hasUsedCardThisTurnByPlayer: { black: true, white: false },
            discard: ['sample_card']
          },
          playbackEvents: []
        };
      })
    };
    window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;

    publishPayloads = [];

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;

      if (path === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'ROOM1234',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 20,
          snapshot: createSnapshot(20)
        });
      }

      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishPayloads.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'ROOM1234',
          stateVersion: 21,
          snapshot: body.snapshot
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
    delete global.TurnPipelineUIAdapter;
    delete global.fetch;
  });

  test('use_card送信でTurnPipelineの次状態をスナップショットに使う', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const action = { type: 'use_card', useCardId: 'sample_card' };
    const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', action, {});
    expect(result.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishPayloads).toHaveLength(1);
    const payload = publishPayloads[0];
    expect(payload.actionType).toBe('use_card');
    expect(payload.snapshot.gameState.turnNumber).toBe(2);
    expect(payload.snapshot.cardState.charge.black).toBe(7);
    expect(payload.snapshot.cardState.boardBonusByCell['2,3']).toBe(5);
    expect(payload.snapshot.cardState.hasUsedCardThisTurnByPlayer.black).toBe(true);
  });

  test('destroy_hand_card送信で次スナップショットが公開される', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const action = { type: 'destroy_hand_card', destroyCardId: 'sample_card' };
    const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', action, {});
    expect(result.ok).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishPayloads).toHaveLength(1);
    const payload = publishPayloads[0];
    expect(payload.actionType).toBe('destroy_hand_card');
    expect(payload.snapshot.cardState.hands.black).toHaveLength(0);
    expect(payload.snapshot.cardState.hasDestroyedCardThisTurnByPlayer.black).toBe(true);
  });

  test('publish成功レスポンスのsnapshotを即反映し断罪候補の不明カードを解消する', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    global.cardState.pendingEffectByPlayer.black = {
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [{ handIndex: 0, cardId: '__hidden_hand__:white:0' }]
    };

    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const path = parsedUrl.pathname;
      if (path === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        return jsonResponse(200, {
          ok: true,
          roomId: 'ROOM1234',
          stateVersion: 21,
          snapshot: {
            ...body.snapshot,
            stateVersion: 21,
            cardState: {
              ...body.snapshot.cardState,
              pendingEffectByPlayer: {
                ...body.snapshot.cardState.pendingEffectByPlayer,
                black: {
                  type: 'CONDEMN_WILL',
                  stage: 'selectTarget',
                  offers: [{ handIndex: 0, cardId: 'gold_stone' }]
                }
              }
            }
          }
        });
      }
      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });

    const result = await client.publishSnapshot({ actionType: 'use_card', playerKey: 'black' });
    expect(result.ok).toBe(true);
    expect(global.cardState.pendingEffectByPlayer.black.offers[0].cardId).toBe('gold_stone');
  });
});
