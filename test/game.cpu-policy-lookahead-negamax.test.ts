import { createCpuPolicyLookaheadNegamax } from '../game/ai/cpu-policy-lookahead-negamax';
import { createCpuPolicySearchOrder } from '../game/ai/cpu-policy-search-order';

describe('cpu-policy lookahead negamax module', () => {
  test('returns evaluation and marks time hit when deadline has passed', () => {
    let timeHit = false;
    const helpers = createCpuPolicyLookaheadNegamax({
      evaluateBoardForLookahead: () => 77
    });
    const { negamax } = helpers.createNegamax({
      endgameMode: false,
      deadlineMs: 5,
      readNowMs: () => 6,
      nodeBudget: 10,
      readVisited: () => 0,
      incrementVisited: () => undefined,
      markBudgetHit: () => undefined,
      markTimeHit: () => { timeHit = true; },
      transposition: new Map(),
      transpositionLimit: 100,
      level: 6,
      boardBonusByCell: null,
      branchLimit: null,
      shouldStop: () => false
    });

    expect(negamax([] as any, 1, 3, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false, Object.create(null))).toBe(77);
    expect(timeHit).toBe(true);
  });

  test('returns evaluation and marks budget hit when node budget is exhausted', () => {
    let budgetHit = false;
    const helpers = createCpuPolicyLookaheadNegamax({
      evaluateBoardForLookahead: () => 55
    });
    const { negamax } = helpers.createNegamax({
      endgameMode: false,
      deadlineMs: null,
      readNowMs: () => 0,
      nodeBudget: 1,
      readVisited: () => 1,
      incrementVisited: () => undefined,
      markBudgetHit: () => { budgetHit = true; },
      markTimeHit: () => undefined,
      transposition: new Map(),
      transpositionLimit: 100,
      level: 6,
      boardBonusByCell: null,
      branchLimit: null,
      shouldStop: () => false
    });

    expect(negamax([] as any, 1, 3, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false, Object.create(null))).toBe(55);
    expect(budgetHit).toBe(true);
  });

  test('uses terminal evaluation after consecutive passes and reuses transposition cache', () => {
    let terminalCalls = 0;
    const transposition = new Map<string, number>();
    const helpers = createCpuPolicyLookaheadNegamax({
      evaluateBoardForLookahead: () => 12,
      evaluateTerminalBoardForLookahead: () => {
        terminalCalls += 1;
        return 999;
      },
      buildBoardSearchKey: (_board: any, currentPlayer: number, depthLeft: number, passed: boolean) => `${currentPlayer}:${depthLeft}:${passed ? 1 : 0}`,
      getLegalMovesBasic: () => []
    });
    let visited = 0;
    const { negamax } = helpers.createNegamax({
      endgameMode: true,
      deadlineMs: null,
      readNowMs: () => 0,
      nodeBudget: 20,
      readVisited: () => visited,
      incrementVisited: () => { visited += 1; },
      markBudgetHit: () => undefined,
      markTimeHit: () => undefined,
      transposition,
      transpositionLimit: 100,
      level: 6,
      boardBonusByCell: null,
      branchLimit: null,
      shouldStop: () => false
    });

    expect(negamax([] as any, 1, 2, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, true, Object.create(null))).toBe(999);
    expect(negamax([] as any, 1, 2, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, true, Object.create(null))).toBe(999);
    expect(terminalCalls).toBe(1);
    expect(transposition.size).toBe(1);
  });

  test('forced pass negates the recursive child score', () => {
    const helpers = createCpuPolicyLookaheadNegamax({
      evaluateBoardForLookahead: (_board: any, playerValue: number) => (playerValue > 0 ? 20 : 30),
      buildBoardSearchKey: (_board: any, currentPlayer: number, depthLeft: number, passed: boolean) => `${currentPlayer}:${depthLeft}:${passed ? 1 : 0}`,
      getLegalMovesBasic: () => []
    });
    let visited = 0;
    const { negamax } = helpers.createNegamax({
      endgameMode: false,
      deadlineMs: null,
      readNowMs: () => 0,
      nodeBudget: 20,
      readVisited: () => visited,
      incrementVisited: () => { visited += 1; },
      markBudgetHit: () => undefined,
      markTimeHit: () => undefined,
      transposition: new Map(),
      transpositionLimit: 100,
      level: 6,
      boardBonusByCell: null,
      branchLimit: null,
      shouldStop: () => false
    });

    expect(negamax([] as any, 1, 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false, Object.create(null))).toBe(-30);
  });

  test('uses full plan scoring before applying the internal branch limit', () => {
    const moves = [
      { id: 'a', row: 0, col: 0, flips: [] },
      { id: 'b', row: 1, col: 0, flips: [] },
      { id: 'c', row: 2, col: 0, flips: [] }
    ] as any[];
    const searchOrder = createCpuPolicySearchOrder({
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveForCornerEdgePlan: (move: any) => (
        move.id === 'c' ? 1000 : 0
      ),
      scoreMoveHeuristic: () => 0,
      getMoveChargeGain: () => 0,
      inBoard: () => false
    });
    const helpers = createCpuPolicyLookaheadNegamax({
      evaluateBoardForLookahead: (board: any) => (
        board?.tag === 'c' ? -100 : 0
      ),
      buildBoardSearchKey: () => '',
      getLegalMovesBasic: () => moves,
      buildSearchMoveOrder: searchOrder.buildSearchMoveOrder,
      applyMoveToBoard: (_board: any, move: any) => ({ tag: move.id })
    });
    let visited = 0;
    const { negamax } = helpers.createNegamax({
      endgameMode: false,
      deadlineMs: null,
      readNowMs: () => 0,
      nodeBudget: 20,
      readVisited: () => visited,
      incrementVisited: () => { visited += 1; },
      markBudgetHit: () => undefined,
      markTimeHit: () => undefined,
      transposition: new Map(),
      transpositionLimit: 100,
      level: 6,
      boardBonusByCell: null,
      branchLimit: 2,
      shouldStop: () => false
    });

    expect(negamax({ tag: 'root' } as any, 1, 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false, Object.create(null))).toBe(100);
  });
});
