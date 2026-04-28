import * as helpers from '../shared/commentary-context-helpers.js';

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
