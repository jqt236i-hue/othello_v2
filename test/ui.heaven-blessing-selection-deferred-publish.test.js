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

function createSnapshot(stateVersion) {
  return {
    stateVersion,
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
      hands: { black: ['dummy_01'], white: [] },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: {
        black: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['offer_1', 'offer_2'] },
        white: null
      },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    }
  };
}

function createLiveResponseSnapshot(stateVersion) {
  return {
    stateVersion,
    gameState: cloneJson(global.gameState),
    cardState: cloneJson(global.cardState)
  };
}

function createHeavenResolvedSnapshot(stateVersion) {
  return {
    stateVersion,
    gameState: cloneJson(global.gameState),
    cardState: {
      ...cloneJson(global.cardState),
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: ['dummy_01', 'offer_2'], white: [] },
      pendingEffectByPlayer: { black: null, white: null },
      discard: []
    }
  };
}

describe('HEAVEN_BLESSING deferred publish from overlay selection', () => {
  let dom;
  let publishBodies;
  let runTurnMock;

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
        <div id="board-frame"></div>
      </body></html>
    `, { url: 'http://localhost/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;
    window.DEBUG_UNLIMITED_USAGE = false;
    window.DEBUG_HUMAN_VS_HUMAN = false;
    window.AUTO_MODE_ACTIVE = false;

    global.BLACK = 1;
    global.WHITE = -1;
    global.MATCH_MODE = 'network';
    global.DEBUG_HUMAN_VS_HUMAN = false;

    const initial = createSnapshot(60);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;
    global.isProcessing = false;
    global.isCardAnimating = false;
    const playbackStateManager = require('../ui/playback-state-manager');
    playbackStateManager.clearPlaybackLock();
    global.PlaybackStateManager = playbackStateManager;

    global.CardLogic = {
      getCardDef: (id) => ({ id, name: `name_${id}`, desc: `desc_${id}`, cost: 2 })
    };
    global.getCardCostTier = jest.fn(() => 'mid');
    global.Core = {
      getLegalMoves: () => []
    };
    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.renderCardUI = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.addLog = jest.fn();
    global.isGameOver = jest.fn(() => false);
    global.waitForPlaybackIdle = jest.fn(() => Promise.resolve());
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
        recordAction: jest.fn(),
        incrementTurnIndex: jest.fn()
      }
    };

    global.TurnPipeline = {};
    runTurnMock = jest.fn(() => ({
      ok: true,
      nextCardState: global.cardState,
      nextGameState: global.gameState,
      playbackEvents: [{ type: 'hand_add', phase: 1 }]
    }));
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
          roomId: 'HVN',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 60,
          snapshot: createSnapshot(60)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        const isHeavenSelectionPublish = body
          && body.actionType === 'place'
          && body.params
          && body.params.heavenBlessingCardId === 'offer_2';
        return jsonResponse(200, {
          ok: true,
          roomId: 'HVN',
          stateVersion: 61,
          playbackEvents: isHeavenSelectionPublish
            ? [{ type: 'hand_add', phase: 1 }]
            : [],
          snapshot: body.snapshot
            ? {
              ...body.snapshot,
              stateVersion: 61
            }
            : (isHeavenSelectionPublish ? createHeavenResolvedSnapshot(61) : createLiveResponseSnapshot(61))
        });
      }

      return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    });
  });

  afterEach(() => {
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
    delete global.getCardCostTier;
    delete global.Core;
    delete global.SoundEngine;
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
    delete global.NetworkMatchClient;
    delete global.EventSource;
    delete global.fetch;
    delete global.PlaybackStateManager;
    delete globalThis.waitForPlaybackIdle;
  });

  test('heaven selection publishes directly without local replay in network mode', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const offerCards = document.querySelectorAll('.heaven-offer-card');
    expect(offerCards).toHaveLength(2);
    offerCards[1].click();

    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn).toBeTruthy();
    selectBtn.click();

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
      heavenBlessingCardId: 'offer_2'
    });
    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(global.cardState.hands.black).toEqual(['dummy_01', 'offer_2']);
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    expect(document.getElementById('heaven-blessing-overlay').classList.contains('active')).toBe(false);

    window.onCardClick('offer_2', 'black');
    expect(global.cardState.selectedCardId).toBe('offer_2');
  });
});
