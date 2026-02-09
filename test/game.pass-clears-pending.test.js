const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

function makeNoMoveState() {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  gameState.board[0][0] = Shared.EMPTY;
  return { cardState, gameState };
}

describe('pass clears pending card effect', () => {
  test('clears placement-wait pending on pass', () => {
    const { cardState, gameState } = makeNoMoveState();
    cardState.pendingEffectByPlayer.black = { type: 'CHAIN_WILL', cardId: 'chain_01', stage: null };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });
    expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('clears target-selection pending on pass', () => {
    const { cardState, gameState } = makeNoMoveState();
    cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });
    expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
  });
});
