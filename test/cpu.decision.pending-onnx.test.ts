const { createCpuDecisionPendingOnnx } = require('../game/cpu-decision-pending-onnx');

function createPendingOnnx(overrides = {}) {
  const board = overrides.board || Array.from({ length: 8 }, () => Array(8).fill(0));
  const cpuTimeout = { kind: 'cpu-timeout' };
  const pendingTimeout = { kind: 'pending-timeout' };
  return createCpuDecisionPendingOnnx({
    getHandCardIdsForPlayer: () => ['card_a'],
    buildOnnxContext: (_playerKey, _level, legalMovesCount, handCardIds, usableCardIds, candidateMoves) => ({
      legalMovesCount,
      handCardIds,
      usableCardIds,
      candidateMoves
    }),
    resolveCurrentLegalMovesCountForPlayer: () => 4,
    getCurrentCpuBoard: () => board,
    isPlayableBoard: () => true,
    resolvePlayerValue: (playerKey) => (playerKey === 'black' ? 1 : -1),
    simulatePendingPlacementBoard: () => [['placed']],
    cloneBoardForCpu: (source) => source.map((row) => row.slice()),
    setBoardCellValue: (source, row, col, value) => {
      source[row][col] = value;
      return true;
    },
    awaitCpuPromiseWithinBudget: async (factory, _budgetMs, _timeoutValue) => factory(),
    getPendingSelectionOnnxTimeout: () => pendingTimeout,
    getPendingSelectionValueWeight: () => 220,
    resolveCandidateMoveByCoord: (candidates, selected) => candidates.find((m) => m.row === selected.row && m.col === selected.col) || null,
    choosePendingTargetWithPolicy: overrides.choosePendingTargetWithPolicy || ((_playerKey, _pendingType, targets) => targets[0]),
    isSameMoveByCoord: (a, b) => !!a && !!b && a.row === b.row && a.col === b.col,
    scorePendingTargetByType: overrides.scorePendingTargetByType || ((_playerKey, _pendingType, target) => target.score || 0),
    getCpuSmartnessLevel: () => 6,
    resolvePolicyOnnxRuntime: overrides.resolvePolicyOnnxRuntime || (() => ({
      choosePendingTarget: async (targets) => targets[1],
      evaluatePosition: async (context) => (context.candidateMoves[0].row === 1 ? 10 : 0)
    })),
    canUseStandardBoardCpuPolicy: overrides.canUseStandardBoardCpuPolicy || (() => true),
    resolvePendingSelectionOnnxBudgetMs: () => 40,
    evaluateCpuOnnxLatencyGate: overrides.evaluateCpuOnnxLatencyGate || (() => ({ shouldDegrade: false })),
    logCpuOnnxLatencyDegrade: jest.fn(),
    getCpuOnnxBudgetTimeout: () => cpuTimeout,
    cpuDebugLog: jest.fn(),
    warn: jest.fn()
  });
}

describe('cpu decision pending onnx module', () => {
  test('buildPendingTargetOnnxContext adds pending type to ONNX context', () => {
    const pendingOnnx = createPendingOnnx();

    expect(pendingOnnx.buildPendingTargetOnnxContext('white', 6, 'TRAP_WILL', [{ row: 1, col: 2 }])).toMatchObject({
      legalMovesCount: 4,
      handCardIds: ['card_a'],
      candidateMoves: [{ row: 1, col: 2 }],
      pendingType: 'TRAP_WILL'
    });
  });

  test('simulateBoardForPendingTarget handles destroy target board override', () => {
    const board = Array.from({ length: 2 }, () => Array(2).fill(1));
    const pendingOnnx = createPendingOnnx({ board });

    const next = pendingOnnx.simulateBoardForPendingTarget('white', 'DESTROY_ONE_STONE', { row: 0, col: 1 });

    expect(next).not.toBe(board);
    expect(next[0][1]).toBe(0);
  });

  test('rerankOnnxPendingTargetChoice can override ONNX target with fallback value model', async () => {
    const pendingOnnx = createPendingOnnx({
      choosePendingTargetWithPolicy: (_playerKey, _pendingType, targets) => targets[0]
    });
    const selected = { row: 0, col: 0, score: 0 };
    const fallback = { row: 1, col: 0, score: 0 };

    const result = await pendingOnnx.rerankOnnxPendingTargetChoice(
      {
        evaluatePosition: async (context) => (context.candidateMoves[0].row === 1 ? 1 : 0)
      },
      selected,
      'white',
      6,
      'DESTROY_ONE_STONE',
      [fallback, selected],
      null,
      {},
      40
    );

    expect(result.changed).toBe(true);
    expect(result.target).toBe(fallback);
  });

  test('choosePendingTargetWithPolicyAsync falls back when ONNX gate degrades', async () => {
    const fallback = { row: 2, col: 2 };
    const pendingOnnx = createPendingOnnx({
      choosePendingTargetWithPolicy: () => fallback,
      evaluateCpuOnnxLatencyGate: () => ({ shouldDegrade: true, reason: 'slow' })
    });

    await expect(pendingOnnx.choosePendingTargetWithPolicyAsync('white', 'TRAP_WILL', [fallback], null)).resolves.toBe(fallback);
  });
});
