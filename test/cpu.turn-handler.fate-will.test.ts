import * as cpuHandler from '../game/cpu-turn-handler.js';

describe('cpu turn handler FATE_WILL turn ownership', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    global.BLACK = 1;
    global.WHITE = -1;
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.MATCH_MODE = 'cpu';
    global.cardState = {
      hands: { black: [], white: [] },
      pendingEffectByPlayer: { black: null, white: null },
      hasUsedCardThisTurnByPlayer: { black: false, white: false },
      fateWillControllerByTurnOwner: { black: null, white: null }
    };
    global.gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 'white',
      turnNumber: 8
    };
    global.gameState.board[3][3] = -1;
    global.gameState.board[3][4] = 1;
    global.gameState.board[4][3] = 1;
    global.gameState.board[4][4] = -1;
    global.CardLogic = {
      getFateWillControllerForTurnOwner: (cardState, turnOwnerKey) => {
        const map = cardState && cardState.fateWillControllerByTurnOwner ? cardState.fateWillControllerByTurnOwner : {};
        return map[turnOwnerKey] || null;
      },
      hasUsableCard: jest.fn(() => false)
    };
    global.isGameOver = jest.fn(() => false);
    global.isDebugLogAvailable = () => false;
    global.getActiveProtectionForPlayer = jest.fn(() => []);
    global.getFlipBlockers = jest.fn(() => []);
    global.generateMovesForPlayer = jest.fn(() => []);
    global.processPassTurn = jest.fn();
    global.emitLogAdded = jest.fn();
  });

  afterEach(() => {
    delete global.BLACK;
    delete global.WHITE;
    delete global.isCardAnimating;
    delete global.isProcessing;
    delete global.MATCH_MODE;
    delete global.cardState;
    delete global.gameState;
    delete global.CardLogic;
    delete global.isGameOver;
    delete global.isDebugLogAvailable;
    delete global.getActiveProtectionForPlayer;
    delete global.getFlipBlockers;
    delete global.generateMovesForPlayer;
    delete global.processPassTurn;
    delete global.emitLogAdded;
  });

  test('does not run victim white auto-turn when black human controls that turn', async () => {
    global.cardState.fateWillControllerByTurnOwner.white = 'black';

    await cpuHandler.processCpuTurn();

    expect(global.generateMovesForPlayer).not.toHaveBeenCalled();
    expect(global.processPassTurn).not.toHaveBeenCalled();
    expect(global.isProcessing).toBe(false);
  });

  test('runs owner-keyed CPU flow when white CPU controls black turn', async () => {
    global.gameState.currentPlayer = 'black';
    global.cardState.fateWillControllerByTurnOwner.black = 'white';

    await cpuHandler.processCpuTurn();

    expect(global.generateMovesForPlayer).toHaveBeenCalledWith(1, null, [], []);
    expect(global.processPassTurn).toHaveBeenCalledWith('black', false);
    expect(global.isProcessing).toBe(true);
  });
});
