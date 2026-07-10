import { createBoardCorners } from "../shared/board/corners";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board corners", () => {
  test("keeps rectangular corners and meteor-hole effective boundaries fixture-equivalent", () => {
    const leaf = createBoardCorners({
      toBoardCellKey: SharedBoardUtils.toBoardCellKey,
      getBoardShapeMeta: SharedBoardUtils.getBoardShapeMeta,
      collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates,
      hasPlayableCell: SharedBoardUtils.hasPlayableCell,
      resolveBoardBounds: SharedBoardUtils.resolveBoardBounds,
    });
    const board = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => 0),
    );
    SharedBoardUtils.attachBoardShape(board, {
      cardState: {
        markers: [
          {
            kind: "specialStone",
            row: 0,
            col: 0,
            data: { type: "METEOR_HOLE" },
          },
        ],
      },
    });

    expect(leaf.isCornerCell(0, 0, board)).toBe(false);
    expect(leaf.isCornerCell(0, 1, board)).toBe(true);
    expect(leaf.isEdgeCell(1, 1, board)).toBe(false);
    expect(leaf.getCornerCells(board)).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ]),
    );
    expect(SharedBoardUtils.getPerimeterCells(board)).toEqual(
      leaf.getPerimeterCells(board),
    );
    expect(leaf.isCornerCell(0, 0, { rows: 4, cols: 4 })).toBe(true);
  });
});
