import { createBoardDimensions } from '../shared/board/dimensions';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared board dimensions', () => {
  const createLeaf = () => createBoardDimensions({
    defaultRows: SharedBoardUtils.DEFAULT_BOARD_ROWS,
    defaultCols: SharedBoardUtils.DEFAULT_BOARD_COLS,
    minRows: SharedBoardUtils.MIN_BOARD_ROWS,
    maxRows: SharedBoardUtils.MAX_BOARD_ROWS,
    minCols: SharedBoardUtils.MIN_BOARD_COLS,
    maxCols: SharedBoardUtils.MAX_BOARD_COLS
  });

  test('keeps axis aliases, clamping, and increments fixture-equivalent', () => {
    const leaf = createLeaf();

    expect(leaf.getBoardDimensionBounds('row')).toEqual({ min: 4, max: 16 });
    expect(leaf.getBoardDimensionBounds('column')).toEqual({ min: 4, max: 16 });
    expect(leaf.normalizeBoardDimensionValue(17, 8, 'row')).toBe(16);
    expect(leaf.normalizeBoardDimensionValue(2, 8, 'cols')).toBe(4);
    expect(leaf.normalizeBoardDimensionValue('bad', 7.9, 'row')).toBe(7);
    expect(leaf.stepBoardDimensionValue(16, 1, 8, 'row')).toBe(16);
    expect(leaf.stepBoardDimensionValue(4, -1, 8, 'col')).toBe(4);
    expect(leaf.stepBoardDimensionValue(7, 0, 8, 'row')).toBe(7);

    expect(SharedBoardUtils.getBoardDimensionBounds('column')).toEqual(leaf.getBoardDimensionBounds('column'));
    expect(SharedBoardUtils.normalizeBoardDimensionValue(17, 8, 'row')).toBe(leaf.normalizeBoardDimensionValue(17, 8, 'row'));
    expect(SharedBoardUtils.stepBoardDimensionValue(4, -1, 8, 'col')).toBe(leaf.stepBoardDimensionValue(4, -1, 8, 'col'));
  });
});
