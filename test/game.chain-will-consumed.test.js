const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

function makeInitialLikeState() {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
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

describe('CHAIN_WILL consumption', () => {
  test('is cleared after placement and does not persist across turns', () => {
    const { cardState, gameState } = makeInitialLikeState();
    cardState.pendingEffectByPlayer.black = { type: 'CHAIN_WILL', cardId: 'chain_01', stage: null };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'place', row: 2, col: 3 });

    expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
    expect(res.gameState.currentPlayer).toBe(Shared.WHITE);
  });
});

