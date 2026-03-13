const CardExpansion = require('../game/logic/cards/expansion');
const Core = require('../game/logic/core');

describe('CardExpansion module', () => {
  test('getBoardExpansionGodPendingSelectionsForCard deduplicates first and selected targets', () => {
    const pending = {
      type: 'BOARD_EXPANSION_GOD',
      firstTarget: { row: 0, col: 0 },
      selectedTargets: [
        { row: 0, col: 0 },
        { row: 7, col: 7 },
        { row: 7, col: 7 }
      ]
    };

    expect(CardExpansion.getBoardExpansionGodPendingSelectionsForCard(pending)).toEqual([
      { row: 0, col: 0 },
      { row: 7, col: 7 }
    ]);
  });

  test('ensureExpansionCellForCard materializes a board-expansion-god corner cell and syncs legacy fields', () => {
    const gameState = Core.createGameState();

    const ok = CardExpansion.ensureExpansionCellForCard(gameState, -1, -1, Core.EMPTY);

    expect(ok).toBe(true);
    expect(gameState.boardExpansion).toMatchObject({
      active: true,
      side: 'left',
      row: -1,
      owner: Core.EMPTY
    });
    expect(gameState.boardExpansion.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: -1, col: -1, side: 'left', owner: Core.EMPTY })
    ]));
  });
});