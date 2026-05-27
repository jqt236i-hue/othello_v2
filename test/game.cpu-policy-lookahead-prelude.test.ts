import { createCpuPolicyLookaheadPrelude } from '../game/ai/cpu-policy-lookahead-prelude';

describe('cpu-policy lookahead prelude module', () => {
  test('prepares endgame search settings and virtual clock from injected deps', () => {
    const helpers = createCpuPolicyLookaheadPrelude({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      countBoardDiscsForPlayer: () => ({ empties: 8 }),
      resolveLookaheadEndgameDepth: () => 30,
      resolveLookaheadDepth: () => 4,
      resolveLookaheadBranch: () => 9,
      resolveLookaheadNodeBudget: () => 1234,
      resolveLookaheadTimeBudgetMs: () => 500,
      resolveLookaheadVirtualTimePerNodeMs: () => 2,
      createConsumedBonusMap: () => ({ __bonusHash: 7, __bonusCount: 1 } as any),
      resolveLookaheadMixWeights: () => ({ priorWeight: 12, searchWeight: 3 }),
      getLegalMovesBasic: (_board: any, playerValue: number) => (playerValue > 0 ? [{}, {}] : [{}]),
      resolveLookaheadParityFeature: () => ({ oddRegionCount: 2, evenRegionCount: 1, signal: -1 }),
      resolveForcedPassFeature: () => ({ signal: 1, score: 980 }),
      resolveLookaheadTranspositionLimit: () => 777
    });

    let visited = 4;
    const prelude = helpers.prepareLookaheadPrelude({
      opts: {
        level: 6,
        endgameSolveEmpties: 12,
        boardBonusByCell: { '1,1': 3 },
        boardBonusConsumedByCell: { '1,1': true } as any,
        scoreMove: (() => 0) as any
      } as any,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)) as any,
      playerValue: 1,
      level: 6,
      readVisited: () => visited
    });

    expect(prelude.endgameMode).toBe(true);
    expect(prelude.depth).toBe(30);
    expect(prelude.branchLimit).toBeNull();
    expect(prelude.nodeBudget).toBe(1234);
    expect(prelude.timeBudgetMs).toBe(500);
    expect(prelude.priorWeight).toBe(12);
    expect(prelude.searchWeight).toBe(3);
    expect(prelude.rootOwnMoves).toBe(2);
    expect(prelude.rootOppMoves).toBe(1);
    expect(prelude.transpositionLimit).toBe(777);
    expect(prelude.readNowMs()).toBe(8);
    visited = 7;
    expect(prelude.readNowMs()).toBe(14);
    expect(prelude.deadlineMs).toBe(508);
  });

  test('notifies search meta and swallows callback errors', () => {
    const helpers = createCpuPolicyLookaheadPrelude();
    const metaSink: any[] = [];
    const opts = {
      onSearchMeta: jest.fn((meta) => {
        metaSink.push(meta);
      })
    } as any;

    helpers.notifyLookaheadSearchMeta(opts, {
      endgameMode: false,
      empties: 20,
      depth: 4,
      branchLimit: 9,
      nodeBudget: 8000,
      timeBudgetMs: 1200,
      ownMoves: 5,
      oppMoves: 4,
      effectivePriorWeight: 120,
      effectiveSearchWeight: 1,
      parityOddRegionCount: 1,
      parityEvenRegionCount: 2,
      paritySignal: 1,
      forcedPassSignal: 0
    });

    expect(metaSink).toHaveLength(1);

    expect(() => helpers.notifyLookaheadSearchMeta({
      onSearchMeta: () => {
        throw new Error('ignore');
      }
    } as any, metaSink[0])).not.toThrow();
  });
});
