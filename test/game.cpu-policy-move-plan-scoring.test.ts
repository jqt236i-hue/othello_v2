import { createCpuPolicyMovePlanScoring } from '../game/ai/cpu-policy-move-plan-scoring';

describe('cpu-policy move plan scoring module', () => {
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
});
