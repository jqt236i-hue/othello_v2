const helpers = require('../shared/commentary-context-helpers');

describe('CommentaryContextHelpers.buildCommentaryContext', () => {
  test('builds counts phase and advantage from board and normalizes player key', () => {
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[0][0] = 1;
    board[0][1] = 1;
    board[0][2] = -1;

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
});
