import * as Core from '../game/logic/core.js';
import * as CardExpansion from '../game/logic/cards/expansion';

describe('CardExpansion explicit cardState topology', () => {
  test('materializing an expansion cell restores the complete legacy expansion contract', () => {
    const gameState: any = Core.createGameState({ rows: 4, cols: 4 });
    delete gameState.boardExpansion;

    expect(CardExpansion.ensureExpansionCellForCard(null, gameState, -1, 0, Core.WHITE)).toBe(true);
    expect(gameState.boardExpansion).toEqual(expect.objectContaining({
      active: true,
      side: 'top',
      row: -1,
      col: 0,
      owner: Core.WHITE,
      usedByPlayer: { black: false, white: false }
    }));
    expect(gameState.boardExpansion.cells).toEqual([
      expect.objectContaining({ row: -1, col: 0, owner: Core.WHITE })
    ]);
  });

  test('meteor holes cannot be read, written, or rematerialized through the card facade', () => {
    const gameState: any = Core.createGameState();
    gameState.board[2][2] = Core.BLACK;
    expect(CardExpansion.ensureExpansionCellForCard(null, gameState, -1, 0, Core.WHITE)).toBe(true);

    const cardState: any = {
      markers: [
        {
          id: 1,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'black',
          data: { type: 'METEOR_HOLE' }
        },
        {
          id: 2,
          kind: 'specialStone',
          row: -1,
          col: 0,
          owner: 'white',
          data: { type: 'METEOR_HOLE' }
        }
      ]
    };
    const expansionOwnerBefore = gameState.boardExpansion.cells[0].owner;

    expect(CardExpansion.getCellValueForCard(cardState, gameState, 2, 2)).toBeNull();
    expect(CardExpansion.getCellValueForCard(cardState, gameState, -1, 0)).toBeNull();
    expect(CardExpansion.setCellValueForCard(cardState, gameState, 2, 2, Core.WHITE)).toBe(false);
    expect(CardExpansion.setCellValueForCard(cardState, gameState, -1, 0, Core.BLACK)).toBe(false);
    expect(CardExpansion.ensureExpansionCellForCard(cardState, gameState, -1, 0, Core.BLACK)).toBe(false);

    expect(gameState.board[2][2]).toBe(Core.BLACK);
    expect(gameState.boardExpansion.cells).toEqual([
      expect.objectContaining({ row: -1, col: 0, owner: expansionOwnerBefore })
    ]);
  });
});
