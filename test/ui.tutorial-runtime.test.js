const { JSDOM } = require('jsdom');
const TutorialRuntimeModule = require('../ui/tutorial/tutorial-runtime');

function createEmptyBoard() {
  return Array(8).fill(null).map(() => Array(8).fill(0));
}

function createStandardBoard() {
  const board = createEmptyBoard();
  board[3][3] = -1;
  board[3][4] = 1;
  board[4][3] = 1;
  board[4][4] = -1;
  return board;
}

describe('tutorial runtime staged setup', () => {
  test('prepareNumericDemo resets to a standard learning board and sets a legal numeric target', async () => {
    const dom = new JSDOM('<div id="board"></div>');
    const weirdBoard = createEmptyBoard();
    weirdBoard[0][1] = -1;
    weirdBoard[0][2] = 1;

    const root = {
      BLACK: 1,
      WHITE: -1,
      document: dom.window.document,
      gameState: {
        board: weirdBoard,
        currentPlayer: -1,
        consecutivePasses: 2,
        turnNumber: 7,
        boardExpansion: { enabled: true }
      },
      cardState: {
        hands: { black: ['observer_01'], white: [] },
        boardBonusByCell: { '0,0': 9 },
        boardBonusConsumedByCell: { '0,0': true },
        turnIndex: 7,
        pendingEffectByPlayer: {
          black: { type: 'TEST_PENDING' },
          white: { type: 'TEST_PENDING' }
        },
        hasUsedCardThisTurnByPlayer: { black: true, white: true },
        hasDestroyedCardThisTurnByPlayer: { black: true, white: true },
        selectedCardId: 'observer_01',
        selectedCardOwnerKey: 'black',
        presentationEvents: [{ type: 'PLAYBACK_EVENTS' }],
        _presentationEventsPersist: [{ type: 'PLAYBACK_EVENTS' }],
        markers: [],
        expansionStoneIdByCell: {},
        charge: { black: 0, white: 0 },
        lastUsedCardByPlayer: { black: 'observer_01', white: 'other_card' }
      },
      createGameState: () => ({
        board: createStandardBoard(),
        currentPlayer: 1,
        consecutivePasses: 0,
        turnNumber: 0,
        boardExpansion: null
      }),
      CoreLogic: {
        getLegalMoves: (gameState, playerValue) => {
          if (playerValue !== 1) return [];
          const isStandardOpening =
            gameState.board[3][3] === -1 &&
            gameState.board[3][4] === 1 &&
            gameState.board[4][3] === 1 &&
            gameState.board[4][4] === -1;
          return isStandardOpening
            ? [{ row: 2, col: 3 }, { row: 3, col: 2 }, { row: 4, col: 5 }, { row: 5, col: 4 }]
            : [{ row: 0, col: 0 }];
        }
      },
      emitCardStateChange: jest.fn(),
      emitBoardUpdate: jest.fn(),
      emitGameStateChange: jest.fn(),
      renderCardUI: jest.fn(),
      updateCardDetailPanel: jest.fn(),
      updateStatus: jest.fn(),
      forceFullRender: jest.fn(),
      ActionManager: {
        ActionManager: {
          reset: jest.fn()
        }
      }
    };

    const flags = {};
    const runtime = TutorialRuntimeModule.createTutorialRuntime({ root });
    const target = await runtime.prepareNumericDemo({
      setFlag: (key, value) => {
        flags[key] = value;
      }
    });

    expect(target).toEqual({ row: 2, col: 3 });
    expect(root.gameState.board).toEqual(createStandardBoard());
    expect(root.gameState.currentPlayer).toBe(1);
    expect(root.gameState.consecutivePasses).toBe(0);
    expect(root.gameState.turnNumber).toBe(0);
    expect(root.gameState.boardExpansion).toBeNull();
    expect(root.cardState.boardBonusByCell).toEqual({ '2,3': 2 });
    expect(root.cardState.boardBonusConsumedByCell).toEqual({});
    expect(root.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(root.cardState.pendingEffectByPlayer.white).toBeNull();
    expect(root.cardState.turnIndex).toBe(0);
    expect(root.cardState.selectedCardId).toBeNull();
    expect(root.cardState.lastUsedCardByPlayer).toEqual({ black: null, white: null });
    expect(root.cardState.presentationEvents).toEqual([]);
    expect(root.cardState._presentationEventsPersist).toEqual([]);
    expect(flags.numericTargetCell).toEqual({ row: 2, col: 3 });
    expect(root.forceFullRender).toHaveBeenCalledWith(dom.window.document.getElementById('board'));
    expect(root.ActionManager.ActionManager.reset).toHaveBeenCalled();
    dom.window.close();
  });

  test('prepareNumericDemo waits for playback to settle before forcing board sync', async () => {
    const dom = new JSDOM('<div id="board"></div>');

    const root = {
      BLACK: 1,
      WHITE: -1,
      document: dom.window.document,
      VisualPlaybackActive: true,
      gameState: {
        board: createStandardBoard(),
        currentPlayer: 1,
        consecutivePasses: 0,
        turnNumber: 0,
        boardExpansion: null
      },
      cardState: {
        hands: { black: ['observer_01'], white: [] },
        boardBonusByCell: {},
        boardBonusConsumedByCell: {},
        turnIndex: 5,
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        selectedCardId: null,
        selectedCardOwnerKey: null,
        markers: [],
        expansionStoneIdByCell: {},
        charge: { black: 0, white: 0 },
        lastUsedCardByPlayer: { black: null, white: null }
      },
      CoreLogic: {
        getLegalMoves: () => [{ row: 2, col: 3 }]
      },
      emitCardStateChange: jest.fn(),
      emitBoardUpdate: jest.fn(),
      emitGameStateChange: jest.fn(),
      renderCardUI: jest.fn(),
      updateCardDetailPanel: jest.fn(),
      updateStatus: jest.fn(),
      forceFullRender: jest.fn()
    };

    const runtime = TutorialRuntimeModule.createTutorialRuntime({ root });
    const pending = runtime.prepareNumericDemo({
      setFlag: jest.fn()
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(root.forceFullRender).not.toHaveBeenCalled();

    setTimeout(() => {
      root.VisualPlaybackActive = false;
    }, 80);
    await pending;

    expect(root.forceFullRender).toHaveBeenCalledWith(dom.window.document.getElementById('board'));
    dom.window.close();
  });

  test('prepareNumericDemo re-applies CPU suppression after resetGame rebinding globals', async () => {
    const dom = new JSDOM('<div id="board"></div>');
    const originalProcessCpuTurn = jest.fn(() => 'cpu');
    const originalProcessAutoBlackTurn = jest.fn(() => 'auto');
    const reboundProcessCpuTurn = jest.fn(() => 'rebound-cpu');
    const reboundProcessAutoBlackTurn = jest.fn(() => 'rebound-auto');

    const root = {
      BLACK: 1,
      WHITE: -1,
      document: dom.window.document,
      processCpuTurn: originalProcessCpuTurn,
      processAutoBlackTurn: originalProcessAutoBlackTurn,
      resetGame: jest.fn(() => {
        root.processCpuTurn = reboundProcessCpuTurn;
        root.processAutoBlackTurn = reboundProcessAutoBlackTurn;
      }),
      gameState: {
        board: createStandardBoard(),
        currentPlayer: 1,
        consecutivePasses: 0,
        turnNumber: 4,
        boardExpansion: null
      },
      cardState: {
        hands: { black: ['observer_01'], white: [] },
        boardBonusByCell: {},
        boardBonusConsumedByCell: {},
        turnIndex: 6,
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        selectedCardId: null,
        selectedCardOwnerKey: null,
        markers: [],
        expansionStoneIdByCell: {},
        charge: { black: 0, white: 0 },
        lastUsedCardByPlayer: { black: null, white: null }
      },
      CoreLogic: {
        getLegalMoves: () => [{ row: 2, col: 3 }]
      },
      emitCardStateChange: jest.fn(),
      emitBoardUpdate: jest.fn(),
      emitGameStateChange: jest.fn(),
      renderCardUI: jest.fn(),
      updateCardDetailPanel: jest.fn(),
      updateStatus: jest.fn(),
      forceFullRender: jest.fn()
    };

    const runtime = TutorialRuntimeModule.createTutorialRuntime({ root });
    await runtime.startMainTutorial();
    await runtime.prepareNumericDemo({ setFlag: jest.fn() });

    expect(root.resetGame).toHaveBeenCalledTimes(2);
    expect(root.processCpuTurn()).toBeUndefined();
    expect(root.processAutoBlackTurn()).toBeUndefined();
    expect(reboundProcessCpuTurn).not.toHaveBeenCalled();
    expect(reboundProcessAutoBlackTurn).not.toHaveBeenCalled();
    expect(root.gameState.currentPlayer).toBe(1);
    expect(root.cardState.turnIndex).toBe(0);
    dom.window.close();
  });

  test('tutorial resets abort active playback before calling resetGame', async () => {
    const dom = new JSDOM('<div id="board"></div>');
    const abortAndSync = jest.fn(() => {
      root.VisualPlaybackActive = false;
    });
    const callOrder = [];
    const root = {
      BLACK: 1,
      WHITE: -1,
      document: dom.window.document,
      VisualPlaybackActive: true,
      __playbackActiveSince: 123,
      __drawHandAnimActive: true,
      AnimationEngine: {
        abortAndSync: jest.fn(() => {
          callOrder.push('abort');
          abortAndSync();
        })
      },
      resetGame: jest.fn(() => {
        callOrder.push('reset');
      }),
      gameState: {
        board: createStandardBoard(),
        currentPlayer: 1,
        consecutivePasses: 0,
        turnNumber: 0,
        boardExpansion: null
      },
      cardState: {
        hands: { black: ['observer_01'], white: [] },
        boardBonusByCell: {},
        boardBonusConsumedByCell: {},
        turnIndex: 0,
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        selectedCardId: null,
        selectedCardOwnerKey: null,
        markers: [],
        expansionStoneIdByCell: {},
        charge: { black: 0, white: 0 },
        lastUsedCardByPlayer: { black: null, white: null }
      },
      emitCardStateChange: jest.fn(),
      emitBoardUpdate: jest.fn(),
      emitGameStateChange: jest.fn(),
      renderCardUI: jest.fn(),
      updateCardDetailPanel: jest.fn(),
      updateStatus: jest.fn(),
      forceFullRender: jest.fn()
    };

    const runtime = TutorialRuntimeModule.createTutorialRuntime({ root });
    await runtime.startMainTutorial();

    expect(root.AnimationEngine.abortAndSync).toHaveBeenCalled();
    expect(root.resetGame).toHaveBeenCalled();
    expect(callOrder).toEqual(['abort', 'reset']);
    expect(root.VisualPlaybackActive).toBe(false);
    expect(root.__playbackActiveSince).toBeNull();
    expect(root.__drawHandAnimActive).toBe(false);
    dom.window.close();
  });

  test('startMainTutorial waits until reset playback settles', async () => {
    const dom = new JSDOM('<div id="board"></div>');
    const root = {
      BLACK: 1,
      WHITE: -1,
      document: dom.window.document,
      VisualPlaybackActive: false,
      resetGame: jest.fn(() => {
        root.VisualPlaybackActive = true;
        setTimeout(() => {
          root.VisualPlaybackActive = false;
        }, 80);
      }),
      gameState: {
        board: createStandardBoard(),
        currentPlayer: 1,
        consecutivePasses: 0,
        turnNumber: 0,
        boardExpansion: null
      },
      cardState: {
        hands: { black: ['observer_01'], white: [] },
        boardBonusByCell: {},
        boardBonusConsumedByCell: {},
        turnIndex: 0,
        pendingEffectByPlayer: { black: null, white: null },
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
        selectedCardId: null,
        selectedCardOwnerKey: null,
        markers: [],
        expansionStoneIdByCell: {},
        charge: { black: 0, white: 0 },
        lastUsedCardByPlayer: { black: null, white: null }
      },
      emitCardStateChange: jest.fn(),
      emitBoardUpdate: jest.fn(),
      emitGameStateChange: jest.fn(),
      renderCardUI: jest.fn(),
      updateCardDetailPanel: jest.fn(),
      updateStatus: jest.fn(),
      forceFullRender: jest.fn()
    };

    const runtime = TutorialRuntimeModule.createTutorialRuntime({ root });
    const startedAt = Date.now();
    await runtime.startMainTutorial();
    const elapsed = Date.now() - startedAt;

    expect(root.resetGame).toHaveBeenCalled();
    expect(root.VisualPlaybackActive).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(70);
    dom.window.close();
  });
});
