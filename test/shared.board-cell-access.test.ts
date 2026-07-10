import { createCellAccess } from "../shared/board/cell-access";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board cell access", () => {
  test("keeps holes inaccessible and reads and writes an expansion cell through shape metadata", () => {
    const leaf = createCellAccess({
      defaultRows: 8,
      defaultCols: 8,
      empty: 0,
      toBoardCellKey: SharedBoardUtils.toBoardCellKey,
      normalizeOwner: (value) => (value === 1 || value === -1 ? value : 0),
      resolveBoardConfig: SharedBoardUtils.resolveBoardConfig,
      getBoardShapeMeta: SharedBoardUtils.getBoardShapeMeta,
    });
    const board = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
    SharedBoardUtils.attachBoardShape(board, {
      boardExpansion: { cells: [{ side: "right", row: 0, col: 4, owner: -1 }] },
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

    expect(leaf.resolveBoardBounds(board)).toEqual({
      minRow: 0,
      maxRow: 3,
      minCol: 0,
      maxCol: 4,
    });
    expect(leaf.getCellValue(board, 0, 0)).toBeNull();
    expect(leaf.getCellValue(board, 0, 4)).toBe(-1);
    expect(leaf.setCellValue(board, 0, 4, 1)).toBe(true);
    expect(leaf.getCellValue(board, 0, 4)).toBe(1);
    expect(leaf.setCellValue(board, 0, 0, -1)).toBe(false);
    expect(leaf.collectBoardCoordinates(board)).toEqual(expect.arrayContaining([
      { row: 0, col: 1 },
      { row: 0, col: 4 },
      { row: 3, col: 3 },
    ]));
    expect(SharedBoardUtils.getCellValue(board, 0, 4)).toBe(1);
  });
});
