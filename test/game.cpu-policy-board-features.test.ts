import { createCpuPolicyBoardFeatures } from '../game/ai/cpu-policy-board-features';

describe('cpu-policy board features module', () => {
  test('prefers injected SharedBoardUtils helpers when available', () => {
    const SharedBoardUtils = {
      countCornerControl: jest.fn(() => ({ ownCorners: 3 })),
      countEdgeControl: jest.fn(() => ({ ownEdges: 5 })),
      summarizeEdgeRuns: jest.fn(() => ({ totalLines: 2, longestRun: 4 })),
      countAdjacentLoneEdgeDiscs: jest.fn(() => 7)
    } as any;
    const helpers = createCpuPolicyBoardFeatures({ SharedBoardUtils });
    const board = [[1, 0, -1]] as any;

    expect(helpers.countCornersFor(board, 1)).toBe(3);
    expect(helpers.countEdgesFor(board, 1)).toBe(5);
    expect(helpers.summarizeEdgeRunsFor(board, 1)).toEqual({ totalLines: 2, longestRun: 4 });
    expect(helpers.countAdjacentLoneEdgeDiscsFor(board, 0, 1, -1)).toBe(7);
    expect(SharedBoardUtils.countCornerControl).toHaveBeenCalledWith(board, 1);
    expect(SharedBoardUtils.countEdgeControl).toHaveBeenCalledWith(board, 1);
    expect(SharedBoardUtils.summarizeEdgeRuns).toHaveBeenCalledWith(board, 1);
    expect(SharedBoardUtils.countAdjacentLoneEdgeDiscs).toHaveBeenCalledWith(board, 0, 1, -1);
  });

  test('fallback corner and edge counters handle rectangular boards', () => {
    const helpers = createCpuPolicyBoardFeatures();
    const board = [
      [1, 1, 0, -1],
      [1, 0, -1, -1],
      [1, 1, -1, -1]
    ] as any;

    expect(helpers.countCornersFor(board, 1)).toBe(2);
    expect(helpers.countEdgesFor(board, 1)).toBe(3);
    expect(helpers.countEdgesFor(board, -1)).toBe(2);
  });

  test('countXsAndCsFor ignores protected risky squares and normalizePriorScore keeps sign', () => {
    const helpers = createCpuPolicyBoardFeatures({
      isXSquare: (row: number, col: number) => row === 1 && col === 1,
      isCSquare: (row: number, col: number) => (row === 0 && col === 1) || (row === 1 && col === 0),
      hasOwnedAdjacentCorner: (_board: any, row: number, col: number) => row === 0 && col === 1
    });
    const board = [
      [1, 1],
      [1, 1]
    ] as any;

    expect(helpers.countXsAndCsFor(board, 1)).toEqual({ x: 1, c: 1 });
    expect(helpers.normalizePriorScore(0)).toBe(0);
    expect(helpers.normalizePriorScore(9)).toBeCloseTo(Math.log1p(9));
    expect(helpers.normalizePriorScore(-9)).toBeCloseTo(-Math.log1p(9));
  });

  test('countCornerMovesFor uses injected legal-move and corner predicates', () => {
    const getLegalMovesBasic = jest.fn(() => ([
      { row: 0, col: 0 },
      { row: 2, col: 2 },
      { row: 0, col: 3 }
    ]));
    const helpers = createCpuPolicyBoardFeatures({
      getLegalMovesBasic: getLegalMovesBasic as any,
      isCorner: (row: number, col: number) => (row === 0 && col === 0) || (row === 0 && col === 3)
    });
    const board = Array.from({ length: 4 }, () => Array(4).fill(0)) as any;

    expect(helpers.countCornerMovesFor(board, 1)).toBe(2);
    expect(getLegalMovesBasic).toHaveBeenCalledWith(board, 1);
    expect(helpers.summarizeEdgeRunsFor(board, 1)).toEqual({
      totalLines: 0,
      maxLineLength: 0,
      totalLineCells: 0,
      totalOwnedCells: 0,
      chainStrength: 0,
      longestRun: 0,
      longestRunShare: 0,
      completeLineCount: 0,
      segmentCount: 0,
      loneDiscCount: 0
    });
  });
});
