require('../game/turn-manager');

describe('turn-manager scheduling', () => {
  beforeEach(() => {
    const adapter = require('../game/turn/pipeline_ui_adapter');
    if (adapter && typeof adapter.clearDeferredGeneratedThrowChainPlayback === 'function') {
      adapter.clearDeferredGeneratedThrowChainPlayback();
    }

    // minimal state
    global.timers = null;
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.__uiImpl_turn_manager = {};
    global.BLACK = 1; global.WHITE = -1;
    global.gameState = { currentPlayer: global.BLACK };
    global.cardState = { pendingEffectByPlayer: {} };
    global.getActiveProtectionForPlayer = jest.fn(() => []);
    global.getFlipBlockers = jest.fn(() => []);
    global.findMoveForCell = jest.fn((player, r, c, pending, protection, perma) => ({ row: r, col: c, flips: [] }));
    global.executeMove = jest.fn();
    global.playHandAnimation = (player, row, col, cb) => { global.isCardAnimating = true; cb(); };
  });

  afterEach(() => {
    const adapter = require('../game/turn/pipeline_ui_adapter');
    if (adapter && typeof adapter.clearDeferredGeneratedThrowChainPlayback === 'function') {
      adapter.clearDeferredGeneratedThrowChainPlayback();
    }
    const cpuTurnHandler = require('../game/cpu-turn-handler');
    if (cpuTurnHandler && typeof cpuTurnHandler.resetCpuTurnHandlerState === 'function') {
      cpuTurnHandler.resetCpuTurnHandlerState();
    }
    if (cpuTurnHandler && typeof cpuTurnHandler.setTimers === 'function') {
      cpuTurnHandler.setTimers(null);
    }

    delete global.timers;
    delete global.findMoveForCell;
    delete global.playHandAnimation;
    delete global.executeMove;
    delete global.cpuSmartness;
    delete global.createGameState;
    delete global.initCardState;
    delete global.emitLogAdded;
    delete global.emitBoardUpdate;
    delete global.emitGameStateChange;
    delete global.dealInitialCards;
    delete global.updateCpuCharacter;
    delete global.AnimationEngine;
    delete global.VisualPlaybackActive;
    delete global.__playbackActiveSince;
    delete global.PlaybackStateManager;
    delete global.__uiImpl;
    delete global.__uiImpl_turn_manager;
    delete global.NetworkMatchClient;
    delete global.MATCH_MODE;
    delete global.LOCAL_PLAYER_KEY;
    delete global.__LOCAL_PLAYER_KEY;
    delete global.BOARD_VIEWER_KEY;
    delete global.ActionManager;
    delete global.TurnPipelinePhases;
    delete global.processBombs;
    delete global.processUltimateDestroyGodsAtTurnStart;
    delete global.processUltimateReverseDragonsAtTurnStart;
    delete global.processBreedingEffectsAtTurnStart;
    delete global.processHyperactiveMovesAtTurnStart;
    delete global.isGameOver;
    delete global.handleGuardSelection;
  });

  test('handleCellClick executes move immediately after hand animation callback', async () => {
    // Spy on internal timers module to ensure no settle-delay wait is used
    const timersModule = require('../game/timers');
    const spy = jest.spyOn(timersModule, 'waitMs').mockImplementation(() => Promise.resolve());

    const rm = require('../game/turn-manager');
    rm.handleCellClick(0, 0);
    expect(global.executeMove).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('handleCellClick routes pending GUARDIAN_GOD selection through shared guard dispatch', () => {
    global.cardState = {
      pendingEffectByPlayer: {
        black: { type: 'GUARDIAN_GOD', stage: 'selectTarget' },
        white: null
      }
    };
    global.handleGuardSelection = jest.fn();

    const rm = require('../game/turn-manager');
    rm.handleCellClick(2, 3);

    expect(global.handleGuardSelection).toHaveBeenCalledWith(2, 3, 'black');
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('handleCellClick keeps SELL_CARD_WILL hand overlay pending off the board path', () => {
    global.cardState = {
      pendingEffectByPlayer: {
        black: { type: 'SELL_CARD_WILL', stage: 'selectTarget' },
        white: null
      }
    };

    const rm = require('../game/turn-manager');
    rm.handleCellClick(4, 4);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test.each([
    ['presentationEvents', { presentationEvents: [{ type: 'place' }], _presentationEventsPersist: [] }],
    ['_presentationEventsPersist', { presentationEvents: [], _presentationEventsPersist: [{ type: 'place' }] }]
  ])('queued %s blocks stale board clicks until playback sync finishes', (_label, queues) => {
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: queues.presentationEvents,
      _presentationEventsPersist: queues._presentationEventsPersist
    };

    const rm = require('../game/turn-manager');
    rm.handleCellClick(0, 0);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('stale visual playback flag with idle engine no longer blocks board clicks', () => {
    global.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.AnimationEngine = { isPlaying: false };

    const rm = require('../game/turn-manager');
    rm.handleCellClick(0, 0);

    expect(global.findMoveForCell).toHaveBeenCalled();
    expect(global.executeMove).toHaveBeenCalledTimes(1);
    expect(global.VisualPlaybackActive).toBe(false);
  });

  test('active visual playback still blocks board clicks', () => {
    global.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.AnimationEngine = { isPlaying: true };

    const rm = require('../game/turn-manager');
    rm.handleCellClick(0, 0);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
    expect(global.VisualPlaybackActive).toBe(true);
  });

  test('stale PlaybackStateManager lock with idle engine no longer blocks board clicks', () => {
    let playbackLocked = true;
    const clearPlaybackLock = jest.fn(() => {
      playbackLocked = false;
      global.VisualPlaybackActive = false;
      global.isCardAnimating = false;
    });
    global.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.AnimationEngine = { isPlaying: false };
    global.PlaybackStateManager = {
      getProcessing: jest.fn(() => false),
      getCardAnimating: jest.fn(() => playbackLocked),
      getPlaybackActive: jest.fn(() => playbackLocked),
      getPlaybackStartedAt: jest.fn(() => Date.now() - 4000),
      clearPlaybackLock
    };

    const rm = require('../game/turn-manager');
    rm.handleCellClick(0, 0);

    expect(clearPlaybackLock).toHaveBeenCalledTimes(1);
    expect(global.findMoveForCell).toHaveBeenCalled();
    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('stale PlaybackStateManager lock prefers abortPlayback over clearPlaybackLock', () => {
    let playbackLocked = true;
    const abortPlayback = jest.fn(() => {
      playbackLocked = false;
      global.VisualPlaybackActive = false;
      global.isCardAnimating = false;
      global.__playbackActiveSince = null;
    });
    const clearPlaybackLock = jest.fn();
    global.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.AnimationEngine = { isPlaying: false };
    global.PlaybackStateManager = {
      getProcessing: jest.fn(() => false),
      getCardAnimating: jest.fn(() => playbackLocked),
      getPlaybackActive: jest.fn(() => playbackLocked),
      getPlaybackStartedAt: jest.fn(() => Date.now() - 4000),
      abortPlayback,
      clearPlaybackLock
    };

    const rm = require('../game/turn-manager');
    rm.handleCellClick(0, 0);

    expect(abortPlayback).toHaveBeenCalledTimes(1);
    expect(clearPlaybackLock).not.toHaveBeenCalled();
    expect(global.findMoveForCell).toHaveBeenCalled();
    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('network modeでcurrentPlayerが"white"文字列でも白手番を操作できる', () => {
    global.MATCH_MODE = 'network';
    global.NetworkMatchClient = { getSeatKey: () => 'white' };
    global.LOCAL_PLAYER_KEY = 'white';
    global.__LOCAL_PLAYER_KEY = 'white';
    global.BOARD_VIEWER_KEY = 'white';
    global.gameState = { currentPlayer: 'white' };
    global.cardState = { pendingEffectByPlayer: { white: null } };
    global.findMoveForCell = jest.fn((player, r, c) => ({ player, row: r, col: c, flips: [] }));

    const rm = require('../game/turn-manager');
    rm.handleCellClick(2, 3);

    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('network modeで座席と手番の表記揺れを正規化して白手番を操作できる', () => {
    global.MATCH_MODE = 'network';
    global.NetworkMatchClient = { getSeatKey: () => ' WHITE ' };
    global.LOCAL_PLAYER_KEY = ' WHITE ';
    global.__LOCAL_PLAYER_KEY = ' WHITE ';
    global.BOARD_VIEWER_KEY = ' WHITE ';
    global.gameState = { currentPlayer: ' WHITE ' };
    global.cardState = { pendingEffectByPlayer: { white: null } };
    global.findMoveForCell = jest.fn((player, r, c) => ({ player, row: r, col: c, flips: [] }));

    const rm = require('../game/turn-manager');
    rm.handleCellClick(4, 5);

    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('resetGame は presentation queue をクリアし transient UI reset hook を呼ぶ', () => {
    global.cpuSmartness = { black: 2, white: 3 };
    global.createGameState = jest.fn(() => ({
      currentPlayer: global.BLACK,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    }));
    global.initCardState = jest.fn(() => {});
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.updateCpuCharacter = jest.fn();
    global.dealInitialCards = jest.fn(() => new Promise(() => {}));
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [{ type: 'stale' }],
      _presentationEventsPersist: [{ type: 'stale_persist' }]
    };

    const uiResetSpy = jest.fn();
    const rm = require('../game/turn-manager');
    rm.setUIImpl({
      resetTransientUIState: uiResetSpy,
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();

    expect(global.cardState.presentationEvents).toHaveLength(0);
    expect(global.cardState._presentationEventsPersist).toHaveLength(0);
    expect(uiResetSpy).toHaveBeenCalledTimes(1);
  });

  test('resetGame は stale playback lock を解除してから新規配布へ入る', () => {
    const clearPlaybackLock = jest.fn(() => {
      global.VisualPlaybackActive = false;
      global.__playbackActiveSince = null;
    });
    global.VisualPlaybackActive = true;
    global.__playbackActiveSince = Date.now() - 5000;
    global.PlaybackStateManager = {
      clearPlaybackLock,
      setBusyState: jest.fn(),
      getProcessing: jest.fn(() => false),
      getCardAnimating: jest.fn(() => false),
      getPlaybackActive: jest.fn(() => false),
      setPlaybackStartedAt: jest.fn()
    };
    global.cpuSmartness = { black: 2, white: 3 };
    global.createGameState = jest.fn(() => ({
      currentPlayer: global.BLACK,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    }));
    global.initCardState = jest.fn(() => {});
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.updateCpuCharacter = jest.fn();
    global.dealInitialCards = jest.fn(() => new Promise(() => {}));
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [],
      _presentationEventsPersist: []
    };

    const rm = require('../game/turn-manager');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();

    expect(clearPlaybackLock).toHaveBeenCalledTimes(1);
    expect(global.VisualPlaybackActive).toBe(false);
    expect(global.__playbackActiveSince).toBeNull();
  });

  test('resetGame は PendingCoordinator の action cache もクリアする', () => {
    global.cpuSmartness = { black: 2, white: 3 };
    global.createGameState = jest.fn(() => ({
      currentPlayer: global.BLACK,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    }));
    global.initCardState = jest.fn(() => {});
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.updateCpuCharacter = jest.fn();
    global.dealInitialCards = jest.fn(() => new Promise(() => {}));
    global.cardState = {
      turnIndex: 5,
      pendingEffectByPlayer: {
        black: { type: 'POSITION_SWAP_WILL', stage: 'selectTarget', firstTarget: { row: 1, col: 2 } },
        white: null
      },
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) }),
        reset: jest.fn(),
        clearStorage: jest.fn()
      }
    };

    const PendingCoordinator = require('../game/turn/pending-coordinator');
    PendingCoordinator.createPendingSelectionAction(
      'black',
      'POSITION_SWAP_WILL',
      { firstTarget: { row: 1, col: 2 } },
      { cardState: global.cardState }
    );
    expect(PendingCoordinator.readPendingSelectionAction('black')).toEqual(expect.objectContaining({
      turnIndex: 5
    }));

    const rm = require('../game/turn-manager');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();

    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
  });

  test('古い reset の配布完了は新しい対局へ turn start を混ぜない', async () => {
    let resolveFirstDeal;
    let resolveSecondDeal;
    const firstDeal = new Promise((resolve) => { resolveFirstDeal = resolve; });
    const secondDeal = new Promise((resolve) => { resolveSecondDeal = resolve; });

    global.cpuSmartness = { black: 2, white: 3 };
    global.createGameState = jest.fn(() => ({
      currentPlayer: global.BLACK,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    }));
    global.initCardState = jest.fn(() => {});
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.updateCpuCharacter = jest.fn();
    global.dealInitialCards = jest
      .fn()
      .mockImplementationOnce(() => firstDeal)
      .mockImplementationOnce(() => secondDeal);
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    global.__uiImpl = {
      onTurnStart: jest.fn(() => Promise.resolve())
    };

    const rm = require('../game/turn-manager');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();
    rm.resetGame();
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);

    resolveFirstDeal();
    await new Promise((resolve) => setImmediate(resolve));
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);

    resolveSecondDeal();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(global.__uiImpl.onTurnStart).toHaveBeenCalledTimes(1);
    expect(global.isProcessing).toBe(false);
  });

  test('resetGame は前ゲームの CPU retry latch をクリアして新規対局の再試行を許可する', async () => {
    const cpuTurnHandler = require('../game/cpu-turn-handler');
    const waitMs = jest.fn(() => new Promise(() => {}));
    cpuTurnHandler.setTimers({ waitMs });

    global.isGameOver = jest.fn(() => false);
    global.cpuSmartness = { black: 2, white: 3 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: [],
      _presentationEventsPersist: [],
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      hands: { black: [], white: [] },
      charge: { black: 0, white: 0 }
    };
    global.gameState = {
      currentPlayer: global.WHITE,
      turnNumber: 9,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.isCardAnimating = true;
    global.isProcessing = false;

    await cpuTurnHandler.processCpuTurn();
    expect(waitMs).toHaveBeenCalledTimes(1);

    global.createGameState = jest.fn(() => ({
      currentPlayer: global.WHITE,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    }));
    global.initCardState = jest.fn(() => {});
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.updateCpuCharacter = jest.fn();
    global.dealInitialCards = jest.fn(() => new Promise(() => {}));

    const rm = require('../game/turn-manager');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();
    await cpuTurnHandler.processCpuTurn();

    expect(waitMs).toHaveBeenCalledTimes(2);
  });

  test('resetGame は遅延 generated throw chain hand_add queue をクリアする', () => {
    const adapter = require('../game/turn/pipeline_ui_adapter');
    const queuedBoard = Array.from({ length: 8 }, () => Array(8).fill(0));
    const queuedPipeline = {
      applyTurnSafe: jest.fn(() => ({
        ok: true,
        cardState: { markers: [], turnIndex: 1 },
        gameState: { board: queuedBoard },
        events: [],
        presentationEvents: [
          { type: 'CARD_USED', player: 'black', cardId: 'double_01', meta: { owner: 'black', cost: 24, name: '二連投石' } },
          {
            type: 'HAND_ADD',
            player: 'black',
            cardId: 'triple_01',
            count: 1,
            reason: 'generated_throw_chain',
            meta: { sourceType: 'DOUBLE_PLACE', generatedName: '三連投石' }
          }
        ]
      }))
    };

    const queuedUseResult = adapter.runTurnWithAdapter(
      { markers: [], turnIndex: 1 },
      { board: queuedBoard },
      'black',
      { type: 'use_card', useCardId: 'double_01' },
      queuedPipeline
    );

    expect(queuedUseResult.deferredGeneratedThrowChainHandAdd).toMatchObject({
      playerKey: 'black',
      count: 1,
      reason: 'generated_throw_chain'
    });

    global.cpuSmartness = { black: 2, white: 3 };
    global.createGameState = jest.fn(() => ({
      currentPlayer: global.BLACK,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    }));
    global.initCardState = jest.fn(() => {});
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.updateCpuCharacter = jest.fn();
    global.dealInitialCards = jest.fn(() => new Promise(() => {}));
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [],
      _presentationEventsPersist: []
    };

    const rm = require('../game/turn-manager');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();

    const nextBoard = Array.from({ length: 8 }, () => Array(8).fill(0));
    const nextPipeline = {
      applyTurnSafe: jest.fn(() => ({
        ok: true,
        cardState: { markers: [], turnIndex: 99 },
        gameState: { board: nextBoard },
        events: [{ type: 'place', row: 0, col: 0, player: 'black', turnIndex: 99 }],
        presentationEvents: []
      }))
    };

    const nextPlaceResult = adapter.runTurnWithAdapter(
      { markers: [], turnIndex: 99 },
      { board: nextBoard },
      'black',
      { type: 'place', row: 0, col: 0 },
      nextPipeline
    );

    expect(nextPlaceResult.playbackEvents.map((ev) => ev.type)).toEqual(['place_hand_animation']);
  });

  test('network mode の resetGame は reset_game command publish を送る', async () => {
    const publishSnapshot = jest.fn(() => Promise.resolve({ ok: true }));
    global.MATCH_MODE = 'network';
    global.NetworkMatchClient = {
      isActive: () => true,
      getSeatKey: () => 'white',
      publishSnapshot
    };

    global.cpuSmartness = { black: 2, white: 3 };
    global.createGameState = jest.fn(() => ({
      currentPlayer: global.BLACK,
      turnNumber: 0,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    }));
    global.initCardState = jest.fn(() => {
      global.cardState = {
        pendingEffectByPlayer: { black: null, white: null },
        presentationEvents: [],
        _presentationEventsPersist: [],
        hands: { black: [], white: [] },
        turnCountByPlayer: { black: 0, white: 0 }
      };
    });
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.updateCpuCharacter = jest.fn();
    global.TurnPipelinePhases = { applyTurnStartPhase: jest.fn() };
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [],
      _presentationEventsPersist: []
    };

    const rm = require('../game/turn-manager');
    rm.setUIImpl({
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishSnapshot).toHaveBeenCalledTimes(1);
    expect(publishSnapshot.mock.calls[0][0]).toMatchObject({
      playerKey: 'white',
      actionType: 'reset_game',
      action: {
        type: 'reset_game',
        playerKey: 'white'
      },
      playbackEvents: []
    });
  });
});
