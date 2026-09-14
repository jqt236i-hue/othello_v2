require('../game/turn-manager');

function buildTurnManagerUIBridge() {
  const readPlaybackState = () => global.PlaybackStateManager || null;
  return {
    getRuntimeRoot: () => global,
    readRuntimeValue: (key) => global[key],
    writeRuntimeValue: (key, value) => { global[key] = value; },
    readProcessing: () => {
      const playbackState = readPlaybackState();
      if (playbackState && typeof playbackState.getProcessing === 'function') {
        return playbackState.getProcessing() === true;
      }
      return global.isProcessing === true;
    },
    readCardAnimating: () => {
      const playbackState = readPlaybackState();
      if (playbackState && typeof playbackState.getCardAnimating === 'function') {
        return playbackState.getCardAnimating() === true;
      }
      return global.isCardAnimating === true;
    },
    readPlaybackActive: () => {
      const playbackState = readPlaybackState();
      if (playbackState && typeof playbackState.getPlaybackActive === 'function') {
        return playbackState.getPlaybackActive() === true;
      }
      return global.VisualPlaybackActive === true;
    },
    setBusyState: (config) => {
      const playbackState = readPlaybackState();
      const next = config || {};
      if (playbackState && typeof playbackState.setBusyState === 'function') {
        playbackState.setBusyState(next);
      }
      if (Object.prototype.hasOwnProperty.call(next, 'processing')) global.isProcessing = next.processing === true;
      if (Object.prototype.hasOwnProperty.call(next, 'cardAnimating')) global.isCardAnimating = next.cardAnimating === true;
      if (Object.prototype.hasOwnProperty.call(next, 'playbackActive')) {
        global.VisualPlaybackActive = next.playbackActive === true;
        global.__playbackActiveSince = next.playbackActive === true ? (global.__playbackActiveSince || Date.now()) : null;
      }
    },
    clearPlaybackLock: () => {
      const playbackState = readPlaybackState();
      if (playbackState && typeof playbackState.abortPlayback === 'function') {
        playbackState.abortPlayback();
        return true;
      }
      if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
        playbackState.clearPlaybackLock();
        return true;
      }
      return false;
    },
    readPlaybackStartedAt: () => {
      const playbackState = readPlaybackState();
      if (playbackState && typeof playbackState.getPlaybackStartedAt === 'function') {
        return playbackState.getPlaybackStartedAt();
      }
      return global.__playbackActiveSince;
    },
    readPlaybackRunning: () => {
      if (global.AnimationEngine && typeof global.AnimationEngine.isPlaying === 'boolean') {
        return global.AnimationEngine.isPlaying === true;
      }
      return null;
    },
    shouldAllowSelectionEntryDuringPlayback: (payload) => {
      const playbackState = readPlaybackState();
      return !!(playbackState && typeof playbackState.shouldAllowSelectionEntryDuringPlayback === 'function'
        && playbackState.shouldAllowSelectionEntryDuringPlayback(payload || {}));
    },
    dispatchPendingSelection: (payload) => {
      const handlerNames = {
        destroy: 'handleDestroySelection',
        strong_wind: 'handleStrongWindSelection',
        buoyancy: 'handleBuoyancySelection',
        super_buoyancy: 'handleSuperBuoyancySelection',
        gravity: 'handleGravitySelection',
        super_gravity: 'handleSuperGravitySelection',
        super_attraction: 'handleSuperAttractionSelection',
        teleport: 'handleTeleportSelection',
        cell_teleport: 'handleTeleportSelection',
        tempt: 'handleTemptSelection',
        capture: 'handleCaptureSelection',
        trap: 'handleTrapSelection',
        guard: 'handleGuardSelection',
        living_will: 'handleLivingWillSelection',
        extend_life: 'handleExtendLifeSelection',
        corrosion: 'handleCorrosionSelection',
        clone: 'handleCloneSelection',
        blockade: 'handleBlockadeSelection',
        board_expansion: 'handleBoardExpansionSelection',
        board_shrink: 'handleBoardShrinkSelection',
        freeze: 'handleFreezeSelection',
        seed: 'handleSeedSelection',
        position_swap: 'handlePositionSwapSelection',
        meteor: 'handleMeteorSelection',
        time_bomb: 'handleTimeBombSelection',
        swap_with_enemy: 'handleSwapSelection'
      };
      const handlerName = handlerNames[String(payload && payload.dispatchKey || '')];
      const handler = handlerName ? global[handlerName] : null;
      if (typeof handler !== 'function') return false;
      handler(payload.row, payload.col, payload.playerKey);
      return true;
    }
  };
}

