const CardLogic = require('../game/logic/cards');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');

describe('ULTIMATE_HYPERACTIVE turn-start integration', () => {
  test('emits move/flip events and grants charge from flipped stones', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0.1 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    cardState.charge.black = 0;

    // Ultimate anchor at (3,3) for black.
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

    // Force first move to (3,4) and make one capturable line from the landing cell.
    for (const [r, c] of [[2,2], [2,3], [3,2], [4,2], [4,3]]) {
      gameState.board[r][c] = 1;
    }
    gameState.board[2][4] = 1;
    gameState.board[4][4] = 1;
    gameState.board[3][5] = -1;
    gameState.board[3][6] = 1;

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'black',
      events,
      { random: () => 0.1 }
    );

    const types = new Set(events.map(ev => ev && ev.type));
    expect(types.has('ultimate_hyperactive_moved_start')).toBe(true);
    expect(types.has('ultimate_hyperactive_flipped_start')).toBe(true);
    expect(types.has('ultimate_hyperactive_blown_start')).toBe(false);
    expect(cardState.charge.black).toBeGreaterThanOrEqual(1);
  });
});
