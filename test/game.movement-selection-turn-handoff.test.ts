import * as path from 'path';

const MODULE_PATH = path.resolve(__dirname, '..', 'game', 'card-effects', 'strong-wind.js');
const PRESENTATION_PATH = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');

const CASES = [
  {
    label: 'STRONG_WIND_WILL',
    handlerName: 'handleStrongWindSelection',
    pendingType: 'STRONG_WIND_WILL',
    actionField: 'strongWindTarget',
    rawEventType: 'strong_wind_selected'
  },
  {
    label: 'SUPER_BUOYANCY_WILL',
    handlerName: 'handleSuperBuoyancySelection',
    pendingType: 'SUPER_BUOYANCY_WILL',
    actionField: 'superBuoyancyTarget',
    rawEventType: 'super_buoyancy_selected'
  },
  {
    label: 'SUPER_GRAVITY_WILL',
    handlerName: 'handleSuperGravitySelection',
    pendingType: 'SUPER_GRAVITY_WILL',
    actionField: 'superGravityTarget',
    rawEventType: 'super_gravity_selected'
  }
];

describe.each(CASES)('$label selection turn handoff', ({ handlerName, pendingType, actionField, rawEventType }) => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.doMock(PRESENTATION_PATH, () => ({
      emitPresentationEvent: jest.fn(() => true)
    }), { virtual: false });

    delete require.cache[MODULE_PATH];

    global.BLACK = 1;
    global.WHITE = -1;
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: pendingType, stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: global.BLACK,
      turnNumber: 11,
      consecutivePasses: 0
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    global.TurnPipeline = {};
    global.TurnPipelineUIAdapter = {
      runTurnWithAdapter: jest.fn(() => ({
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
      }))
    };
    global.emitLogAdded = jest.fn();
    global.emitCardStateChange = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.ensureCurrentPlayerCanActOrPass = jest.fn();
    global.waitForPlaybackIdle = jest.fn(async () => {});
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;
    global.onTurnStart = jest.fn(async () => ({
      playbackEvents: [{ type: 'draw', phase: 2 }]
    }));
    global.processCpuTurn = jest.fn();
    global.isGameOver = jest.fn(() => false);
    global.NetworkMatchClient = {
      publishSnapshot: jest.fn(),
      isActive: jest.fn(() => true)
    };
    global.MATCH_MODE = 'cpu';
    global.DEBUG_HUMAN_VS_HUMAN = false;
    global.requestAnimationFrame = jest.fn();
    const playbackStateManager = require('../ui/playback-state-manager.js');
    playbackStateManager.clearPlaybackLock();
    global.PlaybackStateManager = playbackStateManager;
    require('../game/card-effects/selection-flow.js').setSignalBridge({
      getPlaybackStateManager: () => playbackStateManager,
      getGameState: () => global.gameState,
      getCardState: () => global.cardState,
      setGameState: (nextGameState) => {
        global.gameState = nextGameState;
        return true;
      },
      setCardState: (nextCardState) => {
        global.cardState = nextCardState;
        return true;
      },
      waitForPlaybackIdle: () => global.waitForPlaybackIdle(),
      scheduleCpuTurn: (delay, callback) => setTimeout(callback, delay),
      processCpuTurn: () => global.processCpuTurn(),
      publishSnapshot: (meta) => global.NetworkMatchClient.publishSnapshot(meta),
      isNetworkPublishActive: () => global.NetworkMatchClient.isActive(),
      ensureCurrentPlayerCanActOrPass: (...args) => global.ensureCurrentPlayerCanActOrPass(...args),
      getTurnPipelineUIAdapter: () => global.TurnPipelineUIAdapter,
      getTurnPipeline: () => global.TurnPipeline,
      getActionManager: () => global.ActionManager
    });
  });

  afterEach(() => {
    jest.useRealTimers();

    delete global.BLACK;
    delete global.WHITE;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.cardState;
    delete global.gameState;
    delete global.ActionManager;
    delete global.TurnPipeline;
    delete global.TurnPipelineUIAdapter;
    delete global.emitLogAdded;
    delete global.emitCardStateChange;
    delete global.emitBoardUpdate;
    delete global.emitGameStateChange;
    delete global.ensureCurrentPlayerCanActOrPass;
    delete global.waitForPlaybackIdle;
    delete global.onTurnStart;
    delete global.processCpuTurn;
    delete global.isGameOver;
    delete global.NetworkMatchClient;
    delete global.MATCH_MODE;
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.requestAnimationFrame;
    delete global.PlaybackStateManager;
    delete globalThis.waitForPlaybackIdle;
  });

  test('waits for playback, publishes continue-turn selection, and checks next available action', async () => {
    const handlers = require('../game/card-effects/strong-wind.js');
    await handlers[handlerName](2, 2, 'black');

    expect(global.TurnPipelineUIAdapter.runTurnWithAdapter).toHaveBeenCalled();
    const action = global.TurnPipelineUIAdapter.runTurnWithAdapter.mock.calls[0][3];
    expect(action[actionField]).toEqual({ row: 2, col: 2 });
    expect(action.deferNetworkPublish).toBe(true);

    expect(global.onTurnStart).not.toHaveBeenCalled();
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledTimes(1);
    expect(global.ensureCurrentPlayerCanActOrPass).toHaveBeenCalledWith({ useBlackDelay: true });

    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);
    const snapshot = global.NetworkMatchClient.publishSnapshot.mock.calls[0][0];
    expect(snapshot).toEqual(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place'
    }));
    expect(snapshot.snapshot).toBeUndefined();
    expect(snapshot.playbackEvents).toEqual([
      expect.objectContaining({ type: 'status_applied', phase: 1 })
    ]);

    jest.runAllTimers();
    expect(global.processCpuTurn).not.toHaveBeenCalled();
  });

  test('keeps busy flags through playback wait before handoff completes', async () => {
    let releasePlayback = null;
    global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
      releasePlayback = resolve;
    }));
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    const handlers = require('../game/card-effects/strong-wind.js');
    const pendingPromise = handlers[handlerName](2, 2, 'black');
    await Promise.resolve();
    await Promise.resolve();

    expect(typeof releasePlayback).toBe('function');
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);
    expect(global.onTurnStart).not.toHaveBeenCalled();

    releasePlayback();
    await pendingPromise;

    expect(global.isCardAnimating).toBe(false);
  });
});
