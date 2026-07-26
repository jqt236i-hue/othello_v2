import { createBoardCorners } from "../shared/board/corners";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board corners", () => {
  test("builds the corner key set once per corner collection", () => {
    const coordinates = Array.from({ length: 64 }, (_, index) => ({
      row: Math.floor(index / 8),
      col: index % 8,
    }));
    const collectBoardCoordinates = jest.fn(() => coordinates);
    const leaf = createBoardCorners({
      toBoardCellKey: (row, col) => `${row},${col}`,
      collectBoardCoordinates,
      hasPlayableCell: () => true,
      resolveBoardBounds: () => ({
        minRow: 0,
        maxRow: 7,
        minCol: 0,
        maxCol: 7,
      }),
    });

    expect(leaf.getCornerCells({})).toHaveLength(4);
    expect(collectBoardCoordinates).toHaveBeenCalledTimes(2);
  });

  test("keeps rectangular corners and meteor-hole effective boundaries fixture-equivalent", () => {
    const leaf = createBoardCorners({
      toBoardCellKey: SharedBoardUtils.toBoardCellKey,
      collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates,
      hasPlayableCell: SharedBoardUtils.hasPlayableCell,
      resolveBoardBounds: SharedBoardUtils.resolveBoardBounds,
    });
    const board = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => 0),
    );
    const context = SharedBoardUtils.createBoardContext(
      {
        board,
        boardConfig: { rows: 4, cols: 4, shape: "rectangle" },
        boardExpansion: { cells: [] },
      },
      {
        markers: [
          {
            kind: "specialStone",
            row: 0,
            col: 0,
            data: { type: "METEOR_HOLE" },
          },
        ],
      },
    );

    expect(leaf.isCornerCell(0, 0, context)).toBe(false);
    expect(leaf.isCornerCell(0, 1, context)).toBe(true);
    expect(leaf.isEdgeCell(1, 1, context)).toBe(false);
    expect(leaf.getCornerCells(context)).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ]),
    );
    expect(SharedBoardUtils.getPerimeterCells(context)).toEqual(
      leaf.getPerimeterCells(context),
    );
    expect(leaf.isCornerCell(0, 0, 4, 4)).toBe(true);
  });
});
