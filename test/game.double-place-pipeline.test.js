const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

function makeInitialState() {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
  const gameState = {
    board: Array(8).fill(null).map(() => Array(8).fill(0)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.BLACK;
  gameState.board[4][3] = Shared.BLACK;
  gameState.board[4][4] = Shared.WHITE;
  return { cardState, gameState };
}

describe('DOUBLE_PLACE turn transition in TurnPipeline', () => {
  test('first placement with DOUBLE_PLACE keeps turn and does not advance turnNumber', () => {
    const { cardState, gameState } = makeInitialState();
    cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_PLACE', stage: 'awaitPlace' };

    const res = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      { shuffle: (arr) => arr, random: () => 0.5 }
    );

    expect(res.cardState.extraPlaceRemainingByPlayer.black).toBe(1);
    expect(res.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(res.gameState.turnNumber).toBe(1);
  });

  test('second placement consumes extra place and passes turn to opponent', () => {
    const { cardState, gameState } = makeInitialState();
    cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_PLACE', stage: 'awaitPlace' };

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      { shuffle: (arr) => arr, random: () => 0.5 }
    );

    const res2 = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 4, col: 5 },
      { shuffle: (arr) => arr, random: () => 0.5 }
    );

    expect(res2.cardState.extraPlaceRemainingByPlayer.black).toBe(0);
    expect(res2.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(res2.gameState.turnNumber).toBe(2);
  });
});
