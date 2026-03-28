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
    expect(global.emitLogAdded).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'commentary',
      speakerRole: 'cpu',
      playerKey: 'white',
      prefix: '白CPU',
      line: '行くぞ',
      text: '白CPU: 行くぞ'
    }));
  });

  test('corner gain after CPU move triggers an immediate second commentary request', async () => {
    jest.resetModules();

    const requestCommentaryMock = jest.fn()
      .mockResolvedValueOnce('読むぞ')
      .mockResolvedValueOnce('角だ');
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
    global.executeMove = jest.fn(() => {
      global.gameState.board[0][0] = -1;
      global.gameState.currentPlayer = 'black';
    });
    global.generateMovesForPlayer = jest.fn(() => [{ row: 0, col: 0, flips: [] }]);

    const handler = require('../game/cpu-turn-handler');

    await handler.runCpuTurn('white');
    await Promise.resolve();
    await Promise.resolve();

    expect(requestCommentaryMock).toHaveBeenCalledTimes(2);
    expect(requestCommentaryMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      eventType: 'turn_start',
      playerKey: 'white',
      board: expect.any(Array)
    }));
    expect(requestCommentaryMock.mock.calls[1][0].board[0][0]).toBe(-1);
    expect(global.emitLogAdded).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: 'commentary',
      speakerRole: 'cpu',
      playerKey: 'white',
      prefix: '白CPU',
      line: '角だ',
      text: '白CPU: 角だ'
    }));
  });

  test('non-corner CPU move does not trigger extra commentary request', async () => {
    jest.resetModules();

    const requestCommentaryMock = jest.fn(async () => '読むぞ');
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
    global.executeMove = jest.fn(() => {
      global.gameState.board[2][3] = -1;
      global.gameState.currentPlayer = 'black';
    });
    global.generateMovesForPlayer = jest.fn(() => [{ row: 2, col: 3, flips: [] }]);

    const handler = require('../game/cpu-turn-handler');

    await handler.runCpuTurn('white');
    await Promise.resolve();
    await Promise.resolve();

    expect(requestCommentaryMock).toHaveBeenCalledTimes(1);
  });
});
