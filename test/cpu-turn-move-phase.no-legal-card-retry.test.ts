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
      maybeUseCardFromOnnx: jest.fn(async () => ({ attempted: true, applied: false, hold: true })),
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
});