function buildCpuTurnHandlerUIBridge() {
  return {
    readProcessing: () => global.isProcessing === true,
    readAnimationBusy: () => global.isCardAnimating === true || global.VisualPlaybackActive === true,
    resolveRuntimeFunction: (name) => {
      const candidate = global[name];
      return typeof candidate === 'function' ? candidate : null;
    },
    resolveRuntimeValue: (name) => (
      Object.prototype.hasOwnProperty.call(global, name)
        ? global[name]
        : undefined
    ),
    readBenchFastMode: () => global.__BENCH_FAST_MODE === true,
    readMatchMode: () => global.MATCH_MODE || null,
    readHumanVsHumanMode: () => global.DEBUG_HUMAN_VS_HUMAN === true,
    readQuerySearch: () => '',
    getCpuCardLogic: () => global.CardLogic || null
  };
}

describe('turn-manager scheduling', () => {
  beforeEach(() => {
    const adapter = require('../game/turn/pipeline_ui_adapter.js');
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
    const turnManager = require('../game/turn-manager.js');
    if (turnManager && typeof turnManager.setUIImpl === 'function') {
      turnManager.setUIImpl(buildTurnManagerUIBridge());
    }
    const cpuTurnHandler = require('../game/cpu-turn-handler.js');
    if (cpuTurnHandler && typeof cpuTurnHandler.setCpuUIImpl === 'function') {
      cpuTurnHandler.setCpuUIImpl(buildCpuTurnHandlerUIBridge());
    }
  });

  afterEach(() => {
    const adapter = require('../game/turn/pipeline_ui_adapter.js');
    if (adapter && typeof adapter.clearDeferredGeneratedThrowChainPlayback === 'function') {
      adapter.clearDeferredGeneratedThrowChainPlayback();
    }
    const cpuTurnHandler = require('../game/cpu-turn-handler.js');
    if (cpuTurnHandler && typeof cpuTurnHandler.resetCpuTurnHandlerState === 'function') {
      cpuTurnHandler.resetCpuTurnHandlerState();
    }
    if (cpuTurnHandler && typeof cpuTurnHandler.setTimers === 'function') {
      cpuTurnHandler.setTimers(null);
    }
    if (cpuTurnHandler && typeof cpuTurnHandler.setCpuUIImpl === 'function') {
      cpuTurnHandler.setCpuUIImpl({});
    }
    const turnManager = require('../game/turn-manager.js');
    if (turnManager && typeof turnManager.replaceUIImpl === 'function') {
      turnManager.replaceUIImpl({});
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
    delete global.getGamePrng;
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
    delete global.DEBUG_HUMAN_VS_HUMAN;
    delete global.DEBUG_UNLIMITED_USAGE;
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
    delete global.handleTeleportSelection;
    delete global.handleSeedSelection;
    delete global.showResult;
  });

  test('handleCellClick executes move immediately and leaves hand animation to pipeline playback', async () => {
    // Spy on internal timers module to ensure no settle-delay wait is used
    const timersModule = require('../game/timers.js');
    const spy = jest.spyOn(timersModule, 'waitMs').mockImplementation(() => Promise.resolve());

    global.cardState.presentationEvents = [];
    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(0, 0);
    expect(global.executeMove).toHaveBeenCalled();
    expect(global.cardState.presentationEvents).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('handleCellClick clears legal move hints before executing an accepted move', () => {
    const clearLegalMoveHints = jest.fn();
    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      ...buildTurnManagerUIBridge(),
      clearLegalMoveHints
    });

    rm.handleCellClick(0, 0);

    expect(clearLegalMoveHints).toHaveBeenCalledTimes(1);
    expect(global.executeMove).toHaveBeenCalledTimes(1);
    expect(clearLegalMoveHints.mock.invocationCallOrder[0])
      .toBeLessThan(global.executeMove.mock.invocationCallOrder[0]);
  });

  test('handleCellClick keeps legal move hints when the clicked cell is not legal', () => {
    const clearLegalMoveHints = jest.fn();
    global.findMoveForCell = jest.fn(() => null);
    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      ...buildTurnManagerUIBridge(),
      clearLegalMoveHints
    });

    rm.handleCellClick(0, 0);

    expect(clearLegalMoveHints).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('network mode skips local place-hand animation and executes move immediately', () => {
    global.MATCH_MODE = 'network';
    global.NetworkMatchClient = { getSeatKey: () => 'black' };
    global.LOCAL_PLAYER_KEY = 'black';
    global.__LOCAL_PLAYER_KEY = 'black';
    global.BOARD_VIEWER_KEY = 'black';
    global.emitPresentationEventViaBoardOps = jest.fn();
    global.playHandAnimation = jest.fn();

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(0, 0);

    expect(global.executeMove).toHaveBeenCalledTimes(1);
    expect(global.playHandAnimation).not.toHaveBeenCalled();
    expect(global.emitPresentationEventViaBoardOps).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PLAY_HAND_ANIMATION' })
    );
  });

  test('network spectator board click is read-only even when local player keys still point to black', () => {
    global.MATCH_MODE = 'network';
    global.NetworkMatchClient = {
      getSeatKey: jest.fn(() => null),
      isSpectator: jest.fn(() => true)
    };
    global.LOCAL_PLAYER_KEY = 'black';
    global.__LOCAL_PLAYER_KEY = 'black';
    global.BOARD_VIEWER_KEY = 'black';

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      ...buildTurnManagerUIBridge(),
      isNetworkSpectator: () => true
    });
    rm.handleCellClick(0, 0);

    expect(global.NetworkMatchClient.getSeatKey).not.toHaveBeenCalled();
    expect(global.NetworkMatchClient.isSpectator).not.toHaveBeenCalled();
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('handleCellClick routes pending GUARDIAN_GOD selection through shared guard dispatch', () => {
    global.cardState = {
      pendingEffectByPlayer: {
        black: { type: 'GUARDIAN_GOD', stage: 'selectTarget' },
        white: null
      }
    };
    global.handleGuardSelection = jest.fn();

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(2, 3);

    expect(global.handleGuardSelection).toHaveBeenCalledWith(2, 3, 'black');
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('handleCellClick resolves TRAP_WILL selection even when no global handler is registered', () => {
    jest.resetModules();
    const trapPath = require.resolve('../game/card-effects/trap');
    const handleTrapSelection = jest.fn();
    jest.doMock(trapPath, () => ({ handleTrapSelection }), { virtual: false });

    global.cardState = {
      pendingEffectByPlayer: {
        black: { type: 'TRAP_WILL', stage: 'selectTarget' },
        white: null
      }
    };
    delete global.handleTrapSelection;

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl(buildTurnManagerUIBridge());
    rm.handleCellClick(2, 3);

    expect(handleTrapSelection).toHaveBeenCalledWith(2, 3, 'black');
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test.each([
    ['CELL_TELEPORT_WILL', 'cell_teleport_01', 'handleTeleportSelection'],
    ['SEED_WILL', 'seed_01', 'handleSeedSelection']
  ])('handleCellClick reads latest runtime pending for %s after card-use state replacement', (_type, cardId, handlerName) => {
    const staleCardState = {
      pendingEffectByPlayer: {
        black: null,
        white: null
      }
    };
    const latestCardState = {
      pendingEffectByPlayer: {
        black: { type: _type, stage: 'selectTarget', cardId },
        white: null
      }
    };

    global.cardState = staleCardState;
    global[handlerName] = jest.fn();

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      getRuntimeRoot: () => global,
      readRuntimeValue: (key) => {
        if (key === 'cardState') return latestCardState;
        return global[key];
      },
      writeRuntimeValue: (key, value) => { global[key] = value; }
    });

    rm.handleCellClick(2, 3);

    expect(global[handlerName]).toHaveBeenCalledWith(2, 3, 'black');
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('handleCellClick allows pending board selection during card-use animation handoff', () => {
    const playbackStateManager = require('../ui/playback-state-manager.js');
    playbackStateManager.clearPlaybackLock();
    playbackStateManager.armSelectionEntryPlaybackContext({
      playerKey: 'black',
      pendingType: 'GUARDIAN_GOD',
      source: 'test',
      reason: 'selection_entry',
      expiresAt: Date.now() + 1000
    });
    global.PlaybackStateManager = playbackStateManager;
    global.isCardAnimating = true;
    global.cardState = {
      pendingEffectByPlayer: {
        black: { type: 'GUARDIAN_GOD', stage: 'selectTarget' },
        white: null
      }
    };
    global.handleGuardSelection = jest.fn();

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(2, 3);

    expect(global.handleGuardSelection).toHaveBeenCalledWith(2, 3, 'black');
    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test('handleCellClick keeps hand overlay pending off the board path', () => {
    global.cardState = {
      pendingEffectByPlayer: {
        black: { type: 'HEAVEN_BLESSING', stage: 'selectTarget', offers: ['offer_1'] },
        white: null
      }
    };

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(4, 4);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test.each([
    ['presentationEvents', { presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }], _presentationEventsPersist: [] }],
    ['_presentationEventsPersist', { presentationEvents: [], _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'flip', phase: 1 }] }] }]
  ])('queued %s playback batches block stale board clicks until playback sync finishes', (_label, queues) => {
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: queues.presentationEvents,
      _presentationEventsPersist: queues._presentationEventsPersist
    };

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(0, 0);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
  });

  test.each([
    ['presentationEvents', { presentationEvents: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'hand_remove', phase: 1 }, { type: 'sound_effect', phase: 1 }] }], _presentationEventsPersist: [] }],
    ['_presentationEventsPersist', { presentationEvents: [], _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS', events: [{ type: 'hand_add', phase: 1 }] }] }]
  ])('queued %s hand-only playback does not block board clicks', (_label, queues) => {
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: queues.presentationEvents,
      _presentationEventsPersist: queues._presentationEventsPersist
    };

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(0, 0);

    expect(global.findMoveForCell).toHaveBeenCalled();
    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['presentationEvents', { presentationEvents: [{ type: 'CARD_USED', player: 'black', cardId: 'capture_01' }], _presentationEventsPersist: [] }],
    ['_presentationEventsPersist', { presentationEvents: [], _presentationEventsPersist: [{ type: 'HAND_REMOVE', player: 'black', cardId: 'capture_01' }] }]
  ])('queued %s non-playback presentation does not block board clicks', (_label, queues) => {
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: queues.presentationEvents,
      _presentationEventsPersist: queues._presentationEventsPersist
    };

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(0, 0);

    expect(global.findMoveForCell).toHaveBeenCalled();
    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('stale visual playback flag with idle engine no longer blocks board clicks', () => {
    global.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.AnimationEngine = { isPlaying: false };

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(0, 0);

    expect(global.findMoveForCell).toHaveBeenCalled();
    expect(global.executeMove).toHaveBeenCalledTimes(1);
    expect(global.VisualPlaybackActive).toBe(false);
  });

  test('active visual playback still blocks board clicks', () => {
    global.VisualPlaybackActive = true;
    global.isCardAnimating = true;
    global.AnimationEngine = { isPlaying: true };

    const rm = require('../game/turn-manager.js');
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

    const rm = require('../game/turn-manager.js');
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

    const rm = require('../game/turn-manager.js');
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

    const rm = require('../game/turn-manager.js');
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

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(4, 5);

    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('network mode では stale な HvH flag が残っても相手手番を操作できない', () => {
    global.MATCH_MODE = 'network';
    global.DEBUG_HUMAN_VS_HUMAN = true;
    global.NetworkMatchClient = { getSeatKey: () => 'black' };
    global.LOCAL_PLAYER_KEY = 'black';
    global.__LOCAL_PLAYER_KEY = 'black';
    global.BOARD_VIEWER_KEY = 'black';
    global.gameState = { currentPlayer: 'white' };
    global.cardState = { pendingEffectByPlayer: { white: null } };
    global.findMoveForCell = jest.fn((player, r, c) => ({ player, row: r, col: c, flips: [] }));

    const rm = require('../game/turn-manager.js');
    rm.handleCellClick(2, 3);

    expect(global.findMoveForCell).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
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
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      resetTransientUIState: uiResetSpy,
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    try {
      rm.resetGame();

      expect(global.cardState.presentationEvents).toHaveLength(0);
      expect(global.cardState._presentationEventsPersist).toHaveLength(0);
      expect(uiResetSpy).toHaveBeenCalledTimes(1);
      expect(consoleLog).not.toHaveBeenCalled();
    } finally {
      consoleLog.mockRestore();
    }
  });

  test('resetGame は initialBoardSetup で盤面と手番を初期化する', () => {
    global.cpuSmartness = { black: 2, white: 3 };
    global.createGameState = jest.fn(() => ({
      currentPlayer: global.BLACK,
      turnNumber: 0,
      consecutivePasses: 1,
      pendingRoundBonus: { player: 'black', amount: 1 },
      roundCompletionByPlayer: { black: true, white: true },
      board: Array.from({ length: 6 }, () => Array(6).fill(0))
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

    const initialBoard = Array.from({ length: 6 }, () => Array(6).fill(0));
    initialBoard[0][0] = 1;
    initialBoard[0][1] = -1;
    initialBoard[5][5] = 1;

    const rm = require('../game/turn-manager.js');
    rm.replaceUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn(),
      buildCardInitOptions: () => ({
        boardConfig: { rows: 6, cols: 6 },
        initialBoardSetup: {
          currentPlayer: 'white',
          board: initialBoard
        }
      })
    });

    rm.resetGame();

    expect(global.createGameState).toHaveBeenCalledWith({ rows: 6, cols: 6 });
    expect(global.gameState.board).toEqual(initialBoard);
    expect(global.gameState.currentPlayer).toBe(global.WHITE);
    expect(global.gameState.consecutivePasses).toBe(0);
    expect(global.gameState.pendingRoundBonus).toBeNull();
    expect(global.gameState.roundCompletionByPlayer).toEqual({ black: false, white: false });
    expect(global.initCardState).toHaveBeenCalledWith(undefined, expect.objectContaining({
      initialBoardSetup: expect.any(Object)
    }));
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

    const rm = require('../game/turn-manager.js');
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

    const PendingCoordinator = require('../game/turn/pending-coordinator.js');
    PendingCoordinator.createPendingSelectionAction(
      'black',
      'POSITION_SWAP_WILL',
      { firstTarget: { row: 1, col: 2 } },
      { cardState: global.cardState }
    );
    expect(PendingCoordinator.readPendingSelectionAction('black')).toEqual(expect.objectContaining({
      turnIndex: 5
    }));

    const rm = require('../game/turn-manager.js');
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
    const onTurnStartSpy = jest.fn(() => Promise.resolve());

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn(),
      onTurnStart: onTurnStartSpy
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
    expect(onTurnStartSpy).toHaveBeenCalledTimes(1);
    expect(global.isProcessing).toBe(false);
  });

  test('cancelPendingResetGame は未完了 reset の turn start を混ぜない', async () => {
    let resolveDeal;
    const deal = new Promise((resolve) => { resolveDeal = resolve; });

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
    global.dealInitialCards = jest.fn(() => deal);
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    const onTurnStartSpy = jest.fn(() => Promise.resolve());

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn(),
      onTurnStart: onTurnStartSpy
    });

    rm.resetGame();
    expect(global.isProcessing).toBe(true);
    expect(global.isCardAnimating).toBe(true);

    rm.cancelPendingResetGame('network_snapshot:stream');
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);

    resolveDeal();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(onTurnStartSpy).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(false);
    expect(global.isCardAnimating).toBe(false);
  });

  test('resetGame は前ゲームの CPU retry latch をクリアして新規対局の再試行を許可する', async () => {
    const cpuTurnHandler = require('../game/cpu-turn-handler.js');
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

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      resetTransientUIState: jest.fn(),
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      clearLogUI: jest.fn()
    });

    rm.resetGame();
    await cpuTurnHandler.processCpuTurn();

    expect(waitMs).toHaveBeenCalledTimes(2);
  });

  test('CPU turn leaves place-hand animation to pipeline playback', async () => {
    const cpuTurnHandler = require('../game/cpu-turn-handler.js');

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
    global.generateMovesForPlayer = jest.fn(() => [{ row: 2, col: 3, flips: [] }]);
    global.executeMove = jest.fn();
    cpuTurnHandler.setCpuUIImpl({
      resolveRuntimeFunction: (name) => global[name],
      resolveRuntimeValue: (name) => global[name],
      resolveExecuteMove: () => global.executeMove
    });

    await cpuTurnHandler.runCpuTurn('white');

    expect(global.executeMove).toHaveBeenCalledWith(expect.objectContaining({ row: 2, col: 3 }));
    expect(global.cardState.presentationEvents).toEqual([]);
  });

  test.each([2971938113, 914001])('onTurnStart preserves the seeded 40-cell bonus map when presentation storage is lazy (%s)', async (seed) => {
    const Cards = require('../game/logic/cards');
    const Core = require('../game/logic/core');
    const Prng = require('../game/schema/prng');
    const rng = Prng.createPRNG(seed);
    global.gameState = Core.createGameState();
    global.cardState = Cards.createCardState(rng);
    global.getGamePrng = () => rng;
    const bonuses = { ...global.cardState.boardBonusByCell };
    expect(Object.keys(bonuses)).toHaveLength(40);
    expect(global.cardState._presentationEventsPersist).toBeUndefined();
    const rm = require('../game/turn-manager');
    await rm.onTurnStart(global.BLACK);
    expect(global.cardState.boardBonusByCell).toEqual(bonuses);
    expect(Object.keys(global.cardState.boardBonusByCell)).toHaveLength(40);
    expect(global.cardState.prngState).toEqual(rng.getState());
  });

  test('onTurnStart shows terminal result through injected UI bridge', async () => {
    global.MATCH_MODE = 'reversi';
    global.showResult = jest.fn();
    global.gameState = {
      currentPlayer: global.BLACK,
      turnNumber: 9,
      consecutivePasses: 2,
      board: Array.from({ length: 8 }, () => Array(8).fill(global.BLACK))
    };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: [],
      _presentationEventsPersist: [],
      hands: { black: [], white: [] },
      turnCountByPlayer: { black: 0, white: 0 },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      extraPlaceRemainingByPlayer: { black: 0, white: 0 },
      infinitePlaceActiveByPlayer: { black: false, white: false },
      multiPlaceSourceTypeByPlayer: { black: null, white: null }
    };

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      getRuntimeRoot: () => global,
      readRuntimeValue: (key) => global[key],
      writeRuntimeValue: (key, value) => { global[key] = value; },
      showResult: () => global.showResult()
    });

    await rm.onTurnStart(global.BLACK);

    expect(global.showResult).toHaveBeenCalledTimes(1);
  });

  test('onTurnStart restores deterministic PRNG from cardState.prngState for gluttonous salvation revive', async () => {
    const CardLogic = require('../game/logic/cards.js');
    const SeededPRNG = require('../game/schema/prng.js');
    const prng = SeededPRNG.createPRNG(123);
    const cardState = CardLogic.createCardState(prng, {});
    delete cardState._defaultRandomSource;
    cardState.prngState = prng.getState();
    cardState.deck = [];
    cardState.discard = [];
    cardState.hands.black = [];
    cardState.hands.white = [];
    cardState.presentationEvents = [];
    cardState._presentationEventsPersist = [];

    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[0][0] = global.BLACK;
    board[3][3] = global.WHITE;
    board[3][4] = global.BLACK;
    cardState.markers.push(
      { id: 1, kind: 'specialStone', row: 0, col: 0, owner: 'black', data: { type: 'STONE_SALVATION_GOD', remainingOwnerTurns: 12 } },
      { id: 2, kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'GLUTTONOUS', gluttonousMissStreak: 0 } }
    );
    global.cardState = cardState;
    global.gameState = {
      currentPlayer: global.WHITE,
      turnNumber: 11,
      consecutivePasses: 0,
      board
    };
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    global.getGamePrng = undefined;

    const rm = require('../game/turn-manager.js');

    await rm.onTurnStart(global.WHITE);

    const blackCells = global.gameState.board.flat().filter((cell) => cell === global.BLACK);
    expect(global.gameState.board[3][4]).toBe(global.WHITE);
    expect(blackCells).toHaveLength(2);
    expect(global.cardState.pendingStoneSalvationGodRevivesByPlayer.black).toEqual([]);
    expect(global.cardState.prngState).toEqual(expect.objectContaining({ seed: 123, calls: expect.any(Number) }));
    expect(global.cardState.prngState.calls).toBeGreaterThan(prng.getState().calls);
  });

  test('onTurnStart keeps 理論の化身 owner able to act without auto turn end', async () => {
    const CardLogic = require('../game/logic/cards.js');
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[0][0] = 0;
    board[3][3] = global.WHITE;
    board[3][4] = global.BLACK;
    board[4][3] = global.BLACK;
    board[4][4] = global.WHITE;

    const cardState = CardLogic.createCardState({ random: () => 0, shuffle: (arr) => arr }, { plainReversi: true });
    cardState.deck = [];
    cardState.discard = [];
    cardState.hands.black = [];
    cardState.hands.white = [];
    cardState.boardBonusByCell = { '0,0': 5 };
    cardState.theoryNumberCellByCell = {
      '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' }
    };
    cardState.theoryNumberCellsBySession = {
      theory_black_1: {
        ownerKey: 'black',
        cells: {
          '0,0': {
            row: 0,
            col: 0,
            value: 5,
            originalValue: 0,
            originalConsumed: false,
            spawnType: 'GHOST',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL',
            sourceCardCost: 5,
            markerData: {
              type: 'GHOST',
              remainingOwnerTurns: 8,
              sourceType: 'THEORY_INCARNATION',
              sourceCardId: 'ghost_01',
              sourceCardType: 'GHOST_WILL'
            }
          }
        }
      }
    };
    cardState.theoryIncarnationStateByPlayer = {
      black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 1 },
      white: null
    };
    CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
      type: 'THEORY_INCARNATION',
      remainingOwnerTurns: 1,
      inviolable: true,
      sourceType: 'THEORY_INCARNATION',
      sessionId: 'theory_black_1'
    });

    global.cardState = cardState;
    global.gameState = {
      currentPlayer: global.BLACK,
      turnNumber: 11,
      consecutivePasses: 1,
      board
    };
    global.DEBUG_HUMAN_VS_HUMAN = true;
    global.processPassTurn = jest.fn();
    global.emitLogAdded = jest.fn();
    global.emitBoardUpdate = jest.fn();
    global.emitGameStateChange = jest.fn();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      const rm = require('../game/turn-manager.js');
      const result = await rm.onTurnStart(global.BLACK);

      expect(result.stopAction).toBe(false);
      expect(global.processPassTurn).not.toHaveBeenCalled();
      expect(consoleLogSpy.mock.calls.some((args) => args.join(' ').includes('== 黒のターン'))).toBe(true);
      expect(global.gameState.currentPlayer).toBe(global.BLACK);
      expect(global.gameState.consecutivePasses).toBe(1);
      expect(global.gameState.board[0][0]).toBe(0);
      expect(global.cardState.theoryIncarnationStateByPlayer.black.remainingSpawnCount).toBe(1);
      expect(global.cardState.markers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          col: 2,
          owner: 'black',
          data: expect.objectContaining({ type: 'THEORY_INCARNATION', remainingOwnerTurns: 1 })
        })
      ]));
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  test('resetGame は遅延 generated throw chain hand_add queue をクリアする', () => {
    const adapter = require('../game/turn/pipeline_ui_adapter.js');
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

    const rm = require('../game/turn-manager.js');
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

  test('pipeline adapter restores deterministic PRNG from cardState.prngState without runtime bridge', () => {
    const adapter = require('../game/turn/pipeline_ui_adapter.js');
    const SeededPRNG = require('../game/schema/prng.js');
    const prng = SeededPRNG.createPRNG(77);
    const cardState = {
      prngState: prng.getState(),
      turnIndex: 0,
      presentationEvents: [],
      _presentationEventsPersist: []
    };
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    let receivedPrng = null;
    const pipeline = {
      applyTurnSafe: jest.fn((cs, gs, playerKey, action, runtimePrng) => {
        receivedPrng = runtimePrng;
        runtimePrng.random();
        return {
          ok: true,
          cardState: cs,
          gameState: gs,
          events: [],
          presentationEvents: []
        };
      })
    };
    adapter.setPipelineUIAdapterRuntime({});

    adapter.runTurnWithAdapter(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 0, col: 0 },
      pipeline
    );

    expect(receivedPrng).toEqual(expect.objectContaining({ random: expect.any(Function) }));
    expect(receivedPrng.getState()).toEqual(expect.objectContaining({ seed: 77, calls: prng.getState().calls + 1 }));
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

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      readNetworkSeatKey: () => global.NetworkMatchClient.getSeatKey(),
      publishNetworkSnapshot: (meta) => global.NetworkMatchClient.publishSnapshot(meta),
      isNetworkPublishActive: () => global.NetworkMatchClient.isActive(),
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

  test('network mode の boot resetGame は skipNetworkPublish 指定で reset_game command publish を送らない', async () => {
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

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      readNetworkSeatKey: () => global.NetworkMatchClient.getSeatKey(),
      publishNetworkSnapshot: (meta) => global.NetworkMatchClient.publishSnapshot(meta),
      isNetworkPublishActive: () => global.NetworkMatchClient.isActive(),
      clearLogUI: jest.fn()
    });

    rm.resetGame({ skipNetworkPublish: true, source: 'bootstrap_init' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishSnapshot).not.toHaveBeenCalled();
  });

  test('起動時 resetGame が後から network active になっても stale reset_game publish を送らない', async () => {
    const publishSnapshot = jest.fn(() => Promise.resolve({ ok: true }));
    let networkActive = false;
    let dealResolve;
    global.MATCH_MODE = 'cpu';
    global.NetworkMatchClient = {
      isActive: () => networkActive,
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
    global.dealInitialCards = jest.fn(() => new Promise((resolve) => {
      dealResolve = resolve;
    }));
    global.cardState = {
      pendingEffectByPlayer: {},
      presentationEvents: [],
      _presentationEventsPersist: []
    };

    const rm = require('../game/turn-manager.js');
    rm.setUIImpl({
      readCpuSmartness: () => ({ black: 2, white: 3 }),
      readNetworkSeatKey: () => global.NetworkMatchClient.getSeatKey(),
      publishNetworkSnapshot: (meta) => global.NetworkMatchClient.publishSnapshot(meta),
      isNetworkPublishActive: () => global.NetworkMatchClient.isActive(),
      clearLogUI: jest.fn()
    });

    rm.resetGame();

    global.MATCH_MODE = 'network';
    networkActive = true;
    dealResolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(publishSnapshot).not.toHaveBeenCalled();
  });
});
