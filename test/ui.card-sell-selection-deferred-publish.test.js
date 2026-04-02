const { JSDOM } = require('jsdom');

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createLiveResponseSnapshot(stateVersion) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: null,
      turnStartReconciled: true
    },
    gameState: cloneJson(global.gameState),
    cardState: cloneJson(global.cardState)
  };
}

function createSellResolvedSnapshot(stateVersion) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: null,
      turnStartReconciled: true
    },
    gameState: cloneJson(global.gameState),
    cardState: {
      ...cloneJson(global.cardState),
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      pendingEffectByPlayer: { black: null, white: null },
      discard: ['sell_card']
    }
  };
}

function createSnapshot(stateVersion) {
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
      turnNumber: 5,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      turnIndex: 2,
      charge: { black: 10, white: 10 },
      hands: { black: ['sell_card'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: {
        black: { type: 'SELL_CARD_WILL', stage: 'selectTarget' },
        white: null
      },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    }
  };
}

describe('SELL_CARD_WILL deferred publish from card interaction', () => {
  let dom;
  let publishBodies;
  let runTurnMock;
  let releasePlayback;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM(`
      <!doctype html><html><body>
        <div id="card-detail-name"></div>
        <div id="card-detail-desc"></div>
        <div id="card-detail-actions"></div>
        <button id="destroy-card-btn">破壊</button>
        <button id="use-card-btn">使用</button>
        <button id="toggle-card-detail-btn">詳細</button>
        <button id="pass-btn">パス</button>
        <button id="sell-card-btn">売却</button>
        <button id="cancel-card-btn" style="display:none;">キャンセル</button>
        <div id="use-card-reason"></div>
      </body></html>
    `, { url: 'http://localhost/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;
    const playbackStateManager = require('../ui/playback-state-manager');
    playbackStateManager.abortPlayback();
    playbackStateManager.setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
    global.PlaybackStateManager = playbackStateManager;
    global.window.PlaybackStateManager = playbackStateManager;
    window.DEBUG_UNLIMITED_USAGE = false;
    window.DEBUG_HUMAN_VS_HUMAN = false;
    window.AUTO_MODE_ACTIVE = false;

    global.BLACK = 1;
    global.WHITE = -1;
    global.MATCH_MODE = 'network';
    global.DEBUG_HUMAN_VS_HUMAN = false;

    const initial = createSnapshot(40);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;
    global.isProcessing = false;
    global.isCardAnimating = false;

    global.CardLogic = {
      getCardDef: (id) => ({ id, name: '売値カード', desc: '売る', cost: 6 })
    };
    global.Core = {
      getLegalMoves: () => []
    };
    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.addLog = jest.fn();
    global.isGameOver = jest.fn(() => false);
    global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
      releasePlayback = resolve;
    }));
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
        recordAction: jest.fn(),
        incrementTurnIndex: jest.fn()
      }
    };

    global.TurnPipeline = {};
    runTurnMock = jest.fn(() => {
      const nextCardState = {
        ...global.cardState,
        hands: { black: [], white: [] },
        pendingEffectByPlayer: { black: null, white: null },
        discard: ['sell_card'],
        selectedCardId: null,
        selectedCardOwnerKey: null
      };
      global.cardState = nextCardState;
      return {
        ok: true,
        nextCardState,
        nextGameState: global.gameState,
        playbackEvents: [{ type: 'hand_remove', phase: 1 }]
      };
    });
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: runTurnMock
    };
    window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;

    global.EventSource = class MockEventSource {
      addEventListener() {}
      close() {}
    };

    publishBodies = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      const parsedUrl = new URL(String(url));
      const pathName = parsedUrl.pathname;

      if (pathName === '/api/match/create') {
        return jsonResponse(200, {
          ok: true,
          roomId: 'SEL',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 40,
          snapshot: createSnapshot(40)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        const isSellSelectionPublish = body
          && body.actionType === 'place'
          && body.params
          && body.params.sellCardId === 'sell_card';
        return jsonResponse(200, {
          ok: true,
          roomId: 'SEL',
          stateVersion: 41,
          playbackEvents: isSellSelectionPublish
            ? [{ type: 'hand_remove', phase: 1 }]
            : [],
          snapshot: body.snapshot
            ? {
              ...body.snapshot,
              stateVersion: 41
            }
            : (isSellSelectionPublish ? createSellResolvedSnapshot(41) : createLiveResponseSnapshot(41))
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
    try {
      if (global.PlaybackStateManager && typeof global.PlaybackStateManager.abortPlayback === 'function') {
        global.PlaybackStateManager.abortPlayback();
      }
    } catch (e) {
      // ignore
    }
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') dom.window.close();
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
    delete global.location;
    delete global.localStorage;
    delete global.BLACK;
    delete global.WHITE;
    delete global.MATCH_MODE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.gameState;
    delete global.cardState;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.CardLogic;
    delete global.Core;
    delete global.renderCardUI;
    delete global.emitBoardUpdate;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.addLog;
    delete global.isGameOver;
    delete global.waitForPlaybackIdle;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.PlaybackStateManager;
    delete global.NetworkMatchClient;
    delete global.EventSource;
    delete global.fetch;
    delete globalThis.waitForPlaybackIdle;
  });

  test('sell selection publishes directly without local sell playback replay', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    require('../cards/card-interaction.js');

    window.onCardClick('sell_card', 'black');
    window.confirmSellCardSelection();

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runTurnMock).not.toHaveBeenCalled();
    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual({
      player: 'black',
      sellCardId: 'sell_card'
    });
    expect(publishBodies[0].snapshot).toBeUndefined();
    expect(publishBodies[0].playbackEvents).toBeUndefined();
    expect(global.cardState.hands.black).toEqual([]);
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();

    releasePlayback();
    await Promise.resolve();
    await Promise.resolve();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });
});
