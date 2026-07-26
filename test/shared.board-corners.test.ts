import { createBoardCorners } from "../shared/board/corners";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board corners", () => {
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
