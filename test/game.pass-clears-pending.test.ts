import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as PendingCoordinator from '../game/turn/pending-coordinator.js';

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
  afterEach(() => {
    PendingCoordinator.clearPendingSelectionAction('black');
    PendingCoordinator.clearPendingSelectionAction('white');
  });

  test('clears placement-wait pending on pass', () => {
    const { cardState, gameState } = makeNoMoveState();
    cardState.pendingEffectByPlayer.black = { type: 'DOUBLE_CHAIN_WILL', cardId: 'double_chain_01', stage: null };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });
    expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('clears target-selection pending on pass', () => {
    const { cardState, gameState } = makeNoMoveState();
    cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });
    expect(res.cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('clears cached pending selection action on pass', () => {
    global.ActionManager = {
      ActionManager: {
        createAction: (type, player, extra) => ({ type, player, ...(extra || {}) })
      }
    };
    const { cardState, gameState } = makeNoMoveState();
    cardState.pendingEffectByPlayer.black = { type: 'DESTROY_ONE_STONE', cardId: 'destroy_01', stage: 'selectTarget' };
    PendingCoordinator.createPendingSelectionAction(
      'black',
      'DESTROY_ONE_STONE',
      { destroyTarget: { row: 2, col: 3 } },
      { cardState }
    );

    TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' });

    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(PendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    delete global.ActionManager;
  });
});
