import { createCpuPolicyMovePlanScoring } from '../game/ai/cpu-policy-move-plan-scoring';

describe('cpu-policy move plan scoring module', () => {
  function placementFeature(overrides: Record<string, unknown> = {}) {
    return {
      row: 0,
      col: 0,
      playerValue: 1,
      seat: 'edge',
      isCorner: false,
      isEdge: true,
      isInner: false,
      isCSquare: false,
      isXSquare: false,
      isOpenCornerAdjacentRisk: false,
      cornerTaken: false,
      cornerDonation: false,
      opponentNextCorner: false,
      opponentCornerReplyCount: 0,
      ownSafeEdgeRunBefore: 0,
      ownSafeEdgeRunAfter: 0,
      ownSafeEdgeRunDelta: 0,
      ownAnchoredEdgeBefore: 0,
      ownAnchoredEdgeAfter: 0,
      ownAnchoredEdgeDelta: 0,
      extendsOwnSafeEdge: false,
      opponentSafeEdgeRunBefore: 0,
      opponentSafeEdgeRunAfter: 0,
      opponentSafeEdgeRunDelta: 0,
      opponentSafeEdgeRunAllowedCount: 0,
      allowsOpponentSafeEdgeRun: false,
      breaksOpponentEdgeRun: false,
      ownEdgeGapBefore: 0,
      ownEdgeGapAfter: 0,
      ownEdgeGapDelta: 0,
      createsOwnEdgeGap: false,
      boardBonus: 0,
      flipCount: 0,
      ownDiscCountAfter: 12,
      ownLegalMovesAfter: 4,
      hasCornerEscape: false,
      lowMobilityRisk: false,
      badLowMobilityRisk: false,
      ...overrides,
    };
  }

  test('evaluateImmediateCornerDonation reports opponent corner reply after simulated move', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const afterBoard = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const helpers = createCpuPolicyMovePlanScoring({
      inBoard: () => true,
      applyMoveToBoard: () => afterBoard,
      countCornerMovesFor: (currentBoard: any) => (currentBoard === afterBoard ? 2 : 0)
    });

    expect(helpers.evaluateImmediateCornerDonation(board, { row: 3, col: 3 } as any, 1)).toEqual({
      oppCornerMoves: 2,
      donatesCornerNow: true
    });
  });

  test('scoreMoveForCornerEdgePlan rewards board bonus tiles over plain tiles under equal heuristics', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const helpers = createCpuPolicyMovePlanScoring({
      inBoard: () => true,
      scoreMoveHeuristic: () => 100,
      getBoardBonusAtCell: (_bonusMap: any, _consumed: any, row: number, col: number) => (row === 2 && col === 2 ? 3 : 0),
      applyMoveToBoard: (currentBoard: any) => currentBoard,
      getLegalMovesBasic: () => [],
      countBoardDiscsForPlayer: () => ({ empties: 20 })
    });

    const plain = helpers.scoreMoveForCornerEdgePlan({ row: 1, col: 1, flips: [] } as any, {
      board,
      playerValue: 1,
      level: 4
    } as any);
    const bonus = helpers.scoreMoveForCornerEdgePlan({ row: 2, col: 2, flips: [] } as any, {
      board,
      playerValue: 1,
      level: 4,
      boardBonusByCell: { '2,2': 3 }
    } as any);

    expect(bonus).toBeGreaterThan(plain);
  });

  test('scoreMoveForCornerEdgePlan prefers safe anchored edge over edge gap under equal heuristics', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const afterBoard = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const helpers = createCpuPolicyMovePlanScoring({
      inBoard: () => true,
      scoreMoveHeuristic: () => 100,
      isCorner: () => false,
      isEdge: () => true,
      applyMoveToBoard: () => afterBoard,
      getLegalMovesBasic: () => [{ row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }] as any,
      countCornerMovesFor: () => 0,
      countBoardDiscsForPlayer: () => ({ empties: 28 }),
      summarizeEdgeRunsFor: () => ({}),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      evaluatePlacementCandidate: (move: any) => (
        move.col === 2
          ? placementFeature({
            row: move.row,
            col: move.col,
            extendsOwnSafeEdge: true,
            ownAnchoredEdgeDelta: 3,
            ownSafeEdgeRunDelta: 3,
          })
          : placementFeature({
            row: move.row,
            col: move.col,
            createsOwnEdgeGap: true,
            ownEdgeGapDelta: 3,
            allowsOpponentSafeEdgeRun: true,
            opponentSafeEdgeRunAllowedCount: 1,
            opponentSafeEdgeRunDelta: 3,
          })
      ),
    } as any);

    const safeEdge = helpers.scoreMoveForCornerEdgePlan({ row: 0, col: 2, flips: [] } as any, {
      board,
      playerValue: 1,
      level: 6,
    } as any);
    const gapEdge = helpers.scoreMoveForCornerEdgePlan({ row: 0, col: 4, flips: [] } as any, {
      board,
      playerValue: 1,
      level: 6,
    } as any);

    expect(safeEdge).toBeGreaterThan(gapEdge + 3000);
  });

  test('scoreMoveForCornerEdgePlan heavily penalizes explainable corner donation when alternatives exist', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const afterBoard = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const helpers = createCpuPolicyMovePlanScoring({
      inBoard: () => true,
      scoreMoveHeuristic: () => 100,
      isCorner: () => false,
      isEdge: () => false,
      applyMoveToBoard: () => afterBoard,
      getLegalMovesBasic: () => [{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 3 }] as any,
      countCornerMovesFor: () => 0,
      countBoardDiscsForPlayer: () => ({ empties: 28 }),
      summarizeEdgeRunsFor: () => ({}),
      countAnchoredEdgeDiscsFromCorners: () => 0,
      evaluatePlacementCandidate: (move: any) => (
        move.col === 1
          ? placementFeature({
            row: move.row,
            col: move.col,
            seat: 'x',
            isEdge: false,
            isXSquare: true,
            cornerDonation: true,
            opponentNextCorner: true,
            opponentCornerReplyCount: 1,
            isOpenCornerAdjacentRisk: true,
          })
          : placementFeature({
            row: move.row,
            col: move.col,
            seat: 'inner',
            isEdge: false,
            isInner: true,
          })
      ),
    } as any);

    const safeInner = helpers.scoreMoveForCornerEdgePlan({ row: 3, col: 3, flips: [] } as any, {
      board,
      playerValue: 1,
      level: 6,
    } as any);
    const donation = helpers.scoreMoveForCornerEdgePlan({ row: 1, col: 1, flips: [] } as any, {
      board,
      playerValue: 1,
      level: 6,
    } as any);

    expect(safeInner).toBeGreaterThan(donation + 12000);
  });
});
