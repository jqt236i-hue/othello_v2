import { createCpuPolicySearchOrder } from '../game/ai/cpu-policy-search-order';

describe('cpu-policy search order module', () => {
  test('sorts by plan, gain, prior, and branch limit', () => {
    const helpers = createCpuPolicySearchOrder({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveForCornerEdgePlan: (move: any) => ({ a: 10, b: 30, c: 20 } as any)[move.id] || 0,
      scoreMoveHeuristic: () => 0,
      getMoveChargeGain: (move: any) => ({ a: 0, b: 0, c: 1 } as any)[move.id] || 0,
      normalizePriorScore: (score: unknown) => Number(score) || 0,
      inBoard: () => false,
      applyMoveToBoard: (board: any) => board,
      getLegalMovesBasic: () => [],
      countCornerMovesFor: () => 0,
      countFrontierDiscsFor: () => 0
    });
    const moves = [
      { id: 'a', row: 2, col: 2 },
      { id: 'b', row: 1, col: 1 },
      { id: 'c', row: 0, col: 0 }
    ] as any;

    expect(helpers.buildSearchMoveOrder(moves, {
      level: 5,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      playerValue: 1,
      rootPriorScoreFn: (move: any) => ({ a: 1, b: 0, c: 0 } as any)[move.id] || 0,
      priorWeight: 10,
      branchLimit: 2
    } as any).map((move: any) => move.id)).toEqual(['c', 'b']);
  });

  test('falls back to heuristic score when plan scoring throws', () => {
    const helpers = createCpuPolicySearchOrder({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveForCornerEdgePlan: () => { throw new Error('boom'); },
      scoreMoveHeuristic: (move: any) => ({ a: 2, b: 5 } as any)[move.id] || 0,
      getMoveChargeGain: () => 0,
      normalizePriorScore: (score: unknown) => Number(score) || 0,
      inBoard: () => false,
      applyMoveToBoard: (board: any) => board,
      getLegalMovesBasic: () => [],
      countCornerMovesFor: () => 0,
      countFrontierDiscsFor: () => 0
    });

    expect(helpers.buildSearchMoveOrder([
      { id: 'a', row: 2, col: 2 },
      { id: 'b', row: 1, col: 1 }
    ] as any, {
      level: 5,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      playerValue: 1
    } as any).map((move: any) => move.id)).toEqual(['b', 'a']);
  });

  test('tactical preview can override lower plan score at level 6', () => {
    const afterById = new Map<string, any>([
      ['a', { tag: 'after-a' }],
      ['b', { tag: 'after-b' }]
    ]);
    const helpers = createCpuPolicySearchOrder({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveForCornerEdgePlan: (move: any) => ({ a: 100, b: 80 } as any)[move.id] || 0,
      scoreMoveHeuristic: () => 0,
      getMoveChargeGain: () => 0,
      normalizePriorScore: (score: unknown) => Number(score) || 0,
      inBoard: () => true,
      applyMoveToBoard: (_board: any, move: any) => afterById.get(move.id),
      getLegalMovesBasic: (board: any, playerValue: number) => {
        if (board?.tag === 'after-a' && playerValue < 0) return Array.from({ length: 10 }, () => ({ row: 0, col: 0 }));
        if (board?.tag === 'after-b' && playerValue < 0) return Array.from({ length: 1 }, () => ({ row: 0, col: 0 }));
        return [];
      },
      countCornerMovesFor: (board: any, playerValue: number) => {
        if (board?.tag === 'after-a' && playerValue < 0) return 1;
        if (board?.tag === 'after-b' && playerValue < 0) return 0;
        return 0;
      },
      countFrontierDiscsFor: (board: any, playerValue: number) => {
        if (board?.tag === 'after-a') return playerValue > 0 ? 4 : 1;
        if (board?.tag === 'after-b') return playerValue > 0 ? 1 : 4;
        return 0;
      }
    });

    expect(helpers.buildSearchMoveOrder([
      { id: 'a', row: 2, col: 2 },
      { id: 'b', row: 3, col: 3 }
    ] as any, {
      level: 6,
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      playerValue: 1
    } as any).map((move: any) => move.id)[0]).toBe('b');
  });
});
