import { createCpuPolicyLookaheadController } from '../game/ai/cpu-policy-lookahead-controller';

describe('cpu-policy lookahead controller module', () => {
  const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
  const moveA = { id: 'a', row: 4, col: 4 } as any;
  const moveB = { id: 'b', row: 1, col: 1 } as any;

  test('returns null without candidate moves or board', () => {
    const helpers = createCpuPolicyLookaheadController();

    expect(helpers.chooseMoveByLookahead([], { board } as any)).toBeNull();
    expect(helpers.chooseMoveByLookahead([moveA], {} as any)).toBeNull();
  });

  test('falls back to ordered root move and emits search metadata', () => {
    const metaSink: any[] = [];
    const helpers = createCpuPolicyLookaheadController({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      prepareLookaheadPrelude: () => ({
        empties: 12,
        endgameMode: false,
        depth: 8,
        branchLimit: 6,
        nodeBudget: 9000,
        timeBudgetMs: 500,
        readNowMs: () => 0,
        deadlineMs: 500,
        boardBonusByCell: null,
        baseConsumedMap: Object.create(null),
        priorFn: null,
        priorWeight: 120,
        searchWeight: 2,
        rootOwnMoves: 7,
        rootOppMoves: 5,
        rootParity: { oddRegionCount: 2, evenRegionCount: 1, signal: -1 },
        rootPassPressure: { signal: 1, score: 900 },
        transpositionLimit: 3000
      }),
      notifyLookaheadSearchMeta: (_opts, meta) => { metaSink.push(meta); },
      createNegamax: () => ({ negamax: () => 0 }),
      buildSearchMoveOrder: () => [moveB, moveA],
      runLookaheadRootSearch: (input) => ({
        bestMove: null,
        bestScore: Number.NEGATIVE_INFINITY,
        rootMoves: input.orderedRootBase
      }),
      applyLookaheadHardGuards: (input) => input.bestMove
    });

    const out = helpers.chooseMoveByLookahead([moveA, moveB], {
      board,
      playerValue: 1,
      level: 6
    } as any);

    expect(out).toBe(moveB);
    expect(metaSink).toEqual([{
      endgameMode: false,
      empties: 12,
      depth: 8,
      branchLimit: 6,
      nodeBudget: 9000,
      timeBudgetMs: 500,
      ownMoves: 7,
      oppMoves: 5,
      effectivePriorWeight: 120,
      effectiveSearchWeight: 2,
      parityOddRegionCount: 2,
      parityEvenRegionCount: 1,
      paritySignal: -1,
      forcedPassSignal: 1
    }]);
  });

  test('skips hard guards below level 6', () => {
    const guardSpy = jest.fn(() => moveB);
    const helpers = createCpuPolicyLookaheadController({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      prepareLookaheadPrelude: () => ({
        empties: 20,
        endgameMode: false,
        depth: 4,
        branchLimit: null,
        nodeBudget: 4000,
        timeBudgetMs: null,
        readNowMs: () => 0,
        deadlineMs: null,
        boardBonusByCell: null,
        baseConsumedMap: Object.create(null),
        priorFn: null,
        priorWeight: 120,
        searchWeight: 1,
        rootOwnMoves: 3,
        rootOppMoves: 3,
        rootParity: { oddRegionCount: 0, evenRegionCount: 0, signal: 0 },
        rootPassPressure: { signal: 0, score: 0 },
        transpositionLimit: 1000
      }),
      createNegamax: () => ({ negamax: () => 0 }),
      buildSearchMoveOrder: () => [moveA, moveB],
      runLookaheadRootSearch: () => ({
        bestMove: moveA,
        bestScore: 1,
        rootMoves: [moveA, moveB]
      }),
      applyLookaheadHardGuards: guardSpy
    });

    const out = helpers.chooseMoveByLookahead([moveA, moveB], {
      board,
      playerValue: 1,
      level: 5
    } as any);

    expect(out).toBe(moveA);
    expect(guardSpy).not.toHaveBeenCalled();
  });

  test('returns first candidate when budget is already hit and no move survives ordering', () => {
    const helpers = createCpuPolicyLookaheadController({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      prepareLookaheadPrelude: () => ({
        empties: 14,
        endgameMode: false,
        depth: 6,
        branchLimit: 4,
        nodeBudget: 10,
        timeBudgetMs: null,
        readNowMs: () => 0,
        deadlineMs: null,
        boardBonusByCell: null,
        baseConsumedMap: Object.create(null),
        priorFn: null,
        priorWeight: 120,
        searchWeight: 1,
        rootOwnMoves: 2,
        rootOppMoves: 2,
        rootParity: { oddRegionCount: 0, evenRegionCount: 0, signal: 0 },
        rootPassPressure: { signal: 0, score: 0 },
        transpositionLimit: 1000
      }),
      createNegamax: (input) => {
        input.markBudgetHit();
        return { negamax: () => 0 };
      },
      buildSearchMoveOrder: () => [],
      runLookaheadRootSearch: () => ({
        bestMove: null,
        bestScore: Number.NEGATIVE_INFINITY,
        rootMoves: []
      }),
      applyLookaheadHardGuards: (input) => input.bestMove
    });

    const out = helpers.chooseMoveByLookahead([moveA, moveB], {
      board,
      playerValue: -1,
      level: 6
    } as any);

    expect(out).toBe(moveA);
  });
});
