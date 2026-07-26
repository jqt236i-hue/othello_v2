const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared board effective anchors', () => {
  function makeBoard(rows = 4, cols = 4) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  }

  test('effective corners and edges include standard board corners and perimeter', () => {
    const board = makeBoard();

    expect(SharedBoardUtils.isEffectiveCornerCell(0, 0, board)).toBe(true);
    expect(SharedBoardUtils.isEffectiveEdgeCell(0, 1, board)).toBe(true);
    expect(SharedBoardUtils.getEffectiveCornerCells(board)).toEqual(expect.arrayContaining([
      { row: 0, col: 0 },
      { row: 0, col: 3 },
      { row: 3, col: 0 },
      { row: 3, col: 3 }
    ]));
  });

  test('effective corners and edges treat meteor holes as playable-boundary breaks', () => {
    const board = makeBoard();
    const context = SharedBoardUtils.createBoardContext(
      {
        board,
        boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
        boardExpansion: { cells: [] }
      },
      {
        markers: [
          { kind: 'specialStone', row: 0, col: 0, data: { type: 'METEOR_HOLE' } }
        ]
      }
    );

    expect(SharedBoardUtils.hasPlayableCell(context, 0, 0)).toBe(false);
    expect(SharedBoardUtils.isEffectiveCornerCell(0, 1, context)).toBe(true);
    expect(SharedBoardUtils.isEffectiveCornerCell(1, 0, context)).toBe(true);
    expect(SharedBoardUtils.isEffectiveEdgeCell(0, 1, context)).toBe(true);
    expect(SharedBoardUtils.isEffectiveEdgeCell(1, 1, context)).toBe(false);
    expect(SharedBoardUtils.getEffectiveCornerCells(context)).toEqual(expect.arrayContaining([
      { row: 0, col: 1 },
      { row: 1, col: 0 }
    ]));
  });
});
