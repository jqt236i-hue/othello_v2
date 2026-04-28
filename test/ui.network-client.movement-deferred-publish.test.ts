import * as path from 'path';
import { JSDOM } from 'jsdom';

const MODULE_PATH = path.resolve(__dirname, '..', 'game', 'card-effects', 'strong-wind.js');
const PRESENTATION_PATH = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');

const CASES = [
  {
    label: 'STRONG_WIND_WILL',
    handlerName: 'handleStrongWindSelection',
    pendingType: 'STRONG_WIND_WILL',
    actionField: 'strongWindTarget',
    cardId: 'strong_wind_01'
  },
  {
    label: 'SUPER_BUOYANCY_WILL',
    handlerName: 'handleSuperBuoyancySelection',
    pendingType: 'SUPER_BUOYANCY_WILL',
    actionField: 'superBuoyancyTarget',
    cardId: 'super_buoyancy_01'
  },
  {
    label: 'SUPER_GRAVITY_WILL',
    handlerName: 'handleSuperGravitySelection',
    pendingType: 'SUPER_GRAVITY_WILL',
    actionField: 'superGravityTarget',
    cardId: 'super_gravity_01'
  }
];

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

const CUSTOM_BOARD_CONFIG = { rows: 7, cols: 9, standard8x8: false };

function createBoard(rows = CUSTOM_BOARD_CONFIG.rows, cols = CUSTOM_BOARD_CONFIG.cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
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

function createSnapshot(stateVersion, pendingType, cardId) {
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
      turnNumber: 11,
      board: createBoard(),
      boardConfig: cloneJson(CUSTOM_BOARD_CONFIG)
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: {
        black: { type: pendingType, stage: 'selectTarget', cardId },
        white: null
      },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: [],
      turnIndex: 4
    }
  };
}

describe.each(CASES)('NetworkMatchClient $label deferred publish', ({ handlerName, pendingType, actionField, cardId }) => {
  let dom;
  let publishBodies;
  let runTurnMock;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock(PRESENTATION_PATH, () => ({
      emitPresentationEvent: jest.fn(() => true)
    }), { virtual: false });

    delete require.cache[MODULE_PATH];

    dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;
    global.localStorage = dom.window.localStorage;

    global.BLACK = 1;
    global.WHITE = -1;
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.MATCH_MODE = 'network';
    global.DEBUG_HUMAN_VS_HUMAN = false;

    const initial = createSnapshot(20, pendingType, cardId);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;

    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.waitForPlaybackIdle = jest.fn(async () => {});
    global.onTurnStart = jest.fn(async () => ({
      playbackEvents: [{ type: 'draw', phase: 2 }]
    }));
    global.isGameOver = jest.fn(() => false);
    global.processCpuTurn = jest.fn();
    global.requestAnimationFrame = jest.fn((callback) => {
      if (typeof callback === 'function') callback();
      return 1;
    });
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    runTurnMock = jest.fn(() => ({
      ok: true,
      rawEvents: [],
      nextCardState: {
        ...global.cardState,
        pendingEffectByPlayer: { black: null, white: null }
      },
      nextGameState: {
        ...global.gameState,
        currentPlayer: global.WHITE,
        turnNumber: 12
      },
      playbackEvents: [{ type: 'status_applied', phase: 1 }]
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
          roomId: 'MOV',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 20,
          roomBoardConfig: cloneJson(CUSTOM_BOARD_CONFIG),
          snapshot: createSnapshot(20, pendingType, cardId)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'MOV',
          stateVersion: 21,
          snapshot: body.snapshot
            ? {
              ...body.snapshot,
              stateVersion: 21,
              _meta: {
                authority: 'server',
                version: 21,
                projectedForSeat: null,
                turnStartReconciled: true
              }
            }
            : {
              stateVersion: 21,
              _meta: {
                authority: 'server',
                version: 21,
                projectedForSeat: null,
                turnStartReconciled: true
              },
              gameState: {
                ...cloneJson(global.gameState),
                currentPlayer: global.WHITE,
                turnNumber: 12
              },
              cardState: {
                ...cloneJson(global.cardState),
                pendingEffectByPlayer: { black: null, white: null }
              }
            }
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
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.MATCH_MODE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.gameState;
    delete global.cardState;
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.waitForPlaybackIdle;
    delete global.onTurnStart;
    delete global.isGameOver;
    delete global.processCpuTurn;
    delete global.requestAnimationFrame;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.NetworkMatchClient;
    delete global.EventSource;
    delete global.fetch;
    delete globalThis.waitForPlaybackIdle;
  });

  test('selection publishes only the deferred command once', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    expect(client).toBeTruthy();
    global.NetworkMatchClient = client;

    const created = await client.createRoom({
      serverUrl: 'http://localhost:8787',
      playerName: 'くろ',
      roomBoardConfig: cloneJson(CUSTOM_BOARD_CONFIG)
    });
    expect(created.ok).toBe(true);
    expect(client.getRoomBoardConfig()).toMatchObject(CUSTOM_BOARD_CONFIG);
    expect(global.gameState.board).toHaveLength(7);
    expect(global.gameState.board[0]).toHaveLength(9);

    import * as handlers from '../game/card-effects/strong-wind.js';
    const result = await handlers[handlerName](6, 8, 'black');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      pendingType,
      publishedByNetwork: true
    }));
    expect(runTurnMock).not.toHaveBeenCalled();

    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual({
      player: 'black',
      [actionField]: { row: 6, col: 8 },
      pendingSelectionState: {
        type: pendingType,
        stage: 'selectTarget',
        cardId
      }
    });
    expect(publishBodies[0].snapshot).toBeUndefined();
    expect(publishBodies[0].playbackEvents).toBeUndefined();
    expect(global.gameState.turnNumber).toBe(12);
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
  });
});
