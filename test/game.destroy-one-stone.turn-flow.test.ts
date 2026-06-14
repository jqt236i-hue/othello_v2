import * as Shared from '../shared-constants.js';

const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');

function createPrng() {
  return {
    random: () => 0,
    shuffle: (arr: any[]) => arr
  };
}

function createDestroySelectionState() {
  const cardState = CardLogic.createCardState(createPrng());
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 7,
    consecutivePasses: 0
  };

  gameState.board[3][3] = Shared.WHITE;
  gameState.board[3][4] = Shared.WHITE;
  gameState.board[3][5] = Shared.BLACK;
  gameState.board[4][4] = Shared.WHITE;
  cardState.pendingEffectByPlayer.black = {
    type: 'DESTROY_ONE_STONE',
    stage: 'selectTarget',
    cardId: 'destroy_01'
  };

  return { cardState, gameState };
}

describe('DESTROY_ONE_STONE turn flow', () => {
  test('破壊対象選択後も同じ手番で通常配置できる', () => {
    const { cardState, gameState } = createDestroySelectionState();
    const prng = createPrng();

    const selection = TurnPipeline.applyTurnSafe(
      cardState,
      gameState,
      'black',
      { type: 'place', destroyTarget: { row: 4, col: 4 } },
      prng,
      { skipTurnStart: true, currentStateVersion: 0 }
    );

    expect(selection.ok).toBe(true);
    expect(selection.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(selection.gameState.currentPlayer).toBe(Shared.BLACK);
    expect(selection.gameState.turnNumber).toBe(7);

    const placement = TurnPipeline.applyTurnSafe(
      selection.cardState,
      selection.gameState,
      'black',
      { type: 'place', row: 3, col: 2 },
      prng,
      { skipTurnStart: true, currentStateVersion: selection.nextStateVersion }
    );

    expect(placement.ok).toBe(true);
    expect(placement.gameState.board[3][2]).toBe(Shared.BLACK);
    expect(placement.gameState.currentPlayer).toBe(Shared.WHITE);
    expect(placement.gameState.turnNumber).toBe(8);
  });
});
