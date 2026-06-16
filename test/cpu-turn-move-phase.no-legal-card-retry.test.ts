import { createCpuTurnMovePhase } from '../game/cpu-turn-move-phase.js';

function createConfig(overrides: Record<string, any> = {}) {
  const passFn = jest.fn();
  const scheduleRunCpuTurn = jest.fn();

  return {
    config: {
      blackValue: 1,
      countOwnedBasicCornersSafe: jest.fn(() => 0),
      debugCpuTrace: jest.fn(),
      emitCpuCommentary: jest.fn(),
      emitCpuDebugLog: jest.fn(),
      getActiveProtectionSafe: jest.fn(() => []),
      getAnimationRetryDelayMs: jest.fn(() => 0),
      getCardState: jest.fn(() => ({})),
      getCurrentPlayerKeySafe: jest.fn(() => 'white'),
      getCurrentTurnNumberSafe: jest.fn(() => 12),
      getFlipBlockersSafe: jest.fn(() => []),
      getGameState: jest.fn(() => ({ currentPlayer: 'white', turnNumber: 12 })),
      getSelectMoveFromOnnxFn: jest.fn(() => null),
      getUseCardWithPolicyFn: jest.fn(() => jest.fn(() => false)),
      handleCpuTurnError: jest.fn(),
      isCpuDebugLogAvailable: jest.fn(() => false),
      isUiAnimationBusy: jest.fn(() => false),
      resetPendingSelectRetryState: jest.fn(),
      resolveCpuCardLogic: jest.fn(() => ({
        hasUsableCard: jest.fn(() => true)
      })),
      resolveExecuteMoveFn: jest.fn(() => null),
      resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => [])),
      resolveLv6MinThinkMs: jest.fn(() => 0),
      resolveProcessPassTurn: jest.fn(() => passFn),
      scheduleRetry: jest.fn(),
      scheduleRunCpuTurn,
      selectCpuMoveSafe: jest.fn(() => null),
      setCpuProcessing: jest.fn(),
      shouldAbortCpuForHumanMode: jest.fn(() => false),
      shouldUseOnnxMoveDecision: jest.fn(() => false),
      tryApplyAnyUsableCard: jest.fn(() => false),
      whiteValue: -1,
      ...overrides
    },
    passFn,
    scheduleRunCpuTurn
  };
}

describe('cpu turn move phase no-legal card retry', () => {
  test('passes instead of rescheduling forever when no legal moves and no card retry applies', async () => {
    const { config, passFn, scheduleRunCpuTurn } = createConfig();
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'pass' });
    expect(passFn).toHaveBeenCalledWith('white', false);
    expect(scheduleRunCpuTurn).not.toHaveBeenCalled();
  });

  test('retries when pass handler is not available for a no-action CPU turn', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { config, scheduleRunCpuTurn } = createConfig({
      resolveCpuCardLogic: jest.fn(() => ({
        hasUsableCard: jest.fn(() => false)
      })),
      resolveProcessPassTurn: jest.fn(() => null)
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'retry' });
    expect(errorSpy).toHaveBeenCalledWith('[AI] processPassTurn is not available');
    expect(config.setCpuProcessing).toHaveBeenCalledWith(false);
    expect(scheduleRunCpuTurn).toHaveBeenCalledWith('white', { autoMode: false }, 0);
    errorSpy.mockRestore();
  });

  test('skips a delayed move commit when the turn changed before the retry fires', async () => {
    let retryCallback: any = null;
    let currentTurnNumber = 12;
    const executeMove = jest.fn();
    const { config } = createConfig({
      getCurrentTurnNumberSafe: jest.fn(() => currentTurnNumber),
      getGameState: jest.fn(() => ({ currentPlayer: 'white', turnNumber: currentTurnNumber })),
      resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => [{ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }])),
      resolveExecuteMoveFn: jest.fn(() => executeMove),
      resolveLv6MinThinkMs: jest.fn(() => 50),
      scheduleRetry: jest.fn((fn) => {
        retryCallback = fn;
        return true;
      }),
      selectCpuMoveSafe: jest.fn(() => ({ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }))
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'white',
      autoMode: false,
      level: 6,
      selfColor: -1,
      selfName: '白',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'handled' });
    expect(typeof retryCallback).toBe('function');

    currentTurnNumber = 13;
    await retryCallback();

    expect(executeMove).not.toHaveBeenCalled();
    expect(config.setCpuProcessing).toHaveBeenCalledWith(false);
  });

  test('skips a delayed move commit when the runtime player changed on the same turn number', async () => {
    let retryCallback: any = null;
    let runtimePlayerKey = 'black';
    const executeMove = jest.fn();
    const { config } = createConfig({
      getCurrentPlayerKeySafe: jest.fn(() => runtimePlayerKey),
      getCurrentTurnNumberSafe: jest.fn(() => 12),
      getGameState: jest.fn(() => ({ currentPlayer: 'black', turnNumber: 12 })),
      resolveGenerateMovesForPlayer: jest.fn(() => jest.fn(() => [{ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }])),
      resolveExecuteMoveFn: jest.fn(() => executeMove),
      resolveLv6MinThinkMs: jest.fn(() => 50),
      scheduleRetry: jest.fn((fn) => {
        retryCallback = fn;
        return true;
      }),
      selectCpuMoveSafe: jest.fn(() => ({ row: 3, col: 4, flips: [{ row: 3, col: 3 }] }))
    });
    const phase = createCpuTurnMovePhase(config as any);

    const result = await phase.runCpuTurnMovePhase({
      playerKey: 'black',
      autoMode: true,
      level: 1,
      selfColor: 1,
      selfName: '黒',
      othelloMode: false,
      pending: null,
      turnStartMs: Date.now()
    });

    expect(result).toEqual({ status: 'handled' });
    expect(typeof retryCallback).toBe('function');

    runtimePlayerKey = 'white';
    await retryCallback();

    expect(executeMove).not.toHaveBeenCalled();
    expect(config.setCpuProcessing).toHaveBeenCalledWith(false);
  });
});
