describe('cpu turn handler commentary', () => {
  test('shared runtime helper prefix is used for white CPU commentary logs', async () => {
    jest.resetModules();

    const requestCommentaryMock = jest.fn(async () => '行くぞ');
    jest.doMock('../game/ai/cpu-commentary-runtime', () => ({
      requestCommentary: requestCommentaryMock
    }));

    global.BLACK = 1;
    global.WHITE = -1;
    global.cpuSmartness = { white: 1 };
    global.gameState = {
      currentPlayer: 'white',
      turnNumber: 9,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cardState = {
      hands: { white: [], black: [] },
      charge: { white: 10, black: 10 },
      pendingEffectByPlayer: { white: null, black: null },
      hasUsedCardThisTurnByPlayer: { white: true, black: false },
      hasDestroyedCardThisTurnByPlayer: { white: false, black: false },
      lastUsedCardByPlayer: { white: null, black: null }
    };
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.isDebugLogAvailable = () => false;
    global.emitLogAdded = jest.fn();
    global.playHandAnimation = jest.fn((playerValue, row, col, cb) => {
      if (typeof cb === 'function') cb();
    });
    global.executeMove = jest.fn();
    global.generateMovesForPlayer = jest.fn(() => [{ row: 2, col: 3, flips: [] }]);

    const handler = require('../game/cpu-turn-handler');

    await handler.runCpuTurn('white');
    await Promise.resolve();
    await Promise.resolve();

    expect(requestCommentaryMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'turn_start',
      playerKey: 'white'
    }));
    expect(global.emitLogAdded).toHaveBeenCalledWith('白CPU: 行くぞ');
  });
});
