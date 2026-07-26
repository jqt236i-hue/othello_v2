import { createCellAccess } from "../shared/board/cell-access";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board cell access", () => {
  test("keeps the leaf dense-only and routes shaped access through an explicit context", () => {
    const leaf = createCellAccess({
      defaultRows: 8,
      defaultCols: 8,
      empty: 0,
      normalizeOwner: (value) => (value === 1 || value === -1 ? value : 0),
      resolveBoardConfig: SharedBoardUtils.resolveBoardConfig,
    });
    const board = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0));
    const gameState = {
      board,
      boardConfig: { rows: 4, cols: 4, shape: "rectangle" },
      boardExpansion: { cells: [{ side: "right", row: 0, col: 4, owner: -1 }] },
    };
    const cardState = {
      markers: [
        {
          kind: "specialStone",
          row: 0,
          col: 0,
          data: { type: "METEOR_HOLE" },
        },
      ],
    };
    const context = SharedBoardUtils.createBoardContext(gameState, cardState);

    expect(leaf.resolveBoardBounds(board)).toEqual({
      minRow: 0,
      maxRow: 3,
      minCol: 0,
      maxCol: 3,
    });
    expect(leaf.getCellValue(board, 0, 0)).toBe(0);
    expect(leaf.getCellValue(board, 0, 4)).toBeNull();
    expect(leaf.setCellValue(board, 0, 4, 1)).toBe(false);
    expect(leaf.collectBoardCoordinates(board)).toEqual(expect.arrayContaining([
      { row: 0, col: 0 },
      { row: 3, col: 3 },
    ]));

    expect(SharedBoardUtils.resolveBoardBounds(context)).toEqual({
      minRow: 0,
      maxRow: 3,
      minCol: 0,
      maxCol: 4,
    });
    expect(SharedBoardUtils.getCellValue(context, 0, 0)).toBeNull();
    expect(SharedBoardUtils.getCellValue(context, 0, 4)).toBe(-1);
    expect(SharedBoardUtils.setCellValue(context, 0, 4, 1)).toBe(true);
    expect(SharedBoardUtils.getCellValue(context, 0, 4)).toBe(1);
    expect(SharedBoardUtils.setCellValue(context, 0, 0, -1)).toBe(false);
    expect(SharedBoardUtils.collectBoardCoordinates(context)).toEqual(
      expect.arrayContaining([
        { row: 0, col: 1 },
        { row: 0, col: 4 },
        { row: 3, col: 3 },
      ]),
    );
  });
});
