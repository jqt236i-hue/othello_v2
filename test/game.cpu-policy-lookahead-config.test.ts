import { createCpuPolicyLookaheadConfig } from '../game/ai/cpu-policy-lookahead-config';

describe('cpu-policy lookahead config module', () => {
  test('resolves depth and branch from explicit overrides before board empties', () => {
    const countBoardDiscsForPlayer = jest.fn(() => ({ empties: 6 }));
    const helpers = createCpuPolicyLookaheadConfig({ countBoardDiscsForPlayer });
    const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;

    expect(helpers.resolveLookaheadDepth(board, 6, 9)).toBe(9);
    expect(helpers.resolveLookaheadBranch(board, 13)).toBe(13);
    expect(countBoardDiscsForPlayer).not.toHaveBeenCalled();
  });

  test('resolves depth and branch from board empties when overrides are absent', () => {
    const sparse = createCpuPolicyLookaheadConfig({
      countBoardDiscsForPlayer: () => ({ empties: 42 })
    });
    const crowded = createCpuPolicyLookaheadConfig({
      countBoardDiscsForPlayer: () => ({ empties: 10 })
    });

    expect(sparse.resolveLookaheadDepth([] as any, 6)).toBe(3);
    expect(sparse.resolveLookaheadBranch([] as any)).toBe(7);
    expect(crowded.resolveLookaheadDepth([] as any, 6)).toBe(5);
    expect(crowded.resolveLookaheadBranch([] as any)).toBe(16);
  });

  test('clamps node budgets, transposition limits, and time budgets', () => {
    const helpers = createCpuPolicyLookaheadConfig();

    expect(helpers.resolveLookaheadNodeBudget(null, 4, 8, false)).toBe(500);
    expect(helpers.resolveLookaheadNodeBudget(undefined, 10, null, true)).toBe(720000);
    expect(helpers.resolveLookaheadTranspositionLimit(1000, false)).toBe(80000);
    expect(helpers.resolveLookaheadTranspositionLimit(5_000_000, true)).toBe(2200000);
    expect(helpers.resolveLookaheadTimeBudgetMs({ maxTimeMs: 10 }, 6, false)).toBe(50);
    expect(helpers.resolveLookaheadTimeBudgetMs({ endgameMaxTimeMs: -1 }, 6, true)).toBeNull();
    expect(helpers.resolveLookaheadTimeBudgetMs({}, 6, false)).toBe(2200);
    expect(helpers.resolveLookaheadTimeBudgetMs({}, 5, true)).toBe(8000);
    expect(helpers.resolveLookaheadVirtualTimePerNodeMs({ virtualTimePerNodeMs: 0.0001 })).toBe(0.001);
  });

  test('mix weights and endgame depth preserve late-game bias', () => {
    const helpers = createCpuPolicyLookaheadConfig();

    expect(helpers.resolveLookaheadEndgameDepth({}, 7)).toBe(30);
    expect(helpers.resolveLookaheadEndgameDepth({ endgameDepth: 80 }, 7)).toBe(64);
    expect(helpers.resolveLookaheadMixWeights(5, 10, null, null)).toEqual({
      priorWeight: 120,
      searchWeight: 1
    });
    const lateGame = helpers.resolveLookaheadMixWeights(6, 10, 100, 2);
    expect(lateGame.priorWeight).toBeCloseTo(18);
    expect(lateGame.searchWeight).toBeCloseTo(2.44);
    const midGame = helpers.resolveLookaheadMixWeights(6, 24, 100, 2);
    expect(midGame.priorWeight).toBeCloseTo(58);
    expect(midGame.searchWeight).toBeCloseTo(2.16);
  });
});
