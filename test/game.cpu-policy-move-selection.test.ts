import { createCpuPolicyMoveSelection } from '../game/ai/cpu-policy-move-selection';

describe('cpu-policy move selection module', () => {
  test('computeLegalMoveMetrics aggregates flips, gain, and board bonus', () => {
    const helpers = createCpuPolicyMoveSelection();
    const metrics = helpers.computeLegalMoveMetrics([
      { row: 1, col: 1, flips: [{}, {}] } as any,
      { row: 2, col: 2, flips: [{}] } as any
    ], (row: number, col: number) => (row === 2 && col === 2 ? 3 : 0));

    expect(metrics).toEqual({
      maxLegalFlips: 2,
      avgLegalFlips: 1.5,
      maxLegalGain: 4,
      maxLegalBoardBonus: 3
    });
  });

  test('rankMoves uses learned score, heuristic score, and stable tie-break', () => {
    const a = { id: 'a', row: 4, col: 4 } as any;
    const b = { id: 'b', row: 1, col: 1 } as any;
    const helpers = createCpuPolicyMoveSelection({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveHeuristic: (move: any) => (move.id === 'a' ? 1 : 0)
    });

    const ranked = helpers.rankMoves([a, b], 4, {
      enableHeuristic: true,
      scoreMove: (move: any) => (move.id === 'b' ? 3 : 0)
    } as any);

    expect(ranked).toEqual([b, a]);
  });
});
