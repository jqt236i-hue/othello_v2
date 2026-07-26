import LeaderboardScore = require('../shared/leaderboard-score');

describe('shared leaderboard score authority', () => {
  test('browser and worker inputs resolve the same version 5 score', () => {
    const summary = LeaderboardScore.computeLeaderboardScoreSummary({
      counts: { black: 44, white: 20 },
      playerKey: 'black',
      localOutcomeKey: 'win',
      turnCount: 42,
      flipTotals: { black: 150, white: 90 }
    });

    expect(summary).toMatchObject({
      version: 5,
      total: 8818,
      baseBonus: 5000,
      speedBonus: 1450,
      monoBonus: 0,
      supportBonus: 2368,
      turnCount: 42,
      localOutcomeKey: 'win',
      localKey: 'black',
      localDiscCount: 44,
      opponentDiscCount: 20
    });
  });

  test('canonical state derives turn and flip totals without client score fields', () => {
    const board = Array.from({ length: 8 }, (_row, row) => (
      Array.from({ length: 8 }, (_cell, col) => (row * 8 + col < 44 ? 1 : -1))
    ));
    const summary = LeaderboardScore.buildLeaderboardScoreSummaryFromState(
      { board, boardConfig: { rows: 8, cols: 8, shape: 'rectangle', standard8x8: true } },
      { turnCountByPlayer: { black: 24, white: 18 }, totalFlipCountByPlayer: { black: 150, white: 90 } },
      'black'
    );

    expect(summary.total).toBe(8818);
    expect(summary.turnCount).toBe(42);
    expect(LeaderboardScore.isStandardLeaderboardBoard({ board, boardConfig: { rows: 8, cols: 8 } })).toBe(true);
    expect(LeaderboardScore.isStandardLeaderboardBoard({ board, boardConfig: { rows: 8, cols: 8, shape: 'circle' } })).toBe(false);
  });

  test('state score counts playable expansion stones and excludes meteor holes', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[0][0] = 1;
    board[0][1] = -1;
    const gameState = {
      board,
      boardConfig: { rows: 4, cols: 4 },
      boardExpansion: {
        active: true,
        cells: [
          { row: 1, col: 4, side: 'right', owner: -1 },
          { row: 2, col: 4, side: 'right', owner: 1 }
        ]
      }
    };
    const cardState = {
      markers: [{
        kind: 'specialStone',
        row: 2,
        col: 4,
        data: { type: 'METEOR_HOLE' }
      }],
      turnCountByPlayer: { black: 1, white: 1 },
      totalFlipCountByPlayer: { black: 0, white: 0 }
    };

    const summary = LeaderboardScore.buildLeaderboardScoreSummaryFromState(
      gameState,
      cardState,
      'white'
    );

    expect(summary.localDiscCount).toBe(2);
    expect(summary.opponentDiscCount).toBe(1);
    expect(summary.localOutcomeKey).toBe('win');
  });
});
