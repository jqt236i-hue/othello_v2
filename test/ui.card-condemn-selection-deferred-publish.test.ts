import { JSDOM } from 'jsdom';

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

function createCondemnResolvedSnapshot(stateVersion) {
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
      discard: ['enemy_card']
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
      turnNumber: 6,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      turnIndex: 3,
      charge: { black: 10, white: 10 },
      hands: { black: [], white: ['enemy_card'] },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      pendingEffectByPlayer: {
        black: {
          type: 'CONDEMN_WILL',
          stage: 'selectTarget',
          cardId: 'condemn_01',
          offers: [{ cardId: 'enemy_card', handIndex: 0 }]
        },
        white: null
      },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    }
  };
}

describe('CONDEMN_WILL deferred publish from overlay selection', () => {
  let dom;
  let publishBodies;
  let runTurnMock;
  let releasePlayback;
  let playbackIdlePromise;

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
        <button id="cancel-card-btn" style="display:none;">キャンセル</button>
        <div id="use-card-reason"></div>
        <div id="board-frame"></div>
      </body></html>
    `, { url: 'http://localhost/' });

    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;
    const playbackStateManager = require('../ui/playback-state-manager.js');
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

    const initial = createSnapshot(50);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;
    global.isProcessing = false;
    global.isCardAnimating = false;

    global.CardLogic = {
      getCardDef: (id) => ({ id, name: id === 'enemy_card' ? '敵カード' : '断罪', desc: '説明', cost: 6 })
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
    playbackIdlePromise = new Promise((resolve) => {
      releasePlayback = resolve;
    });
    global.waitForPlaybackIdle = jest.fn(() => playbackIdlePromise);
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
        discard: ['enemy_card'],
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
          roomId: 'CDM',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 50,
          snapshot: createSnapshot(50)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        const isCondemnSelectionPublish = body
          && body.actionType === 'place'
          && body.params
          && Number.isInteger(Number(body.params.condemnTargetIndex));
        return jsonResponse(200, {
          ok: true,
          roomId: 'CDM',
          stateVersion: 51,
          playbackEvents: isCondemnSelectionPublish
            ? [{ type: 'hand_remove', phase: 1 }, { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'stone_destroy' }] }]
            : [],
          snapshot: body.snapshot
            ? {
              ...body.snapshot,
              stateVersion: 51
            }
            : (isCondemnSelectionPublish ? createCondemnResolvedSnapshot(51) : createLiveResponseSnapshot(51))
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
    delete global.PlaybackStateManager;
    delete global.NetworkMatchClient;
    delete global.EventSource;
    delete global.fetch;
    delete globalThis.waitForPlaybackIdle;
  });

  test('network overlay selection publishes directly without local condemn playback replay', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn).toBeTruthy();
    expect(selectBtn.disabled).toBe(false);

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
      condemnTargetIndex: 0,
      pendingSelectionState: {
        type: 'CONDEMN_WILL',
        stage: 'selectTarget',
        cardId: 'condemn_01'
      }
    });
    expect(publishBodies[0].snapshot).toBeUndefined();
    expect(publishBodies[0].playbackEvents).toBeUndefined();
    expect(global.cardState.hands.white).toEqual([]);
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(document.getElementById('heaven-blessing-overlay').classList.contains('active')).toBe(false);
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();

    releasePlayback();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    expect((global.cardState.presentationEvents || []).some((event) => event && event.type === 'PLAYBACK_EVENTS')).toBe(false);
    expect((global.cardState._presentationEventsPersist || []).some((event) => event && event.type === 'PLAYBACK_EVENTS')).toBe(false);
  });

  test('overlay destroy click does not publish twice before deferred selection settles', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn).toBeTruthy();
    expect(selectBtn.disabled).toBe(false);

    selectBtn.click();

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishBodies).toHaveLength(1);
    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);

    selectBtn.click();

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishBodies).toHaveLength(1);

    releasePlayback();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });

  test('overlay destroy publish does not wait on its own selection lock forever', async () => {
    global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
      const poll = () => {
        const playbackStateManager = global.PlaybackStateManager;
        if (!playbackStateManager || typeof playbackStateManager.getPlaybackActive !== 'function' || !playbackStateManager.getPlaybackActive()) {
          resolve();
          return;
        }
        setTimeout(poll, 0);
      };
      setTimeout(poll, 0);
    }));
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn).toBeTruthy();
    expect(selectBtn.disabled).toBe(false);

    selectBtn.click();

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runTurnMock).not.toHaveBeenCalled();
    expect(publishBodies).toHaveLength(1);
    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
    expect(global.PlaybackStateManager.getPlaybackActive()).toBe(false);
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
    expect((global.cardState.presentationEvents || []).some((event) => event && event.type === 'PLAYBACK_EVENTS')).toBe(false);
    expect((global.cardState._presentationEventsPersist || []).some((event) => event && event.type === 'PLAYBACK_EVENTS')).toBe(false);
  });

  test('overlay destroy button does not play stone_destroy locally for condemn selection', async () => {
    require('../cards/card-interaction.js');

    window.updateCardDetailPanel();
    const offerCard = document.querySelector('.heaven-offer-card');
    expect(offerCard).toBeTruthy();

    offerCard.click();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();

    const selectBtn = document.getElementById('heaven-blessing-select-btn');
    expect(selectBtn).toBeTruthy();
    selectBtn.click();

    expect(global.SoundEngine.init).not.toHaveBeenCalled();
    expect(global.SoundEngine.playEffectByKey).not.toHaveBeenCalled();
  });
});
