import {
  choosePendingTargetWithPolicy,
  getCornerProximity,
  getForcedCornerLaneAntiPatternPenalty,
  getForcedCornerLaneBonus,
  simulatePendingPlacementBoard
} from '../game/ai/cpu-policy-pending-targets';

function makeBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

describe('cpu policy pending targets', () => {
  test('detects X-square proximity to an open corner using shared board helpers', () => {
    const board = makeBoard();
    const boardUtils = {
      getCornerProximity: undefined,
      getCornerCells: () => [{ row: 0, col: 0 }, { row: 0, col: 7 }, { row: 7, col: 0 }, { row: 7, col: 7 }],
      isXSquare: (row: number, col: number) => row === 1 && col === 1,
      isCSquare: () => false
    };

    expect(getCornerProximity(1, 1, board, {
      resolveSharedBoardUtilsModule: () => boardUtils,
      getCurrentCpuBoard: () => board,
      getBoardCellValueSafe: (boardRef: number[][], row: number, col: number) => boardRef[row]?.[col] ?? null
    })).toEqual({ kind: 'X', corner: [0, 0] });
  });

  test('scores forced corner lane bonus and anti-pattern for buoyancy movement', () => {
    const board = makeBoard();
    board[3][0] = -1;
    const deps = {
      resolveSharedBoardUtilsModule: () => ({ resolveBoardBounds: () => ({ minRow: 0, maxRow: 7, minCol: 0, maxCol: 7 }) }),
      getBoardCellValueSafe: (boardRef: number[][], row: number, col: number) => boardRef[row]?.[col] ?? null
    };

    expect(getForcedCornerLaneBonus('BUOYANCY_WILL', 3, 0, board, -1, deps)).toBe(2600);
    expect(getForcedCornerLaneAntiPatternPenalty('BUOYANCY_WILL', 3, 0, board, 1, deps)).toBe(-5200);
  });

  test('simulates pending placement without mutating the source board', () => {
    const board = makeBoard();
    board[3][3] = 1;
    const next = simulatePendingPlacementBoard(board, -1, {
      row: 2,
      col: 3,
      flips: [{ row: 3, col: 3 }]
    }, {
      cloneBoardForCpu: (source: number[][]) => source.map((row) => row.slice()),
      setBoardCellValue: (source: number[][], row: number, col: number, value: number) => {
        source[row][col] = value;
        return true;
      }
    });

    expect(next).not.toBe(board);
    expect(next[2][3]).toBe(-1);
    expect(next[3][3]).toBe(-1);
    expect(board[3][3]).toBe(1);
  });

  test('chooses highest-scored pending target with row/col tie-break', () => {
    const targets = [{ row: 5, col: 5 }, { row: 2, col: 4 }, { row: 2, col: 3 }];
    const scores = new Map([
      ['5,5', 10],
      ['2,4', 20],
      ['2,3', 20]
    ]);

    expect(choosePendingTargetWithPolicy('white', 'DESTROY_ONE_STONE', targets, null, {
      scorePendingTargetByType: (_playerKey, _pendingType, target) => scores.get(`${target.row},${target.col}`) || 0
    })).toEqual({ row: 2, col: 3 });
  });
});
