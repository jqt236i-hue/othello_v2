import { createCpuPolicyPlacementProfiles } from '../game/ai/cpu-policy-placement-profiles';

describe('cpu-policy placement profiles module', () => {
  test('computePlacementStabilityProxy prefers corners over inner cells', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const helpers = createCpuPolicyPlacementProfiles({
      getBoardCellValueSafe: (currentBoard: any, row: number, col: number) => (currentBoard[row] && currentBoard[row][col] !== undefined ? currentBoard[row][col] : null),
      inBoard: (_board: any, row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8,
      isCorner: (row: number, col: number) => (row === 0 || row === 7) && (col === 0 || col === 7),
      isEdge: (row: number, col: number) => row === 0 || row === 7 || col === 0 || col === 7,
      isXSquare: () => false,
      isCSquare: () => false,
      adjacentCornerFor: () => null
    });

    const corner = helpers.computePlacementStabilityProxy(board, 0, 0, 1);
    const inner = helpers.computePlacementStabilityProxy(board, 3, 3, 1);

    expect(corner).toBeGreaterThan(inner);
  });

  test('evaluateMoveStabilityProfile returns anchored edge delta from simulated board', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const afterBoard = Array.from({ length: 8 }, () => Array(8).fill(0)) as any;
    const helpers = createCpuPolicyPlacementProfiles({
      getBoardCellValueSafe: (currentBoard: any, row: number, col: number) => (currentBoard[row] && currentBoard[row][col] !== undefined ? currentBoard[row][col] : null),
      inBoard: (_board: any, row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8,
      isCorner: () => false,
      isEdge: () => true,
      isXSquare: () => false,
      isCSquare: () => false,
      adjacentCornerFor: () => null,
      applyMoveToBoard: () => afterBoard,
      countAnchoredEdgeDiscsFromCorners: (currentBoard: any) => (currentBoard === afterBoard ? 5 : 2)
    });

    const out = helpers.evaluateMoveStabilityProfile(board, { row: 2, col: 5 } as any, 1, 2);

    expect(out.anchoredEdgeDelta).toBe(3);
    expect(Number.isFinite(out.stabilityProxy)).toBe(true);
  });
});
