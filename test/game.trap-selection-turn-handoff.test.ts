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

    expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);
    const snapshot = global.NetworkMatchClient.publishSnapshot.mock.calls[0][0];
    expect(snapshot).toEqual(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place'
    }));
    expect(snapshot.snapshot).toBeUndefined();
    expect(snapshot.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'status_applied', phase: 1 }),
      expect.objectContaining({ type: 'draw', phase: 2 })
    ]));

    jest.runAllTimers();
    expect(global.processCpuTurn).toHaveBeenCalledTimes(1);
  });

  test('keeps busy flags through playback wait before trap handoff completes', async () => {
    let releasePlayback = null;
    global.waitForPlaybackIdle = jest.fn(() => new Promise((resolve) => {
      releasePlayback = resolve;
    }));
    globalThis.waitForPlaybackIdle = global.waitForPlaybackIdle;

    const { handleTrapSelection } = require('../game/card-effects/trap.js');
    const pendingPromise = handleTrapSelection(2, 2, 'black');
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
