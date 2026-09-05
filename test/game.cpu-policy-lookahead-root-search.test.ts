import { createCpuPolicyLookaheadRootSearch } from '../game/ai/cpu-policy-lookahead-root-search';

describe('cpu-policy lookahead root search module', () => {
  test.each([4, 5, 6])('keeps the fully compared move when a deeper iteration stops at call %i', (stopAt) => {
    let calls = 0;
    const helpers = createCpuPolicyLookaheadRootSearch({
      applyMoveToBoard: (_board: any, move: any) => ({ id: move.id })
    });
    const moves = [
      { id: 'a', row: 2, col: 2 },
      { id: 'b', row: 3, col: 3 },
      { id: 'c', row: 4, col: 4 }
    ] as any;
    const out = helpers.runLookaheadRootSearch({
      orderedRootBase: moves, depth: 8, endgameMode: false, board: [] as any,
      playerValue: 1, boardBonusByCell: null, baseConsumedMap: {},
      priorFn: null, priorWeight: 0, searchWeight: 1,
      negamax: (board: any, _player, depth) => {
        calls += 1;
        if (depth === 3) return board.id === 'b' ? -100 : -50;
        return board.id === 'b' ? -10 : -1000;
      },
      shouldStop: () => calls >= stopAt
    });
    expect(out.bestMove.id).toBe('b');
    expect(out.bestScore).toBe(100);
    expect(calls).toBe(stopAt);
  });

  test('single-depth search uses row/col tie-break on equal totals', () => {
    const afterById = new Map<string, any>([
      ['a', { id: 'after-a' }],
      ['b', { id: 'after-b' }]
    ]);
    const helpers = createCpuPolicyLookaheadRootSearch({
      getMoveChargeGain: () => 0,
      getBoardBonusAtCell: () => 0,
      consumeBonusCell: (map: any) => map,
      applyMoveToBoard: (_board: any, move: any) => afterById.get(move.id),
      normalizePriorScore: (score: unknown) => Number(score) || 0
    });
    const moves = [
      { id: 'a', row: 4, col: 4 },
      { id: 'b', row: 1, col: 1 }
    ] as any;

    const out = helpers.runLookaheadRootSearch({
      orderedRootBase: moves,
      depth: 4,
      endgameMode: true,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)) as any,
      playerValue: 1,
      boardBonusByCell: null,
      baseConsumedMap: Object.create(null),
      priorFn: null,
      priorWeight: 120,
      searchWeight: 1,
      negamax: () => -100,
      shouldStop: () => false
    });

    expect(out.bestMove && (out.bestMove as any).id).toBe('b');
  });

  test('iterative search reorders root moves around the last winning move', () => {
    const callOrder: string[] = [];
    const helpers = createCpuPolicyLookaheadRootSearch({
      getMoveChargeGain: () => 0,
      getBoardBonusAtCell: () => 0,
      consumeBonusCell: (map: any) => map,
      applyMoveToBoard: (_board: any, move: any) => ({ id: move.id }),
      normalizePriorScore: (score: unknown) => Number(score) || 0
    });
    const moves = [
      { id: 'a', row: 3, col: 3 },
      { id: 'b', row: 2, col: 2 },
      { id: 'c', row: 1, col: 1 }
    ] as any;

    const out = helpers.runLookaheadRootSearch({
      orderedRootBase: moves,
      depth: 8,
      endgameMode: false,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)) as any,
      playerValue: 1,
      boardBonusByCell: null,
      baseConsumedMap: Object.create(null),
      priorFn: null,
      priorWeight: 120,
      searchWeight: 1,
      negamax: (boardNode: any) => {
        callOrder.push(boardNode.id);
        return boardNode.id === 'b' ? -100 : -50;
      },
      shouldStop: () => false
    });

    expect(out.bestMove && (out.bestMove as any).id).toBe('b');
    expect(callOrder.slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(callOrder.slice(3, 6)).toEqual(['b', 'a', 'c']);
  });

  test('stops early when shouldStop becomes true', () => {
    let count = 0;
    const helpers = createCpuPolicyLookaheadRootSearch({
      getMoveChargeGain: () => 0,
      getBoardBonusAtCell: () => 0,
      consumeBonusCell: (map: any) => map,
      applyMoveToBoard: (_board: any, move: any) => ({ id: move.id }),
      normalizePriorScore: (score: unknown) => Number(score) || 0
    });
    const moves = [
      { id: 'a', row: 3, col: 3 },
      { id: 'b', row: 2, col: 2 }
    ] as any;

    const out = helpers.runLookaheadRootSearch({
      orderedRootBase: moves,
      depth: 4,
      endgameMode: true,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)) as any,
      playerValue: 1,
      boardBonusByCell: null,
      baseConsumedMap: Object.create(null),
      priorFn: null,
      priorWeight: 120,
      searchWeight: 1,
      negamax: (boardNode: any) => {
        count += 1;
        return boardNode.id === 'a' ? -200 : -100;
      },
      shouldStop: () => count >= 1
    });

    expect(out.bestMove && (out.bestMove as any).id).toBe('a');
    expect(count).toBe(1);
  });
});
