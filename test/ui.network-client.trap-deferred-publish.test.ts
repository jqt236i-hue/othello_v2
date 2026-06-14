import * as path from 'path';
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

const CUSTOM_BOARD_CONFIG = { rows: 7, cols: 9, standard8x8: false };

function createBoard(rows = CUSTOM_BOARD_CONFIG.rows, cols = CUSTOM_BOARD_CONFIG.cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function createLiveResponseSnapshot(stateVersion) {
  return {
    stateVersion,
    gameState: cloneJson(global.gameState),
    cardState: cloneJson(global.cardState)
  };
}

function createSnapshot(stateVersion) {
  return {
    stateVersion,
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
        black: { type: 'TRAP_WILL', stage: 'selectTarget', cardId: 'trap_01' },
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

describe('NetworkMatchClient trap deferred publish', () => {
  const trapPath = path.resolve(__dirname, '..', 'game', 'card-effects', 'trap.js');
  const presentationPath = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');

  let dom;
  let publishBodies;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock(presentationPath, () => ({
      emitPresentationEvent: jest.fn(() => true)
    }), { virtual: false });

    delete require.cache[trapPath];

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

    const initial = createSnapshot(20);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;

    global.addLog = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.renderCardUI = jest.fn();
    global.emitLogAdded = jest.fn();
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
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
        ok: true,
        rawEvents: [{ type: 'trap_selected', applied: true }],
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
      }))
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
          roomId: 'TRP',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 20,
          roomBoardConfig: cloneJson(CUSTOM_BOARD_CONFIG),
          snapshot: createSnapshot(20)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'TRP',
          stateVersion: 21,
          snapshot: body.snapshot
            ? {
              ...body.snapshot,
              stateVersion: 21
            }
            : createLiveResponseSnapshot(21)
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
    delete global.addLog;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.renderCardUI;
    delete global.emitLogAdded;
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

  test('TRAP_WILL selection publishes only the deferred combined snapshot once', async () => {
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

    const selectionFlow = require('../game/card-effects/selection-flow.js');
    selectionFlow.setSignalBridge({
      readMatchMode: () => global.MATCH_MODE,
      isNetworkPublishActive: () => client.isActive(),
      publishSnapshot: (meta) => client.publishSnapshot(meta),
      waitForPlaybackIdle: () => global.waitForPlaybackIdle(),
      getTurnPipelineUIAdapter: () => global.TurnPipelineUIAdapter,
      getGameState: () => global.gameState,
      getCardState: () => global.cardState,
      setGameState: (next) => {
        global.gameState = next;
        return true;
      },
      setCardState: (next) => {
        global.cardState = next;
        return true;
      }
    });

    const { handleTrapSelection } = require('../game/card-effects/trap.js');
    await handleTrapSelection(6, 8, 'black');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual({
      player: 'black',
      row: 6,
      col: 8,
      trapTarget: { row: 6, col: 8 },
      pendingSelectionState: {
        type: 'TRAP_WILL',
        stage: 'selectTarget',
        cardId: 'trap_01'
      }
    });
    expect(publishBodies[0].snapshot).toBeUndefined();
    expect(publishBodies[0].playbackEvents).toBeUndefined();
  });
});
