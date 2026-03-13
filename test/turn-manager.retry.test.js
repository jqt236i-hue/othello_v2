require('../game/turn-manager');

describe('turn-manager scheduling', () => {
  beforeEach(() => {
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
    delete global.__uiImpl_turn_manager;
    delete global.NetworkMatchClient;
    delete global.MATCH_MODE;
    delete global.LOCAL_PLAYER_KEY;
    delete global.__LOCAL_PLAYER_KEY;
    delete global.BOARD_VIEWER_KEY;
    delete global.TurnPipelinePhases;
    delete global.processBombs;
    delete global.processUltimateDestroyGodsAtTurnStart;
    delete global.processUltimateReverseDragonsAtTurnStart;
    delete global.processBreedingEffectsAtTurnStart;
    delete global.processHyperactiveMovesAtTurnStart;
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

  test('network mode の resetGame は reset_game snapshot を publish する', async () => {
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
      playbackEvents: []
    });
  });
});
