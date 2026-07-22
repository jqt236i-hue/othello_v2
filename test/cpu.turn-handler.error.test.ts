describe('cpu-turn-handler error recovery', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.cpuSmartness = { black: 2, white: 2 };
    global.emitLogAdded = jest.fn();
    global.isGameOver = jest.fn(() => false);
    global.isProcessing = false;
    global.isCardAnimating = false;
    global.VisualPlaybackActive = false;
    global.gameState = {
      currentPlayer: global.WHITE,
      turnNumber: 4,
      stateVersion: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.cardState = {
      pendingEffectByPlayer: {
        black: null,
        white: { type: 'CAPTURE_WILL', stage: 'apply' }
      },
      hasUsedCardThisTurnByPlayer: { black: false, white: true },
      hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
      hands: { black: [], white: [] },
      charge: { black: 0, white: 0 },
      presentationEvents: [],
      _presentationEventsPersist: []
    };
  });

  afterEach(() => {
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

    delete global.BLACK;
    delete global.WHITE;
    delete global.cpuSmartness;
    delete global.emitLogAdded;
    delete global.isGameOver;
    delete global.isProcessing;
    delete global.isCardAnimating;
    delete global.VisualPlaybackActive;
    delete global.gameState;
    delete global.cardState;
  });

  test('runCpuTurn clears pending state, clears processing, and schedules a retry after an internal error', async () => {
    const cpuTurnHandler = require('../game/cpu-turn-handler.js');
    const waitMs = jest.fn(() => new Promise(() => {}));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    cpuTurnHandler.setTimers({ waitMs });
    cpuTurnHandler.setCpuUIImpl({
      resolveRuntimeValue: (name) => global[name],
      setProcessing: (next) => {
        global.isProcessing = next === true;
      },
      emitLogAdded: (...args) => global.emitLogAdded(...args),
      generateMovesForPlayer: () => {
        throw new Error('forced generate failure');
      }
    });

    try {
      await cpuTurnHandler.runCpuTurn('white');

      expect(global.isProcessing).toBe(false);
      expect(global.cardState.pendingEffectByPlayer.white).toBeNull();
      expect(global.emitLogAdded).toHaveBeenCalledWith('白の思考中にエラーが発生しました');
      expect(waitMs).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('runCpuTurn treats missing executeMove as recoverable instead of stopping on CPU turn', async () => {
    const cpuTurnHandler = require('../game/cpu-turn-handler.js');
    const waitMs = jest.fn(() => new Promise(() => {}));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.cardState.pendingEffectByPlayer.white = null;
    cpuTurnHandler.setTimers({ waitMs });
    cpuTurnHandler.setCpuUIImpl({
      resolveRuntimeValue: (name) => global[name],
      setProcessing: (next) => {
        global.isProcessing = next === true;
      },
      emitLogAdded: (...args) => global.emitLogAdded(...args),
      generateMovesForPlayer: () => [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }]
    });

    try {
      await cpuTurnHandler.runCpuTurn('white');

      expect(global.isProcessing).toBe(false);
      expect(global.emitLogAdded).toHaveBeenCalledWith('白の思考中にエラーが発生しました');
      expect(waitMs).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  test('runCpuTurn recovers when delayed move commit rejects', async () => {
    const cpuTurnHandler = require('../game/cpu-turn-handler.js');
    global.cpuSmartness.white = 6;
    global.cardState.pendingEffectByPlayer.white = null;
    const waitMs = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementation(() => new Promise(() => {}));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    cpuTurnHandler.setTimers({ waitMs });
    cpuTurnHandler.setCpuUIImpl({
      resolveRuntimeValue: (name) => global[name],
      setProcessing: (next) => {
        global.isProcessing = next === true;
      },
      emitLogAdded: (...args) => global.emitLogAdded(...args),
      generateMovesForPlayer: () => [{ row: 2, col: 3, flips: [{ row: 3, col: 3 }] }],
      executeMove: jest.fn(() => Promise.reject(new Error('forced execute failure')))
    });

    try {
      await cpuTurnHandler.runCpuTurn('white');
      await Promise.resolve();
      await Promise.resolve();

      expect(global.isProcessing).toBe(false);
      expect(global.emitLogAdded).toHaveBeenCalledWith('白の思考中にエラーが発生しました');
      expect(waitMs).toHaveBeenCalledTimes(2);
    } finally {
      consoleError.mockRestore();
      consoleLog.mockRestore();
    }
  });
});
