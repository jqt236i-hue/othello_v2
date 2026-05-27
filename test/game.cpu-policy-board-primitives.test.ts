import { createCpuPolicyBoardPrimitives } from '../game/ai/cpu-policy-board-primitives';

describe('cpu-policy board primitives module', () => {
  test('resolves geometry and corner classes on non-square ragged boards', () => {
    const primitives = createCpuPolicyBoardPrimitives();
    const board = [
      [0, 0, 0, 0],
      [0, 0, 0],
      [0, 0, 0, 0, 0]
    ] as any;

    expect(primitives.resolveBoardGeometry(board)).toEqual({ maxR: 2, maxC: 4 });
    expect(primitives.isCorner(0, 0, board)).toBe(true);
    expect(primitives.isCorner(2, 4, board)).toBe(true);
    expect(primitives.isEdge(0, 2, board)).toBe(true);
    expect(primitives.isXSquare(1, 1, board)).toBe(true);
    expect(primitives.isCSquare(0, 1, board)).toBe(true);
  });

  test('scoreMoveHeuristic keeps corner and X-square weighting', () => {
    const primitives = createCpuPolicyBoardPrimitives();
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));

    const cornerScore = primitives.scoreMoveHeuristic({ row: 0, col: 0, flips: [] } as any, 6, board);
    const xScore = primitives.scoreMoveHeuristic({ row: 1, col: 1, flips: [] } as any, 6, board);
    const edgeScore = primitives.scoreMoveHeuristic({ row: 0, col: 3, flips: [] } as any, 6, board);

    expect(cornerScore).toBeGreaterThan(edgeScore);
    expect(edgeScore).toBeGreaterThan(xScore);
  });

  test('applyMoveToBoard clones and applies flips from provided move metadata', () => {
    const primitives = createCpuPolicyBoardPrimitives();
    const board = [
      [0, 0, 0],
      [0, -1, 0],
      [0, 0, 0]
    ] as any;

    const out = primitives.applyMoveToBoard(board, {
      row: 0,
      col: 1,
      flips: [{ row: 1, col: 1 }]
    } as any, 1);

    expect(board[0][1]).toBe(0);
    expect(board[1][1]).toBe(-1);
    expect(out).toEqual([
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 0]
    ]);
  });

  test('getFlipsBasic and getLegalMovesBasic prefer injected runtimes', () => {
    const OthelloCore = {
      getFlipsBasic: jest.fn(() => [{ row: 1, col: 1 }]),
      getLegalMovesBasic: jest.fn(() => [{ row: 2, col: 3, flips: [] }])
    } as any;
    const primitives = createCpuPolicyBoardPrimitives({ OthelloCore });
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));

    expect(primitives.getFlipsBasic(board as any, 2, 3, 1)).toEqual([{ row: 1, col: 1 }]);
    expect(primitives.getLegalMovesBasic(board as any, 1)).toEqual([{ row: 2, col: 3, flips: [] }]);
    expect(OthelloCore.getFlipsBasic).toHaveBeenCalledWith(board, 2, 3, 1);
    expect(OthelloCore.getLegalMovesBasic).toHaveBeenCalledWith(board, 1);
  });
});
