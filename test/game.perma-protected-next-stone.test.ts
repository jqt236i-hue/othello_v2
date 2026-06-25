import * as SharedConstants from '../shared-constants.js';
import * as Core from '../game/logic/core.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as CardLogic from '../game/logic/cards.js';

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

function getPermaProtectNextStoneDef() {
  return (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'PERMA_PROTECT_NEXT_STONE');
}

function findSpecialMarker(cardState, row, col) {
  return (cardState.markers || []).find((marker) => (
    marker &&
    marker.kind === 'specialStone' &&
    marker.row === row &&
    marker.col === col
  ));
}

describe('PERMA_PROTECT_NEXT_STONE（強い意志）', () => {
  test('use card -> place creates PERMA_PROTECTED marker without promotion metadata', () => {
    const def = getPermaProtectNextStoneDef();
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
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'PERMA_PROTECT_NEXT_STONE' }));

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
        effects: expect.objectContaining({ permaProtected: true })
      })
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();

    const marker = findSpecialMarker(cardState, 2, 3);
    expect(marker).toBeTruthy();
    expect(marker.owner).toBe('black');
    expect(marker.data).toEqual(expect.objectContaining({
      type: 'PERMA_PROTECTED',
      sourceCardId: def.id,
      sourceType: 'PERMA_PROTECT_NEXT_STONE'
    }));
    expect(Object.keys(marker.data).sort()).toEqual(['sourceCardId', 'sourceType', 'type']);

    const withoutProtectionContext = {
      ...CardLogic.getCardContext(cardState),
      protectedStones: [],
      permaProtectedStones: []
    };
    expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, withoutProtectionContext)).toEqual([
      [2, 3],
      [2, 4],
      [2, 5]
    ]);
    expect(Core.getFlipsWithContext(gameState, 2, 2, Core.WHITE, CardLogic.getCardContext(cardState))).toEqual([]);
  });

  test('owner turn starts keep PERMA_PROTECTED unchanged', () => {
    const def = getPermaProtectNextStoneDef();
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

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: def.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );
    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'place', row: 2, col: 3 },
      prng,
      { skipTurnStart: true }
    );

    cardState.presentationEvents = [];

    for (let i = 0; i < 25; i += 1) {
      CardLogic.onTurnStart(cardState, 'white', gameState, prng);
      let marker = findSpecialMarker(cardState, 2, 3);
      expect(marker.data.type).toBe('PERMA_PROTECTED');
      expect(Object.keys(marker.data).sort()).toEqual(['sourceCardId', 'sourceType', 'type']);

      CardLogic.onTurnStart(cardState, 'black', gameState, prng);
      marker = findSpecialMarker(cardState, 2, 3);
      expect(marker.data.type).toBe('PERMA_PROTECTED');
      expect(Object.keys(marker.data).sort()).toEqual(['sourceCardId', 'sourceType', 'type']);
    }

    const marker = findSpecialMarker(cardState, 2, 3);
    expect(marker).toBeTruthy();
    expect(marker.data).toEqual(expect.objectContaining({
      type: 'PERMA_PROTECTED',
      sourceCardId: def.id,
      sourceType: 'PERMA_PROTECT_NEXT_STONE'
    }));
    expect(Object.keys(marker.data).sort()).toEqual(['sourceCardId', 'sourceType', 'type']);

    const markerCount = (cardState.markers || []).filter((entry) => (
      entry &&
      entry.kind === 'specialStone' &&
      entry.row === 2 &&
      entry.col === 3
    )).length;
    expect(markerCount).toBe(1);
    expect(cardState.presentationEvents || []).toEqual([]);
  });
});
