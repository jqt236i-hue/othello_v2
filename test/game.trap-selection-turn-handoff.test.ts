import * as path from 'path';

describe('TRAP_WILL selection turn handoff', () => {
  const trapPath = path.resolve(__dirname, '..', 'game', 'card-effects', 'trap.js');
  const presentationPath = path.resolve(__dirname, '..', 'game', 'logic', 'presentation.js');

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.doMock(presentationPath, () => ({
      emitPresentationEvent: jest.fn(() => true)
    }), { virtual: false });

    delete require.cache[trapPath];

    global.BLACK = 1;
    global.WHITE = -1;
    global.CPU_TURN_DELAY_MS = 0;
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.cardState = {
      turnIndex: 4,
      pendingEffectByPlayer: {
        black: { type: 'TRAP_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    global.gameState = {
      currentPlayer: global.BLACK,
      turnNumber: 11
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
      getTurnPipelineUIAdapter: () => global.TurnPipelineUIAdapter,
      getTurnPipeline: () => global.TurnPipeline,
      getActionManager: () => global.ActionManager
    });
  });

  afterEach(() => {
    jest.useRealTimers();

    delete global.BLACK;
    delete global.WHITE;
    delete global.CPU_TURN_DELAY_MS;
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

  test('waits for playback, starts next turn, and schedules white CPU after trap selection', async () => {
    const { handleTrapSelection } = require('../game/card-effects/trap.js');
    await handleTrapSelection(2, 2, 'black');

    expect(global.onTurnStart).toHaveBeenCalledWith(global.WHITE);
    expect(global.ensureCurrentPlayerCanActOrPass).not.toHaveBeenCalled();

    expect(global.NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();

    jest.runAllTimers();
    expect(global.processCpuTurn).toHaveBeenCalledTimes(1);
  });

  test('local trap selection without active network publish still completes turn handoff', async () => {
    global.MATCH_MODE = 'cpu';
    global.NetworkMatchClient.isActive = jest.fn(() => false);
    global.processCpuTurn = jest.fn(() => {
      expect(global.isProcessing).toBe(false);
    });

    const { handleTrapSelection } = require('../game/card-effects/trap.js');
    await handleTrapSelection(2, 2, 'black');

    expect(global.onTurnStart).toHaveBeenCalledWith(global.WHITE);
    expect(global.NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(false);

    jest.runAllTimers();
    expect(global.processCpuTurn).toHaveBeenCalledTimes(1);
  });

  test('keeps busy flags but releases settlement lock through playback wait before trap handoff completes', async () => {
    let releasePlayback = null;
    global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
      releasePlayback = resolve;
    }));
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    const { handleTrapSelection } = require('../game/card-effects/trap.js');
    const selectionFlow = require('../game/card-effects/selection-flow.js');
    const pendingPromise = handleTrapSelection(2, 2, 'black');
    await Promise.resolve();
    await Promise.resolve();

    expect(typeof releasePlayback).toBe('function');
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);
    expect(selectionFlow.isSelectionSettlementLocked()).toBe(false);
    expect(global.onTurnStart).not.toHaveBeenCalled();

    await expect(handleTrapSelection(3, 3, 'black')).resolves.toMatchObject({
      ok: false,
      reason: 'busy'
    });
    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(0);

    releasePlayback();
    await pendingPromise;

    expect(global.isCardAnimating).toBe(false);
    expect(selectionFlow.isSelectionSettlementLocked()).toBe(false);
  });
});
