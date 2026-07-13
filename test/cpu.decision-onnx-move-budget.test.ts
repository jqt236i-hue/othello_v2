import { createCpuDecisionOnnxMove } from '../game/cpu-decision-onnx-move';

function createBaseDeps(overrides: Record<string, any> = {}) {
  const timeout = { kind: 'timeout' };
  return {
    getCurrentCpuBoard: jest.fn(() => Array.from({ length: 8 }, () => Array(8).fill(0))),
    resolvePendingType: jest.fn(() => 'PROTECTED_NEXT_STONE'),
    shouldUseOthelloOnnxRuntime: jest.fn(() => false),
    shouldForceCardModeLv6Placement: jest.fn(() => false),
    isOthelloModeForCpuDecision: jest.fn(() => false),
    resolveOthelloOnnxRuntime: jest.fn(() => null),
    resolvePolicyOnnxRuntime: jest.fn(() => ({
      chooseMove: jest.fn(() => new Promise(() => {}))
    })),
    canUseStandardBoardCpuPolicy: jest.fn(() => true),
    filterMovesByLv6PlacementPriority: jest.fn((_playerKey, _level, moves) => moves),
    filterLv6OpenCornerAdjacentMoves: jest.fn((moves) => moves),
    evaluateCpuOnnxLatencyGate: jest.fn(() => ({ shouldDegrade: false, reason: '' })),
    logCpuOnnxLatencyDegrade: jest.fn(),
    resolveCpuLv6OnnxRuntimeBudgetMs: jest.fn(() => 0),
    awaitCpuPromiseWithinBudget: jest.fn(async (_factory, _budgetMs, timeoutValue) => timeoutValue),
    getCpuOnnxBudgetTimeout: jest.fn(() => timeout),
    buildOnnxContext: jest.fn(() => ({})),
    getHandCardIdsForPlayer: jest.fn(() => []),
    resolveCandidateMoveByCoord: jest.fn(() => null),
    refineOnnxMoveByTacticalPlan: jest.fn((_moves, selected) => selected),
    selectMoveByLookahead: jest.fn(() => null),
    isSameMoveByCoord: jest.fn(() => false),
    cpuDebugLog: jest.fn(),
    warn: jest.fn(),
    ...overrides
  };
}

describe('cpu decision ONNX move budget', () => {
  test('bounds non-Lv6 ONNX move selection when no configured budget exists', async () => {
    const deps = createBaseDeps();
    const mod = createCpuDecisionOnnxMove(deps as any);

    const result = await mod.selectMoveFromOnnxPolicyAsync([
      { row: 2, col: 4, flips: [{ row: 3, col: 4 }] }
    ], 'white', 1);

    expect(result).toBeNull();
    expect(deps.awaitCpuPromiseWithinBudget).toHaveBeenCalledTimes(1);
    expect(deps.awaitCpuPromiseWithinBudget.mock.calls[0][1]).toBeGreaterThan(0);
    expect(deps.logCpuOnnxLatencyDegrade).toHaveBeenCalledWith(
      1,
      'white',
      'chooseMove',
      expect.stringContaining('timeout budget=')
    );
  });

  test('passes the budget AbortSignal into the ONNX inference context', async () => {
    const chooseMove = jest.fn(async (_moves, context) => {
      expect(context.abortSignal).toBeInstanceOf(AbortSignal);
      return { row: 2, col: 4 };
    });
    const deps = createBaseDeps({
      resolvePolicyOnnxRuntime: jest.fn(() => ({ chooseMove })),
      awaitCpuPromiseWithinBudget: jest.fn((factory) => factory(new AbortController().signal)),
      refineOnnxMoveByTacticalPlan: jest.fn((_moves, selected) => selected)
    });
    const mod = createCpuDecisionOnnxMove(deps as any);

    await expect(mod.selectMoveFromOnnxPolicyAsync([
      { row: 2, col: 4, flips: [{ row: 3, col: 4 }] }
    ], 'white', 1)).resolves.toMatchObject({ row: 2, col: 4 });

    expect(chooseMove).toHaveBeenCalledTimes(1);
  });
});
