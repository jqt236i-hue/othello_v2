import { createCpuPolicyBoardPrimitives } from '../game/ai/cpu-policy-board-primitives';
const SharedBoardUtils = require('../shared/shared-board-utils');

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
    expect(cornerScore).toBe(15600);
    expect(edgeScore).toBe(600);
    expect(xScore).toBe(-1800);
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

  test('applyMoveToBoard accepts canonical tuple flips from GameCore', () => {
    const primitives = createCpuPolicyBoardPrimitives({ SharedBoardUtils });
    const board = [
      [0, 0, 0],
      [0, -1, 0],
      [0, 0, 0],
    ] as any;

    const out = primitives.applyMoveToBoard(board, {
      row: 0,
      col: 1,
      flips: [[1, 1]],
    } as any, 1);

    expect(out[0][1]).toBe(1);
    expect(out[1][1]).toBe(1);
    expect(board[1][1]).toBe(-1);
  });

  test('applyMoveToBoard keeps explicit empty flips distinct from omitted flips', () => {
    const primitives = createCpuPolicyBoardPrimitives({ SharedBoardUtils });
    const board = [
      [1, -1, 0],
      [0, 0, 0],
      [0, 0, 0],
    ] as any;

    const explicitEmpty = primitives.applyMoveToBoard(board, {
      row: 0,
      col: 2,
      flips: [],
    } as any, 1);
    const omitted = primitives.applyMoveToBoard(board, {
      row: 0,
      col: 2,
    } as any, 1);

    expect(explicitEmpty[0]).toEqual([1, -1, 1]);
    expect(omitted[0]).toEqual([1, 1, 1]);
  });

  test('applyMoveToBoard resolves omitted flips before placing the stone', () => {
    const setCellValues = jest.fn(SharedBoardUtils.setCellValues);
    const primitives = createCpuPolicyBoardPrimitives({
      SharedBoardUtils: {
        ...SharedBoardUtils,
        setCellValues,
      },
    });
    const board = [
      [1, -1, 0],
      [0, 0, 0],
      [0, 0, 0],
    ] as any;

    const out = primitives.applyMoveToBoard(board, {
      row: 0,
      col: 2,
    } as any, 1);

    expect(out).toEqual([
      [1, 1, 1],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(board[0]).toEqual([1, -1, 0]);
    expect(setCellValues).toHaveBeenCalledTimes(1);
  });

  test('applyMoveToBoard batches omitted flips across expansion cells without mutating the source', () => {
    const primitives = createCpuPolicyBoardPrimitives({ SharedBoardUtils });
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: {
        cells: [
          { side: 'right', row: 1, col: 4, owner: -1 },
          { side: 'right', row: 1, col: 5, owner: 0 },
        ],
      },
    };
    gameState.board[1][3] = 1;
    const source = SharedBoardUtils.createBoardContext(gameState, { markers: [] });

    const out = primitives.applyMoveToBoard(source as any, {
      row: 1,
      col: 5,
    } as any, 1) as any;

    expect(SharedBoardUtils.getCellValue(source, 1, 4)).toBe(-1);
    expect(SharedBoardUtils.getCellValue(source, 1, 5)).toBe(0);
    expect(SharedBoardUtils.getCellValue(out, 1, 4)).toBe(1);
    expect(SharedBoardUtils.getCellValue(out, 1, 5)).toBe(1);
  });

  test('applyMoveToBoard applies tuple flips across expansion cells', () => {
    const primitives = createCpuPolicyBoardPrimitives({ SharedBoardUtils });
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: {
        cells: [
          { side: 'right', row: 1, col: 4, owner: -1 },
          { side: 'right', row: 1, col: 5, owner: 0 },
        ],
      },
    };
    const source = SharedBoardUtils.createBoardContext(gameState, { markers: [] });

    const out = primitives.applyMoveToBoard(source as any, {
      row: 1,
      col: 5,
      flips: [[1, 4]],
    } as any, 1) as any;

    expect(SharedBoardUtils.getCellValue(out, 1, 4)).toBe(1);
    expect(SharedBoardUtils.getCellValue(out, 1, 5)).toBe(1);
    expect(SharedBoardUtils.getCellValue(source, 1, 4)).toBe(-1);
  });

  test('applyMoveToBoard fails fast when the atomic board update is rejected', () => {
    const board = [
      [0, 0],
      [0, 0],
    ] as any;
    const primitives = createCpuPolicyBoardPrimitives({
      SharedBoardUtils: {
        ...SharedBoardUtils,
        setCellValues: jest.fn(() => false),
      },
    });

    expect(() => primitives.applyMoveToBoard(board, {
      row: 0,
      col: 0,
      flips: [],
    } as any, 1)).toThrow(/rejected an atomic move update/);
    expect(board).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  test('getFlipsBasic and getLegalMovesBasic prefer the shape-aware shared runtime', () => {
    const SharedBoardUtils = {
      getFlipsBasic: jest.fn(() => [{ row: 1, col: 1 }]),
      getLegalMovesBasic: jest.fn(() => [{ row: 2, col: 3, flips: [] }])
    } as any;
    const OthelloCore = {
      getFlipsBasic: jest.fn(() => {
        throw new Error('dense fallback must not win');
      }),
      getLegalMovesBasic: jest.fn(() => {
        throw new Error('dense fallback must not win');
      })
    } as any;
    const primitives = createCpuPolicyBoardPrimitives({ SharedBoardUtils, OthelloCore });
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));

    expect(primitives.getFlipsBasic(board as any, 2, 3, 1)).toEqual([{ row: 1, col: 1 }]);
    expect(primitives.getLegalMovesBasic(board as any, 1)).toEqual([{ row: 2, col: 3, flips: [] }]);
    expect(SharedBoardUtils.getFlipsBasic).toHaveBeenCalledWith(board, 2, 3, 1);
    expect(SharedBoardUtils.getLegalMovesBasic).toHaveBeenCalledWith(board, 1);
    expect(OthelloCore.getFlipsBasic).not.toHaveBeenCalled();
    expect(OthelloCore.getLegalMovesBasic).not.toHaveBeenCalled();
  });
});
