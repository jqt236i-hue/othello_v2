const path = require('path');
const { JSDOM } = require('jsdom');

const PRESENTATION_PATH = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');

const CASES = [
  {
    label: 'TEMPT_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'tempt.js'),
    handlerName: 'handleTemptSelection',
    pendingType: 'TEMPT_WILL',
    rawEventType: 'tempt_selected'
  },
  {
    label: 'GUARD_WILL',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'guard.js'),
    handlerName: 'handleGuardSelection',
    pendingType: 'GUARD_WILL',
    rawEventType: 'guard_selected'
  },
  {
    label: 'GUARDIAN_GOD',
    modulePath: path.resolve(__dirname, '..', 'game', 'card-effects', 'guard.js'),
    handlerName: 'handleGuardSelection',
    pendingType: 'GUARDIAN_GOD',
    rawEventType: 'guard_selected'
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

function createLiveResponseSnapshot(stateVersion) {
  return {
    stateVersion,
    gameState: cloneJson(global.gameState),
    cardState: cloneJson(global.cardState)
  };
}

function createSnapshot(stateVersion, pendingType) {
  return {
    stateVersion,
    gameState: {
      currentPlayer: 1,
      turnNumber: 11
    },
    cardState: {
      selectedCardId: null,
      selectedCardOwnerKey: null,
      hands: { black: [], white: [] },
      charge: { black: 10, white: 10 },
      pendingEffectByPlayer: {
        black: { type: pendingType, stage: 'selectTarget' },
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

describe.each(CASES)('NetworkMatchClient $label deferred publish', ({ modulePath, handlerName, pendingType, rawEventType }) => {
  let dom;
  let publishBodies;
  let runTurnMock;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock(PRESENTATION_PATH, () => ({
      emitPresentationEvent: jest.fn(() => true)
    }), { virtual: false });

    delete require.cache[modulePath];

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

    const initial = createSnapshot(20, pendingType);
    global.gameState = initial.gameState;
    global.cardState = initial.cardState;

    global.LOG_MESSAGES = {
      temptSelectPrompt: jest.fn(() => '相手の石を選んでください'),
      temptApplied: jest.fn(() => '誘惑を適用しました')
    };
    global.posToNotation = jest.fn(() => 'C3');
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
      rawEvents: [{ type: rawEventType, applied: true }],
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
          roomId: 'GTD',
          seatKey: 'black',
          seatToken: 'seat-token',
          stateVersion: 20,
          snapshot: createSnapshot(20, pendingType)
        });
      }

      if (pathName === '/api/match/publish') {
        const body = JSON.parse(init.body || '{}');
        publishBodies.push(body);
        return jsonResponse(200, {
          ok: true,
          roomId: 'GTD',
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
    delete global.LOG_MESSAGES;
    delete global.posToNotation;
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

    const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
    expect(created.ok).toBe(true);

    const handlers = require(modulePath);
    await handlers[handlerName](2, 2, 'black');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const action = runTurnMock.mock.calls[0][3];
    const presentation = require(PRESENTATION_PATH);
    expect(action.deferNetworkPublish).toBe(true);
    const actionParamKey = Object.keys(action).find((key) => (
      key !== 'type'
      && key !== 'player'
      && key !== 'turnIndex'
      && key !== 'deferNetworkPublish'
    ));

    expect(publishBodies).toHaveLength(1);
    expect(publishBodies[0].actionType).toBe('place');
    expect(publishBodies[0].actor).toBe('black');
    expect(publishBodies[0].params).toEqual({
      player: 'black',
      [actionParamKey]: action[actionParamKey]
    });
    expect(publishBodies[0].snapshot).toBeUndefined();
    expect(publishBodies[0].playbackEvents).toBeUndefined();
    expect(global.gameState.turnNumber).toBe(12);
    expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(global.waitForPlaybackIdle).not.toHaveBeenCalled();
    expect(presentation.emitPresentationEvent).not.toHaveBeenCalled();
  });
});
