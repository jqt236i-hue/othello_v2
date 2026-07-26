import * as Core from '../game/logic/core.js';
import * as CardLogic from '../game/logic/cards.js';
import SharedBoardUtils = require('../shared/shared-board-utils');

function createExpansionState() {
  const gameState = Core.createGameState({ rows: 4, cols: 4 });
  gameState.board = Array.from({ length: 4 }, () => Array(4).fill(Core.EMPTY));
  gameState.board[0][0] = Core.BLACK;
  gameState.board[0][1] = Core.WHITE;
  gameState.boardExpansion = {
    active: true,
    side: 'right',
    row: 2,
    col: 4,
    owner: Core.BLACK,
    usedByPlayer: { black: true, white: true },
    cells: [
      { side: 'right', row: 1, col: 4, owner: Core.WHITE },
      { side: 'right', row: 2, col: 4, owner: Core.BLACK },
    ],
  };
  const cardState = {
    markers: [
      {
        kind: 'specialStone',
        row: 2,
        col: 4,
        data: { type: 'METEOR_HOLE' },
      },
    ],
  };
  return { gameState, cardState };
}

describe('GameCore explicit board context', () => {
  test('reads, writes, and counts expansion cells with METEOR_HOLE card state', () => {
    const { gameState, cardState } = createExpansionState();
    const boardContext = SharedBoardUtils.createBoardContext(gameState, cardState);

    expect(Core.getCellValue(gameState, 1, 4, cardState)).toBe(Core.WHITE);
    expect(Core.getCellValue(boardContext, 2, 4)).toBeNull();
    expect(Core.setCellValue(boardContext, 2, 4, Core.WHITE)).toBe(false);
    expect(gameState.boardExpansion.cells[1].owner).toBe(Core.BLACK);
    expect(Core.countDiscs(gameState, cardState)).toEqual({ black: 1, white: 2 });
    expect(Core.countDiscs(boardContext)).toEqual({ black: 1, white: 2 });

    expect(Core.setCellValue(gameState, 1, 4, Core.BLACK, cardState)).toBe(true);
    expect(Core.getCellValue(boardContext, 1, 4)).toBe(Core.BLACK);
    expect(Core.countDiscs(boardContext)).toEqual({ black: 2, white: 1 });
  });

  test('CardLogic context excludes an expansion METEOR_HOLE without relying on blockedCells', () => {
    const { gameState, cardState } = createExpansionState();
    gameState.board[1][2] = Core.BLACK;
    gameState.board[1][3] = Core.WHITE;
    gameState.boardExpansion.cells = [
      { side: 'right', row: 1, col: 4, owner: Core.EMPTY },
    ];
    cardState.markers = [
      {
        kind: 'specialStone',
        row: 1,
        col: 4,
        data: { type: 'METEOR_HOLE' },
      },
    ];

    const context = CardLogic.getCardContext(cardState);
    expect(context.cardState).toBe(cardState);
    expect(context.blockedCells).toEqual([
      expect.objectContaining({ row: 1, col: 4, type: 'METEOR_HOLE' }),
    ]);

    const withoutBlockedApproximation = { ...context, blockedCells: [] };
    expect(Core.getFlipsWithContext(
      gameState,
      1,
      4,
      Core.BLACK,
      withoutBlockedApproximation,
    )).toEqual([]);
    expect(Core.getLegalMoves(gameState, Core.BLACK, withoutBlockedApproximation))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ row: 1, col: 4 }),
      ]));

    const withoutCanonicalCardState = {
      ...withoutBlockedApproximation,
      cardState: null,
    };
    expect(Core.getFlipsWithContext(
      gameState,
      1,
      4,
      Core.BLACK,
      withoutCanonicalCardState,
    )).toEqual([[1, 3]]);
    expect(Core.getLegalMoves(gameState, Core.BLACK, withoutCanonicalCardState))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ row: 1, col: 4 }),
      ]));
  });
});
