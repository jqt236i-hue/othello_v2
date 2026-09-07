const { createCpuDecisionPendingOnnx } = require('../game/cpu-decision-pending-onnx');
const SharedBoardUtils = require('../shared/shared-board-utils');

function createPendingOnnx(overrides = {}) {
  const board = overrides.board || Array.from({ length: 8 }, () => Array(8).fill(0));
  const cpuTimeout = { kind: 'cpu-timeout' };
  const pendingTimeout = { kind: 'pending-timeout' };
  return createCpuDecisionPendingOnnx({
    getGameState: overrides.getGameState,
    getCardState: overrides.getCardState,
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
    cloneBoardForCpu: overrides.cloneBoardForCpu || ((source) => source.map((row) => row.slice())),
    setBoardCellValue: overrides.setBoardCellValue || ((source, row, col, value) => {
      source[row][col] = value;
      return true;
    }),
    awaitCpuPromiseWithinBudget: overrides.awaitCpuPromiseWithinBudget || (async (factory, _budgetMs, _timeoutValue) => factory()),
    getPendingSelectionOnnxTimeout: () => pendingTimeout,
    getPendingSelectionValueWeight: () => 220,
    resolveCandidateMoveByCoord: (candidates, selected) => candidates.find((m) => m.row === selected.row && m.col === selected.col) || null,
    choosePendingTargetWithPolicy: overrides.choosePendingTargetWithPolicy || ((_playerKey, _pendingType, targets) => targets[0]),
    isSameMoveByCoord: (a, b) => !!a && !!b && a.row === b.row && a.col === b.col,
    scorePendingTargetByType: overrides.scorePendingTargetByType || ((_playerKey, _pendingType, target) => target.score || 0),
    getCpuSmartnessLevel: overrides.getCpuSmartnessLevel || (() => 6),
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
  test.each([5, 6])('movement completion safeguard is restricted to level 6+: %i', async (level) => {
    const Cards = require('../game/logic/cards');
    const Core = require('../game/logic/core');
    const Prng = require('../game/schema/prng');
    const Pipeline = require('../game/turn/turn_pipeline');
    require('../game/logic/presentation').setPresentationRuntime({ emitPresentationEvent: require('../game/logic/board_ops').emitPresentationEvent });
    const rng = Prng.createPRNG(111), cs = Cards.createCardState(rng), gs = Core.createGameState();
    gs.board[2][0] = -1; gs.board[5][0] = 1; gs.board[2][7] = -1;
    cs.markers.push({ id: 1, markerId: '1', row: 5, col: 0, kind: 'manifestStone', owner: 'black', createdSeq: 1,
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 1, inviolable: true } });
    cs.hasUsedCardThisTurnByPlayer.black = true;
    cs.pendingEffectByPlayer.black = { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' };
    const selected = { row: 2, col: 0 };
    const module = createPendingOnnx({ getGameState: () => gs, getCardState: () => cs,
      getCpuSmartnessLevel: () => level, resolvePolicyOnnxRuntime: () => null,
      choosePendingTargetWithPolicy: (_p, _t, targets) => targets.find(t => t.row === 2 && t.col === 0) || targets[0] });
    const before = JSON.stringify({ cs, gs, rng: rng.getState() });
    const result = await module.choosePendingTargetWithPolicyAsync('black', 'SUPER_GRAVITY_WILL', Cards.getSuperGravityTargets(cs, gs), cs.pendingEffectByPlayer.black);
    expect(JSON.stringify({ cs, gs, rng: rng.getState() })).toBe(before);
    if (level < 6) expect(result).toEqual(selected);
    else {
      expect(result).not.toEqual(selected);
      const applied = Pipeline.applyTurnSafe(JSON.parse(JSON.stringify(cs)), JSON.parse(JSON.stringify(gs)), 'black',
        { type: 'place', superGravityTarget: result }, Prng.createPRNG(19074000), { skipTurnStart: true });
      expect(applied.cardState.pendingEffectByPlayer.black).toBeNull();
    }
  });

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

  test('rerank value evaluation preserves expansion cells in BoardContext simulations', async () => {
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      boardConfig: { rows: 8, cols: 8, shape: 'rectangle' },
      boardExpansion: {
        active: true,
        side: 'right',
        row: 0,
        owner: 0,
        usedByPlayer: { black: false, white: false },
        cells: [{ side: 'right', row: 0, col: 8, owner: 1 }]
      }
    };
    gameState.board[3][2] = 1;
    const boardContext = SharedBoardUtils.createBoardContext(gameState, null);
    const selected = { row: 3, col: 2, score: 0 };
    const fallback = { row: 0, col: 8, score: 0 };
    const evaluatedValues = [];
    const runtime = {
      evaluatePosition: jest.fn(async (context) => {
        expect(SharedBoardUtils.isBoardContext(context.board)).toBe(true);
        let value = 0;
        if (SharedBoardUtils.getCellValue(context.board, 0, 8) === 0) value = 0.9;
        else if (SharedBoardUtils.getCellValue(context.board, 3, 2) === 0) value = -0.9;
        evaluatedValues.push(value);
        return value;
      })
    };
    const pendingOnnx = createPendingOnnx({
      board: boardContext,
      cloneBoardForCpu: SharedBoardUtils.cloneBoard,
      setBoardCellValue: SharedBoardUtils.setCellValue,
      choosePendingTargetWithPolicy: () => fallback
    });

    const result = await pendingOnnx.rerankOnnxPendingTargetChoice(
      runtime,
      selected,
      'white',
      6,
      'DESTROY_ONE_STONE',
      [fallback, selected],
      null,
      { board: boardContext },
      40
    );

    expect(evaluatedValues).toEqual([-0.9, 0.9]);
    expect(result).toMatchObject({
      changed: true,
      target: fallback,
      selectedValue: -0.9,
      fallbackValue: 0.9
    });
  });

  test('choosePendingTargetWithPolicyAsync falls back when ONNX gate degrades', async () => {
    const fallback = { row: 2, col: 2 };
    const pendingOnnx = createPendingOnnx({
      choosePendingTargetWithPolicy: () => fallback,
      evaluateCpuOnnxLatencyGate: () => ({ shouldDegrade: true, reason: 'slow' })
    });

    await expect(pendingOnnx.choosePendingTargetWithPolicyAsync('white', 'TRAP_WILL', [fallback], null)).resolves.toBe(fallback);
  });

  test.each(['BOARD_EXPANSION_WILL', 'BOARD_EXPANSION_GOD'])(
    '%s stays on the direction-aware heuristic lane',
    async (pendingType) => {
      const targets = [
        { row: 0, col: 0, directionKey: 'right' },
        { row: 0, col: 0, directionKey: 'left' }
      ];
      const runtime = {
        choosePendingTarget: jest.fn(async () => targets[0]),
        evaluatePosition: jest.fn(async () => 1)
      };
      const pendingOnnx = createPendingOnnx({
        choosePendingTargetWithPolicy: () => targets[1],
        resolvePolicyOnnxRuntime: () => runtime
      });

      await expect(
        pendingOnnx.choosePendingTargetWithPolicyAsync('white', pendingType, targets, null)
      ).resolves.toBe(targets[1]);
      expect(runtime.choosePendingTarget).not.toHaveBeenCalled();
      expect(runtime.evaluatePosition).not.toHaveBeenCalled();
    }
  );

  test('passes the budget AbortSignal into pending and value inference contexts', async () => {
    const signals = [];
    const runtime = {
      choosePendingTarget: jest.fn(async (_targets, context) => {
        signals.push(context.abortSignal);
        return { row: 0, col: 0 };
      }),
      evaluatePosition: jest.fn(async (context) => {
        signals.push(context.abortSignal);
        return 0;
      })
    };
    const pendingOnnx = createPendingOnnx({
      choosePendingTargetWithPolicy: (_playerKey, _pendingType, targets) => targets[1],
      resolvePolicyOnnxRuntime: () => runtime,
      awaitCpuPromiseWithinBudget: (factory) => factory(new AbortController().signal)
    });
    const targets = [{ row: 0, col: 0 }, { row: 1, col: 0 }];

    await expect(pendingOnnx.choosePendingTargetWithPolicyAsync('white', 'DESTROY_ONE_STONE', targets, null))
      .resolves.toBeTruthy();

    expect(runtime.choosePendingTarget).toHaveBeenCalledTimes(1);
    expect(runtime.evaluatePosition).toHaveBeenCalledTimes(2);
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true);
  });
});
