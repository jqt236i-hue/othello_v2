import {
  chooseTimeBombTargetWithPolicy,
  scoreTimeBombTarget
} from '../game/ai/cpu-policy-time-bomb-targets';

function makeBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function createDeps(board: number[][], overrides: Record<string, unknown> = {}) {
  return {
    getCurrentCpuBoard: () => board,
    getBoardCellValueSafe: (boardRef: number[][], row: number, col: number) => boardRef[row]?.[col] ?? null,
    resolvePlayerValue: (playerKey: string) => (playerKey === 'black' ? 1 : -1),
    countBoardStatsForPlayer: () => ({ discDiff: 0 }),
    isCornerCell: (row: number, col: number) => (row === 0 || row === 7) && (col === 0 || col === 7),
    isEdgeCell: (row: number, col: number) => row === 0 || row === 7 || col === 0 || col === 7,
    getMarkerProfileAt: () => ({ ownSpecialScore: 0, oppSpecialScore: 0, ownBombCount: 0, oppBombCount: 0 }),
    getTimedMarkerProfileAt: () => ({ ownRemainingSum: 0, oppRemainingSum: 0 }),
    random: () => 0,
    ...overrides
  };
}

describe('cpu policy time bomb targets', () => {
  test('scores opponent corner blast higher than own corner blast', () => {
    const board = makeBoard();
    board[0][0] = 1;
    board[7][7] = -1;

    const opponentCorner = scoreTimeBombTarget('white', { row: 0, col: 1 }, createDeps(board));
    const ownCorner = scoreTimeBombTarget('white', { row: 7, col: 6 }, createDeps(board));

    expect(opponentCorner).toBeGreaterThan(ownCorner);
  });

  test('adds marker and timed profile value for opponent targets', () => {
    const board = makeBoard();
    board[3][3] = 1;
    const plain = scoreTimeBombTarget('white', { row: 3, col: 3 }, createDeps(board));
    const marked = scoreTimeBombTarget('white', { row: 3, col: 3 }, createDeps(board, {
      getMarkerProfileAt: () => ({ ownSpecialScore: 0, oppSpecialScore: 280, ownBombCount: 0, oppBombCount: 1 }),
      getTimedMarkerProfileAt: () => ({ ownRemainingSum: 0, oppRemainingSum: 3 })
    }));

    expect(marked).toBeGreaterThan(plain);
  });

  test('chooses the highest scored target deterministically', () => {
    const board = makeBoard();
    board[0][0] = 1;
    board[3][3] = 1;
    const targets = [{ row: 3, col: 3 }, { row: 0, col: 1 }];

    expect(chooseTimeBombTargetWithPolicy('white', targets, createDeps(board))).toEqual({ row: 0, col: 1 });
  });
});
