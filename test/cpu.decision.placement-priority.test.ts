const { createCpuDecisionPlacementPriority } = require('../game/cpu-decision-placement-priority');

function makeBoard(rows: number[][]): number[][] {
  return rows.map((row) => row.slice());
}

function createPriorityFor(board: number[][], pendingType: string | null) {
  return createCpuDecisionPlacementPriority({
    buildMovePlanContext: () => null,
    cpuDebugLog: jest.fn(),
    getBoardCellValueSafe: (boardRef: number[][], row: number, col: number) => {
      if (!Array.isArray(boardRef) || !Array.isArray(boardRef[row])) return null;
      return boardRef[row][col] === undefined ? null : boardRef[row][col];
    },
    getCornerProximity: () => null,
    getCpuPolicyCore: () => null,
    getCurrentCpuBoard: () => board,
    getMoveOpponentSpecialFlipProfile: () => null,
    isCornerCell: (row: number, col: number, boardRef?: number[][]) => {
      const activeBoard = boardRef || board;
      return row === 0 || row === activeBoard.length - 1
        ? col === 0 || col === activeBoard[row].length - 1
        : false;
    },
    isEdgeCell: (row: number, col: number, boardRef?: number[][]) => {
      const activeBoard = boardRef || board;
      return row === 0 || col === 0 || row === activeBoard.length - 1 || col === activeBoard[row].length - 1;
    },
    resolvePendingType: () => pendingType,
    shouldRespectPendingPlacementPlanStrictly: () => false
  });
}

describe('cpu decision placement priority', () => {
  const boardWithEnemyCluster = makeBoard([
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, -1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0]
  ]);

  test.each([
    'ULTIMATE_REVERSE_DRAGON',
    'ULTIMATE_DESTROY_GOD'
  ])('%s keeps enemy-adjacent placement candidates ahead of empty corners', (pendingType) => {
    const corner = { row: 0, col: 0, flips: [] };
    const enemyAdjacent = { row: 4, col: 5, flips: [] };
    const otherInner = { row: 6, col: 6, flips: [] };
    const priority = createPriorityFor(boardWithEnemyCluster, pendingType);

    const filtered = priority.filterMovesByLv6PlacementPriority('white', 6, [corner, enemyAdjacent, otherInner]);

    expect(filtered).toEqual([enemyAdjacent]);
  });

  test('non-ultimate-dragon pending still prioritizes available corners', () => {
    const corner = { row: 0, col: 0, flips: [] };
    const enemyAdjacent = { row: 4, col: 5, flips: [] };
    const priority = createPriorityFor(boardWithEnemyCluster, 'WORK_WILL');

    const filtered = priority.filterMovesByLv6PlacementPriority('white', 6, [enemyAdjacent, corner]);

    expect(filtered).toEqual([corner]);
  });
});
