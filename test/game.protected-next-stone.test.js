const SharedConstants = require('../shared-constants');
const Core = require('../game/logic/core');
const TurnPipeline = require('../game/turn/turn_pipeline');
const CardLogic = require('../game/logic/cards');

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function getProtectedNextStoneDef() {
  return (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'PROTECTED_NEXT_STONE');
}

describe('PROTECTED_NEXT_STONE（弱い意志）', () => {
  test('use card -> place -> next opponent turn blocks flips -> owner turn start expires', () => {
    const def = getProtectedNextStoneDef();
    expect(def).toBeTruthy();

    const prng = createPrng(0);
    const cardState = CardLogic.createCardState(prng);
    const gameState = createEmptyGameState();
    cardState.debugNoDraw = true;
    cardState.hands.black = [def.id];
    cardState.charge.black = def.cost;

    gameState.board[2][4] = Core.WHITE;
    gameState.board[2][5] = Core.BLACK;
    gameState.board[2][6] = Core.WHITE;

    const useRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    expect(useRes.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'card_used', player: 'black', cardId: def.id })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'PROTECTED_NEXT_STONE' }));

    const placeRes = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    expect(placeRes.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'placement_effects',
        player: 'black',
        effects: expect.objectContaining({ protected: true, chargeGained: 1 })
      })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const protectedMarker = (cardState.markers || []).find((marker) => (
      marker &&
      marker.kind === 'specialStone' &&
      marker.row === 2 &&
      marker.col === 3 &&
      marker.owner === 'black' &&
      marker.data &&
      marker.data.type === 'PROTECTED'
    ));
    expect(protectedMarker).toBeTruthy();
    expect(protectedMarker.data.expiresForPlayer).toBe('black');

    const withoutProtectionContext = {
      ...CardLogic.getCardContext(cardState),
      protectedStones: []
    };
    expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, withoutProtectionContext)).toEqual([
      [2, 3],
      [2, 4],
      [2, 5]
    ]);
    expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, CardLogic.getCardContext(cardState))).toEqual([]);

    CardLogic.onTurnStart(cardState, 'white', gameState, prng);
    expect((cardState.markers || []).some((marker) => (
      marker &&
      marker.kind === 'specialStone' &&
      marker.row === 2 &&
      marker.col === 3 &&
      marker.data &&
      marker.data.type === 'PROTECTED'
    ))).toBe(true);

    CardLogic.onTurnStart(cardState, 'black', gameState, prng);
    expect((cardState.markers || []).some((marker) => (
      marker &&
      marker.kind === 'specialStone' &&
      marker.row === 2 &&
      marker.col === 3 &&
      marker.data &&
      marker.data.type === 'PROTECTED'
    ))).toBe(false);
    expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, CardLogic.getCardContext(cardState))).toEqual([
      [2, 3],
      [2, 4],
      [2, 5]
    ]);
  });
});