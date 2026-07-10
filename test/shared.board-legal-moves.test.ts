import { createLegalMoves } from '../shared/board/legal-moves';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared board legal moves', () => {
  const createFallbackLeaf = () => createLegalMoves({
    empty: 0,
    directions: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
    othelloCore: null,
    hasPlayableCell: SharedBoardUtils.hasPlayableCell,
    getCellValue: SharedBoardUtils.getCellValue,
    collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates
  });

  test('keeps fallback flips and legal move ordering fixture-equivalent', () => {
    const board = [[0, 0, 0, 0], [0, -1, 1, 0], [0, 1, -1, 0], [0, 0, 0, 0]];
    const leaf = createFallbackLeaf();

    expect(leaf.getFlipsBasic(board, 0, 1, 1)).toEqual([{ row: 1, col: 1 }]);
    expect(leaf.getFlipsBasic(board, 1, 1, 1)).toEqual([]);
    expect(leaf.getLegalMovesBasic(board, 1)).toEqual([
      { row: 0, col: 1, flips: [{ row: 1, col: 1 }] },
      { row: 1, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 2, col: 3, flips: [{ row: 2, col: 2 }] },
      { row: 3, col: 2, flips: [{ row: 2, col: 2 }] }
    ]);
    expect(SharedBoardUtils.getLegalMovesBasic(board, 1)).toEqual(leaf.getLegalMovesBasic(board, 1));
  });
});
