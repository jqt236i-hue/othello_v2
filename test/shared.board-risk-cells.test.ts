import { createRiskCells } from "../shared/board/risk-cells";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board risk cells", () => {
  test("keeps X/C classification and proximity on a rectangular board fixture", () => {
    const leaf = createRiskCells({
      toBoardCellKey: SharedBoardUtils.toBoardCellKey,
      getBoardShapeMeta: SharedBoardUtils.getBoardShapeMeta,
      collectBoardCoordinates: SharedBoardUtils.collectBoardCoordinates,
      hasPlayableCell: SharedBoardUtils.hasPlayableCell,
      resolveBoardBounds: SharedBoardUtils.resolveBoardBounds,
      getCornerCells: SharedBoardUtils.getCornerCells,
      isCornerCell: SharedBoardUtils.isCornerCell,
      isEdgeCell: SharedBoardUtils.isEdgeCell,
    });
    const board = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => 0),
    );

    expect(leaf.isXSquare(1, 1, board)).toBe(true);
    expect(leaf.isCSquare(0, 1, board)).toBe(true);
    expect(leaf.getCornerProximity(1, 1, board)).toEqual({
      kind: "X",
      corner: [0, 0],
    });
    expect(leaf.getCornerProximity(0, 1, board)).toEqual({
      kind: "C",
      corner: [0, 0],
    });
    expect(leaf.getCellType(1, 1, board)).toBe("x");
    expect(leaf.getCellType(Number.NaN, 1, board)).toBe("unknown");
    expect(SharedBoardUtils.getCornerProximity(1, 1, board)).toEqual(
      leaf.getCornerProximity(1, 1, board),
    );
  });
});
