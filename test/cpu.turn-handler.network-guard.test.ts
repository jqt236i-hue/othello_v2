import * as path from 'path';

const cpuHandler = require(path.resolve(__dirname, '..', 'game', 'cpu-turn-handler.js'));

function waitTick() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('cpu turn handler network guard', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    cpuHandler.setTimers({
      waitMs: () => Promise.resolve()
    });
    cpuHandler.setCpuUIImpl({
      readMatchMode: () => global.MATCH_MODE,
      readHumanVsHumanMode: () => false,
      resolveExecuteMove: () => global.executeMove,
      DEBUG_HUMAN_VS_HUMAN: false,
      MATCH_MODE: undefined
    });
    global.MATCH_MODE = 'network';
    global.cardState = {
      hasUsedCardThisTurnByPlayer: { white: false, black: false },
      pendingEffectByPlayer: { white: null, black: null },
      hands: { white: [], black: [] }
    };
    global.gameState = { currentPlayer: 'white', turnNumber: 12 };
    global.BLACK = 1;
    global.WHITE = -1;
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.isGameOver = jest.fn(() => false);
    global.isDebugLogAvailable = () => false;
    global.generateMovesForPlayer = jest.fn(() => [{ row: 2, col: 3, flips: [] }]);
    global.selectCpuMoveWithPolicy = jest.fn(() => ({ row: 2, col: 3, flips: [] }));
    global.playHandAnimation = jest.fn((player, row, col, cb) => cb());
    global.executeMove = jest.fn();
    global.cpuMaybeUseCardWithPolicy = jest.fn(() => {
      global.cardState.hasUsedCardThisTurnByPlayer.white = true;
      return true;
    });
  });

  afterEach(() => {
    cpuHandler.setTimers(null);
    cpuHandler.setCpuUIImpl({
      readMatchMode: null,
      readHumanVsHumanMode: null,
      DEBUG_HUMAN_VS_HUMAN: false,
      MATCH_MODE: undefined
    });
    delete global.MATCH_MODE;
    delete global.cardState;
    delete global.gameState;
    delete global.BLACK;
    delete global.WHITE;
    delete global.isCardAnimating;
    delete global.isProcessing;
    delete global.isGameOver;
    delete global.isDebugLogAvailable;
    delete global.generateMovesForPlayer;
    delete global.selectCpuMoveWithPolicy;
    delete global.playHandAnimation;
    delete global.executeMove;
    delete global.cpuMaybeUseCardWithPolicy;
    delete global.window;
  });

  test('runCpuTurn does not mutate state in network mode', async () => {
    await cpuHandler.runCpuTurn('white');

    expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
    expect(global.cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
    expect(global.isProcessing).toBe(false);
  });

  test('runCpuTurn uses injected match mode before global fallback', async () => {
    delete global.MATCH_MODE;
    cpuHandler.setCpuUIImpl({
      readMatchMode: () => 'network',
      readHumanVsHumanMode: () => false
    });

    await cpuHandler.runCpuTurn('white');

    expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
    expect(global.cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
    expect(global.isProcessing).toBe(false);
  });

  test('runCpuTurn ignores test-only window human flag when injected mode is false', async () => {
    delete global.MATCH_MODE;
    global.window = { DEBUG_HUMAN_VS_HUMAN: true };
    cpuHandler.setCpuUIImpl({
      readMatchMode: () => 'cpu',
      readHumanVsHumanMode: () => false
    });

    await cpuHandler.runCpuTurn('white');

    expect(global.cpuMaybeUseCardWithPolicy).toHaveBeenCalledTimes(1);
    expect(global.executeMove).toHaveBeenCalledTimes(1);
  });

  test('scheduled processCpuTurn retry also stays inert in network mode', async () => {
    global.isProcessing = true;
    cpuHandler.processCpuTurn();
    await waitTick();
    await waitTick();

    expect(global.cpuMaybeUseCardWithPolicy).not.toHaveBeenCalled();
    expect(global.executeMove).not.toHaveBeenCalled();
    expect(global.cardState.hasUsedCardThisTurnByPlayer.white).toBe(false);
  });
});
