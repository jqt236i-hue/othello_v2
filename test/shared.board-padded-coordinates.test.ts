import * as PaddedBoardCoordinates from '../shared/board/padded-coordinates';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared padded board coordinates', () => {
  const bounds = { min: -1, max: 8 };

  test('keeps bounds and index conversion fixture-equivalent behind the facade', () => {
    const coordinates = [
      { row: -1, col: -1 },
      { row: 0, col: 0 },
      { row: 7, col: 7 },
      { row: 8, col: 8 },
      { row: 9, col: 0 }
    ];

    for (const { row, col } of coordinates) {
      expect(SharedBoardUtils.isPaddedBoardCoordinate(row, col))
        .toBe(PaddedBoardCoordinates.isPaddedBoardCoordinate(row, col, bounds));
      expect(SharedBoardUtils.toPaddedBoardIndex(row, col))
        .toBe(PaddedBoardCoordinates.toPaddedBoardIndex(row, col, bounds));
    }

    for (const index of [-1, 0, 11, 99, 100]) {
      expect(SharedBoardUtils.fromPaddedBoardIndex(index))
        .toEqual(PaddedBoardCoordinates.fromPaddedBoardIndex(index, bounds));
    }
  });
});
