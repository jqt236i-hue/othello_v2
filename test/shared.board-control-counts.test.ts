import { createControlCounts } from '../shared/board/control-counts';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared board control counts', () => {
  test('keeps corner and non-corner edge control counts fixture-equivalent', () => {
    const board = [[1, 1, 0, -1], [0, 0, 0, 0], [0, 0, 0, 0], [-1, 0, 1, 1]];
    const leaf = createControlCounts({
      getCellValue: SharedBoardUtils.getCellValue,
      getCornerCells: SharedBoardUtils.getCornerCells,
      collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates,
      isEdgeCell: SharedBoardUtils.isEdgeCell,
      isCornerCell: SharedBoardUtils.isCornerCell
    });

    expect(leaf.countCornerControl(board, 1)).toEqual({ ownCorners: 2, oppCorners: 2 });
    expect(leaf.countEdgeControl(board, 1)).toEqual({ ownEdges: 2, oppEdges: 0 });
    expect(leaf.countCornerControl(null, 1)).toEqual({ ownCorners: 0, oppCorners: 0 });
    expect(SharedBoardUtils.countCornerControl(board, 1)).toEqual(leaf.countCornerControl(board, 1));
    expect(SharedBoardUtils.countEdgeControl(board, 1)).toEqual(leaf.countEdgeControl(board, 1));
  });
});
