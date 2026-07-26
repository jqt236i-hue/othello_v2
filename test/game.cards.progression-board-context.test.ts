const CardProgression = require('../game/logic/cards-internal/progression');
const SharedBoardUtils = require('../shared/shared-board-utils');

function createBoardViewForCard(cardState, gameState) {
  const context = SharedBoardUtils.createBoardContext(gameState, cardState);
  return SharedBoardUtils.createBoardView(context.gameState, {
    cardState: context.cardState,
    strict: false
  });
}

describe('card progression board context', () => {
  test('infinite chain budget follows playable base and expansion topology', () => {
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardExpansion: {
        cells: [
          { side: 'top', row: -1, col: 0, owner: 0 },
          { side: 'right', row: 0, col: 4, owner: 0 }
        ]
      }
    };
    const cardState = {
      markers: [
        { kind: 'specialStone', row: 0, col: 0, data: { type: 'METEOR_HOLE' } },
        { kind: 'specialStone', row: 0, col: 4, data: { type: 'METEOR_HOLE' } }
      ]
    };

    expect(CardProgression.resolveChainWillMaxLinks(
      cardState,
      gameState,
      { infinite: true, extraLinks: Infinity },
      { createBoardViewForCard }
    )).toBe(16);
  });

  test('finite chain budgets do not require board access', () => {
    expect(CardProgression.resolveChainWillMaxLinks(
      null,
      null,
      { infinite: false, extraLinks: 3 }
    )).toBe(3);
  });

  test('infinite chain fails fast without BoardView instead of assuming 8x8', () => {
    expect(() => CardProgression.resolveChainWillMaxLinks(
      {},
      { board: Array.from({ length: 4 }, () => Array(4).fill(0)) },
      { infinite: true, extraLinks: Infinity }
    )).toThrow('createBoardViewForCard is required');
  });
});
