const path = require('path');
const { JSDOM } = require('jsdom');

const MODULE_PATH = path.resolve(__dirname, '..', 'game', 'card-effects', 'sacrifice.js');
const PRESENTATION_PATH = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');

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
    gameState: cloneJson(global.gameState),
    cardState: cloneJson(global.cardState)
  };
}

function createSnapshot(stateVersion) {
  return {
    stateVersion,
    gameState: {
      currentPlayer: 1,
      turnNumber: 9,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    },
    cardState: {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'SACRIFICE_WILL', stage: 'selectTarget', selectedCount: 0, maxSelections: 3 },
        white: null
      },
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      hasUsedCardThisTurnByPlayer: { black: true, white: false },
      lastUsedCardByPlayer: { black: null, white: null },
      markers: [],
      discard: []
    }
  };
}

describe('NetworkMatchClient SACRIFICE_WILL deferred publish', () => {
  let dom;
  let publishBodies;
  let runTurnMock;
  let releasePlayback;

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

    const initial = createSnapshot(30);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;

    global.SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.posToNotation = jest.fn(() => 'D4');
    global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
      releasePlayback = resolve;
    }));
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;
    global.isGameOver = jest.fn(() => false);
    global.processCpuTurn = jest.fn();
    global.requestAnimationFrame = jest.fn((callback) => {
      if (typeof callback === 'function') callback();
      return 1;
    });

    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    runTurnMock = jest.fn(() => ({
      ok: true,
      rawEvents: [{ type: 'sacrifice_selected', applied: true, gained: 5, completed: false }],
      nextCardState: {
        ...global.cardState,
        pendingEffectByPlayer: {
          black: { type: 'SACRIFICE_WILL', stage: 'selectTarget', selectedCount: 1, maxSelections: 3 },
          white: null
        }
      },
      nextGameState: {
        ...global.gameState,
        currentPlayer: global.BLACK,
        turnNumber: 9
      },
      playbackEvents: [{ type: 'hand_remove', phase: 1 }]
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
          roomId: 'SAC',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 30,
          snapshot: createSnapshot(30)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'SAC',
          stateVersion: 31,
          snapshot: body.snapshot
            ? {
              ...body.snapshot,
              stateVersion: 31
            }
            : createLiveResponseSnapshot(31)
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
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.MATCH_MODE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.gameState;
    delete global.cardState;
    delete global.SoundEngine;
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitGameStateChange;
    delete global.emitBoardUpdate;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.posToNotation;
    delete global.waitForPlaybackIdle;
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

  test('selection waits for playback before publishing the updated snapshot', async () => {
    require('../ui/network-client.js');
    const client = window.NetworkMatchClient;
    global.NetworkMatchClient = client;

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const handlers = require('../game/card-effects/sacrifice');
    const pendingPromise = handlers.handleSacrificeSelection(3, 3, 'black');

    await Promise.resolve();
    await Promise.resolve();

    const action = runTurnMock.mock.calls[0][3];
    expect(action.sacrificeTarget).toEqual({ row: 3, col: 3 });
    expect(action.deferNetworkPublish).toBe(true);
    expect(publishBodies).toHaveLength(0);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);

    releasePlayback();
    await pendingPromise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual({
      player: 'black',
      sacrificeTarget: { row: 3, col: 3 }
    });
    expect(publishBodies[0].snapshot).toBeUndefined();
    expect(publishBodies[0].playbackEvents).toBeUndefined();
    expect(global.cardState.pendingEffectByPlayer.black).toEqual({
      type: 'SACRIFICE_WILL',
      stage: 'selectTarget',
      selectedCount: 1,
      maxSelections: 3
    });
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
  });
});