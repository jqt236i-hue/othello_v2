const CardLogic = require('../game/logic/cards');

describe('ULTIMATE_DESTROY_GOD duration', () => {
  function makeStates() {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    return { cardState, gameState };
  }

  test('constant is 5 turns', () => {
    expect(CardLogic.ULTIMATE_DESTROY_GOD_TURNS).toBe(5);
  });

  test('placement applies UDG marker with 5 remaining turns', () => {
    const { cardState, gameState } = makeStates();
    gameState.board[3][3] = 1;
    cardState.pendingEffectByPlayer.black = {
      type: 'ULTIMATE_DESTROY_GOD',
      stage: null,
      cardId: 'udg_01'
    };

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 0);
    expect(effects && effects.ultimateDestroyGodPlaced).toBe(true);

    const marker = (cardState.markers || []).find((m) =>
      m &&
      m.kind === 'specialStone' &&
      m.row === 3 &&
      m.col === 3 &&
      m.owner === 'black' &&
      m.data &&
      m.data.type === 'ULTIMATE_DESTROY_GOD'
    );
    expect(marker).toBeTruthy();
    expect(marker.data.remainingOwnerTurns).toBe(5);
  });

  test('turn-start processing expires after 5 owner turns', () => {
    const { cardState, gameState } = makeStates();
    gameState.board[4][4] = 1;
    cardState.markers.push({
      id: 9001,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'ULTIMATE_DESTROY_GOD', remainingOwnerTurns: 5 }
    });

    for (let i = 0; i < 4; i++) {
      const res = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 4, 4);
      expect(Array.isArray(res.expired) ? res.expired.length : 0).toBe(0);
      const marker = cardState.markers.find((m) => m && m.id === 9001);
      expect(marker).toBeTruthy();
      expect(marker.data.remainingOwnerTurns).toBe(4 - i);
      expect(gameState.board[4][4]).toBe(1);
    }

    const last = CardLogic.processUltimateDestroyGodEffectsAtAnchor(cardState, gameState, 'black', 4, 4);
    expect((last.expired || [])).toEqual([{ row: 4, col: 4 }]);
    expect(gameState.board[4][4]).toBe(0);
    const marker = cardState.markers.find((m) => m && m.id === 9001);
    expect(marker).toBeUndefined();
  });
});
