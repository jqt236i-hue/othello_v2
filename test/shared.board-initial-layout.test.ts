import { createInitialLayout } from '../shared/board/initial-layout';

const SharedBoardUtils = require('../shared/shared-board-utils');

describe('shared initial board layout', () => {
  const createLeaf = () => createInitialLayout({
    empty: 0,
    black: 1,
    white: -1,
    resolveBoardConfig: SharedBoardUtils.resolveBoardConfig
  });

  test('keeps board creation and normal opening placements fixture-equivalent', () => {
    const leaf = createLeaf();

    expect(leaf.isMainBoardCell(3, 8, { rows: 7, cols: 9 })).toBe(true);
    expect(leaf.isMainBoardCell(7, 8, { rows: 7, cols: 9 })).toBe(false);
    expect(leaf.collectMainBoardCoordinates({ rows: 4, cols: 5 })).toHaveLength(20);
    expect(leaf.createEmptyBoard(4, 5, -1)).toEqual(Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => -1)));
    expect(leaf.getOpeningPlacements({ rows: 4, cols: 6 })).toEqual([
      { row: 1, col: 2, owner: -1 }, { row: 1, col: 3, owner: 1 },
      { row: 2, col: 2, owner: 1 }, { row: 2, col: 3, owner: -1 }
    ]);
    expect(SharedBoardUtils.getOpeningPlacements({ rows: 4, cols: 6 }))
      .toEqual(leaf.getOpeningPlacements({ rows: 4, cols: 6 }));
  });

  test('keeps the special 7x7 opening layout', () => {
    const leaf = createLeaf();
    const placements = leaf.getOpeningPlacements({ rows: 7, cols: 7 });

    expect(placements).toHaveLength(8);
    expect(placements).toEqual(expect.arrayContaining([
      { row: 2, col: 2, owner: -1 }, { row: 2, col: 3, owner: 1 },
      { row: 4, col: 4, owner: -1 }
    ]));
    expect(leaf.getOpeningCells({ rows: 7, cols: 7 })).toHaveLength(8);
  });
});
