import { createCpuPolicyLookaheadGuards } from '../game/ai/cpu-policy-lookahead-guards';

describe('cpu-policy lookahead guards module', () => {
  const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;

  test('always upgrades to a corner when one exists', () => {
    const inner = { id: 'inner', row: 2, col: 2 } as any;
    const corner = { id: 'corner', row: 0, col: 0 } as any;
    const guards = createCpuPolicyLookaheadGuards({
      isCorner: (row: number, col: number) => row === 0 && col === 0,
      isEdge: () => false,
      countCornersFor: () => 0,
      evaluateImmediateCornerDonation: () => ({ oppCornerMoves: 0, donatesCornerNow: false }),
      evaluateMoveStabilityProfile: () => ({ anchoredEdgeDelta: 0, stabilityProxy: 0 }),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      buildSearchMoveOrder: () => [inner, corner]
    });

    expect(guards.applyLookaheadHardGuards({
      bestMove: inner,
      candidateMoves: [inner, corner],
      level: 6,
      board,
      playerValue: 1,
      boardBonusByCell: null,
      baseConsumedMap: null,
      priorFn: null,
      priorWeight: 120
    })?.id).toBe('corner');
  });

  test('replaces an immediate corner donation with a safe alternative', () => {
    const risky = { id: 'risky', row: 2, col: 2 } as any;
    const safe = { id: 'safe', row: 2, col: 3 } as any;
    const guards = createCpuPolicyLookaheadGuards({
      isCorner: () => false,
      isEdge: () => false,
      countCornersFor: () => 0,
      evaluateImmediateCornerDonation: (_board: any, move: any) => ({
        oppCornerMoves: move.id === 'risky' ? 1 : 0,
        donatesCornerNow: move.id === 'risky'
      }),
      evaluateMoveStabilityProfile: () => ({ anchoredEdgeDelta: 0, stabilityProxy: 0 }),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      buildSearchMoveOrder: () => [risky, safe]
    });

    expect(guards.applyLookaheadHardGuards({
      bestMove: risky,
      candidateMoves: [risky, safe],
      level: 6,
      board,
      playerValue: 1,
      boardBonusByCell: null,
      baseConsumedMap: null,
      priorFn: null,
      priorWeight: 120
    })?.id).toBe('safe');
  });

  test('while leading corners, prefers a meaningfully more stable edge', () => {
    const inner = { id: 'inner', row: 2, col: 2 } as any;
    const edge = { id: 'edge', row: 0, col: 3 } as any;
    const guards = createCpuPolicyLookaheadGuards({
      isCorner: () => false,
      isEdge: (row: number) => row === 0,
      countCornersFor: (_board: any, playerValue: number) => (playerValue > 0 ? 2 : 1),
      evaluateImmediateCornerDonation: () => ({ oppCornerMoves: 0, donatesCornerNow: false }),
      evaluateMoveStabilityProfile: (_board: any, move: any) => (
        move.id === 'edge'
          ? { anchoredEdgeDelta: 1, stabilityProxy: 2 }
          : { anchoredEdgeDelta: 0, stabilityProxy: 0 }
      ),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      buildSearchMoveOrder: () => [inner, edge]
    });

    expect(guards.applyLookaheadHardGuards({
      bestMove: inner,
      candidateMoves: [inner, edge],
      level: 6,
      board,
      playerValue: 1,
      boardBonusByCell: null,
      baseConsumedMap: null,
      priorFn: null,
      priorWeight: 120
    })?.id).toBe('edge');
  });

  test('without available corners, prefers a safe edge over an inner move', () => {
    const inner = { id: 'inner', row: 2, col: 2 } as any;
    const edge = { id: 'edge', row: 0, col: 4 } as any;
    const guards = createCpuPolicyLookaheadGuards({
      isCorner: () => false,
      isEdge: (row: number) => row === 0,
      countCornersFor: () => 1,
      evaluateImmediateCornerDonation: () => ({ oppCornerMoves: 0, donatesCornerNow: false }),
      evaluateMoveStabilityProfile: (_board: any, move: any) => (
        move.id === 'edge'
          ? { anchoredEdgeDelta: 1, stabilityProxy: 0 }
          : { anchoredEdgeDelta: 0, stabilityProxy: 0 }
      ),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      buildSearchMoveOrder: () => [inner, edge]
    });

    expect(guards.applyLookaheadHardGuards({
      bestMove: inner,
      candidateMoves: [inner, edge],
      level: 6,
      board,
      playerValue: 1,
      boardBonusByCell: null,
      baseConsumedMap: null,
      priorFn: null,
      priorWeight: 120
    })?.id).toBe('edge');
  });
});
