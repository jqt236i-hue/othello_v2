const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');

function createStates() {
  const prng = { shuffle: (arr) => arr, random: () => 0.5 };
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber: 0,
    consecutivePasses: 0
  };
  return { cardState, gameState };
}

describe('TIME_BOMB selection behavior', () => {
  test('card use requires at least one own stone target', () => {
    const def = SharedConstants.CARD_DEFS.find((d) => d && d.type === 'TIME_BOMB');
    expect(def).toBeTruthy();

    const { cardState, gameState } = createStates();
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    const okWithoutOwnStone = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(okWithoutOwnStone).toBe(false);

    gameState.board[3][3] = 1;
    const okWithOwnStone = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(okWithOwnStone).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('TIME_BOMB');
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.stage).toBe('selectTarget');
  });

  test('applyTimeBombWill converts selected own stone to bomb and clears pending', () => {
    const { cardState, gameState } = createStates();
    gameState.board[2][2] = 1;
    cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };

    const applied = CardLogic.applyTimeBombWill(cardState, gameState, 'black', 2, 2);
    expect(applied && applied.applied).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const bomb = (cardState.markers || []).find((m) => m.kind === 'bomb' && m.row === 2 && m.col === 2 && m.owner === 'black');
    expect(bomb).toBeTruthy();
    expect(bomb.data && typeof bomb.data.remainingTurns).toBe('number');
  });

  test('placement effects no longer place bomb from TIME_BOMB pending', () => {
    const { cardState, gameState } = createStates();
    gameState.board[4][4] = 1;
    cardState.pendingEffectByPlayer.black = { type: 'TIME_BOMB', stage: 'selectTarget', cardId: 'bomb_01' };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 4, 4, 1);
    expect(effects.bombPlaced).toBeFalsy();
    const bomb = (cardState.markers || []).find((m) => m.kind === 'bomb' && m.row === 4 && m.col === 4);
    expect(bomb).toBeFalsy();
  });
});
