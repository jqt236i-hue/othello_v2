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

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        gameState.board[r][c] = 1;
      }
    }
    // Ultimate anchor at (3,3) for black.
    gameState.board[3][3] = 1;
    gameState.board[3][6] = 0;
    gameState.board[3][5] = -1;

    cardState.markers.push({
      id: 1,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE' }
    });

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

  test('duration decrements only on owner turn', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0.1 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: -1
    };

    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 100,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: { type: 'ULTIMATE_HYPERACTIVE', remainingOwnerTurns: 10 }
    });

    const eventsWhite = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'white',
      eventsWhite,
      { random: () => 0.1 }
    );

    let marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(10);

    const eventsBlack = [];
    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      { BLACK: 1, WHITE: -1 },
      cardState,
      gameState,
      'black',
      eventsBlack,
      { random: () => 0.1 }
    );

    marker = cardState.markers.find(m => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_HYPERACTIVE');
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(9);
  });
});
