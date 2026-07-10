import { createCanonicalBoardEncoding } from '../shared/board/canonical-encoding';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared canonical board encoding', () => {
  const createLeaf = () => createCanonicalBoardEncoding({
    resolveBoardBounds: SharedBoardUtils.resolveBoardBounds,
    collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates,
    getCellValue: SharedBoardUtils.getCellValue
  });

  test('keeps facade keys and canonical transforms fixture-equivalent', () => {
    const board = [
      [1, 0, 0],
      [0, -1, 0],
      [0, 0, 0]
    ];
    const leaf = createLeaf();

    expect(leaf.toCellChar(1)).toBe('B');
    expect(leaf.toCellChar(-1)).toBe('W');
    expect(leaf.toCellChar(0)).toBe('.');
    expect(leaf.toCellChar(99)).toBe('#');
    expect(leaf.transformCoord(0, 0, 3, 1)).toEqual({ row: 0, col: 2 });
    expect(leaf.transformCoord(0, 0, 3, 2)).toEqual({ row: 2, col: 2 });
    expect(leaf.transformCoord(0, 0, 3, 7)).toEqual({ row: 0, col: 0 });
    expect(leaf.transformCoord(0, 0, 3, 99)).toEqual({ row: 0, col: 0 });
    expect(leaf.encodeBoard(board)).toBe('B../.W./...');
    expect(leaf.canonicalizeBoard(board)).toEqual({
      boardKey: '.../.W./..B',
      transformId: 2,
      size: 3,
      minRow: 0,
      minCol: 0
    });
    expect(leaf.mapCoordToCanonical(5, 5, board, 1)).toBeNull();
    expect(leaf.makeCanonicalActionKey({ row: 0, col: 0 }, board, 1)).toBe('place:0:2');
    expect(leaf.makeCanonicalActionKey({ row: Number.NaN, col: 0 }, board, 1)).toBe('');

    expect(SharedBoardUtils.encodeBoard(board)).toBe(leaf.encodeBoard(board));
    expect(SharedBoardUtils.canonicalizeBoard(board)).toEqual(leaf.canonicalizeBoard(board));
    expect(SharedBoardUtils.mapCoordToCanonical(0, 0, board, 1)).toEqual(leaf.mapCoordToCanonical(0, 0, board, 1));
    expect(SharedBoardUtils.makeCanonicalActionKey({ row: 0, col: 0 }, board, 1))
      .toBe(leaf.makeCanonicalActionKey({ row: 0, col: 0 }, board, 1));
  });
});
