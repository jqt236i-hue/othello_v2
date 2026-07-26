const helpers = require('../shared/commentary-context-helpers.ts');
const sharedBoardUtils = require('../shared/shared-board-utils');

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

describe('CommentaryContextHelpers.buildCommentaryContext', () => {
  test('builds counts phase and advantage from board and normalizes player key', () => {
    const board = createBoard();
    board[3][3] = 1;
    board[3][4] = 1;
    board[4][3] = -1;

    const context = helpers.buildCommentaryContext({
      eventType: 'turn_start',
      playerKey: ' WHITE ',
      turnNumber: 5,
      board
    });

    expect(context).toMatchObject({
      eventType: 'turn_start',
      playerKey: 'white',
      turnNumber: 5,
      phase: 'opening',
      advantage: 'even',
      counts: { black: 2, white: 1 },
      occupiedCells: 3
    });
    expect(context.board).toBe(board);
  });

  test('opening advantage values corner control above a small disc deficit', () => {
    const board = createBoard();
    board[0][0] = -1;
    board[0][1] = 1;
    board[1][0] = 1;
    board[1][1] = 1;
    board[3][3] = 1;
    board[3][4] = -1;
    board[4][3] = -1;

    const counts = helpers.countDiscsFromBoard(board);

    expect(helpers.resolveAdvantageLabel('white', counts, {
      board,
      turnNumber: 8
    })).toBe('ahead');
  });

  test('opening advantage penalizes risky X/C occupancy under an empty corner', () => {
    const board = createBoard();
    board[0][1] = -1;
    board[1][0] = -1;
    board[1][1] = -1;
    board[2][2] = -1;
    board[3][3] = -1;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = -1;

    const counts = helpers.countDiscsFromBoard(board);

    expect(helpers.resolveAdvantageLabel('white', counts, {
      board,
      turnNumber: 8
    })).toBe('behind');
  });

  test('endgame advantage still respects a large disc lead', () => {
    const board = [
      [-1, -1, -1, -1, -1, -1, -1, 1],
      [-1, -1, -1, -1, -1, -1, 1, 1],
      [-1, -1, -1, -1, -1, -1, -1, 1],
      [-1, -1, -1, -1, -1, -1, 1, 1],
      [-1, -1, -1, -1, -1, -1, 1, 1],
      [-1, -1, -1, -1, -1, 0, 1, 1],
      [-1, -1, -1, -1, -1, 1, 1, 1],
      [-1, -1, -1, -1, -1, 1, 1, 0]
    ];
    const counts = helpers.countDiscsFromBoard(board);

    expect(helpers.resolveAdvantageLabel('white', counts, {
      board,
      turnNumber: 52
    })).toBe('ahead');
  });

  test('preserves explicit phase and advantage when provided', () => {
    const context = helpers.buildCommentaryContext({
      eventType: 'card_used',
      playerKey: 'black',
      counts: { black: 20, white: 10 },
      phase: 'endgame',
      advantage: 'behind',
      cardId: 'swap_01'
    });

    expect(context).toMatchObject({
      eventType: 'card_used',
      playerKey: 'black',
      phase: 'endgame',
      advantage: 'behind',
      cardId: 'swap_01',
      counts: { black: 20, white: 10 },
      occupiedCells: 30
    });
  });

  test('builds black/white basic mobility once and reuses prepared commentary metrics', () => {
    const board = createBoard();
    board[3][3] = -1;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = -1;
    const mobilitySpy = jest.spyOn(sharedBoardUtils, 'getLegalMovesBasic');
    try {
      const fallback = helpers.buildCommentaryContext({
        eventType: 'turn_start',
        playerKey: 'white',
        turnNumber: 8,
        board
      });
      mobilitySpy.mockClear();

      const preparedMetrics = helpers.buildCpuCommentaryMetrics({
        gameState: { turnNumber: 8, board },
        playerKey: 'white'
      });
      const prepared = helpers.buildCommentaryContext({
        eventType: 'turn_start',
        playerKey: 'white',
        turnNumber: 8,
        board,
        preparedMetrics
      });

      expect(mobilitySpy).toHaveBeenCalledTimes(2);
      expect(prepared).toMatchObject({
        phase: fallback.phase,
        advantage: fallback.advantage,
        counts: fallback.counts,
        occupiedCells: fallback.occupiedCells,
        corners: expect.objectContaining({ own: expect.any(Number), opp: expect.any(Number) }),
        mobility: expect.objectContaining({ black: expect.any(Number), white: expect.any(Number) })
      });
    } finally {
      mobilitySpy.mockRestore();
    }
  });

  test('uses BoardContext topology for expansion discs, effective corners, and meteor holes', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[0][0] = 1;
    board[3][0] = 1;
    const gameState = {
      turnNumber: 6,
      board,
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: {
        cells: Array.from({ length: 4 }, (_unused, row) => ({
          side: 'right',
          row,
          col: 4,
          owner: row === 0 ? -1 : 0
        }))
      }
    };
    const cardState = {
      markers: [{
        kind: 'specialStone',
        row: 0,
        col: 0,
        data: { type: 'METEOR_HOLE' }
      }]
    };

    const metrics = helpers.buildCpuCommentaryMetrics({
      gameState,
      cardState,
      playerKey: 'white'
    });
    const context = helpers.buildCommentaryContext({
      eventType: 'turn_start',
      gameState,
      cardState,
      playerKey: 'white',
      preparedMetrics: metrics
    });

    expect(sharedBoardUtils.isBoardContext(context.board)).toBe(true);
    expect(context.counts).toEqual({ black: 1, white: 1 });
    expect(context.occupiedCells).toBe(2);
    expect(context.corners).toEqual({ own: 1, opp: 1 });
    expect(sharedBoardUtils.getCellValue(context.board, 0, 4)).toBe(-1);
    expect(sharedBoardUtils.getCellValue(context.board, 0, 0)).toBeNull();
  });

  test('does not treat the untouched initial board as commentary start', () => {
    const board = createBoard();
    board[3][3] = -1;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = -1;

    expect(helpers.hasCommentaryGameplayStarted({
      board,
      turnNumber: 0
    })).toBe(false);
  });

  test('treats post-opening progress as commentary start', () => {
    const board = createBoard();
    board[2][3] = 1;
    board[3][3] = 1;
    board[3][4] = 1;
    board[4][3] = 1;
    board[4][4] = -1;

    expect(helpers.hasCommentaryGameplayStarted({
      board,
      turnNumber: 1
    })).toBe(true);
    expect(helpers.hasCommentaryGameplayStarted({
      board
    })).toBe(true);
  });
});
