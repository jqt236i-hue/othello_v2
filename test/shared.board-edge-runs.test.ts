import { createEdgeRuns } from "../shared/board/edge-runs";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board edge runs", () => {
  test("keeps edge descriptors, run summaries, and lone-disc detection fixture-equivalent", () => {
    const leaf = createEdgeRuns({
      toBoardCellKey: SharedBoardUtils.toBoardCellKey,
      normalizeOwner: (value) => (value === 1 || value === -1 ? value : 0),
      getCornerCells: SharedBoardUtils.getCornerCells,
      hasPlayableCell: SharedBoardUtils.hasPlayableCell,
      isCornerCell: SharedBoardUtils.isCornerCell,
      isEdgeCell: SharedBoardUtils.isEdgeCell,
      getCellValue: SharedBoardUtils.getCellValue,
    });
    const board = Array.from({ length: 8 }, () => Array(8).fill(0));
    board[0][4] = 1;
    board[1][5] = 1;
    board[3][3] = 1;
    board[3][4] = -1;
    board[4][3] = -1;
    board[4][4] = 1;

    expect(leaf.getCornerEdgeLineDescriptors(board)).toHaveLength(8);
    expect(leaf.summarizeEdgeRuns(board, 1)).toEqual(
      SharedBoardUtils.summarizeEdgeRuns(board, 1),
    );
    expect(leaf.countAdjacentLoneEdgeDiscs(board, 0, 5, 1)).toBe(1);
    const supported = board.map((row) => row.slice());
    supported[0][3] = 1;
    expect(leaf.countAdjacentLoneEdgeDiscs(supported, 0, 5, 1)).toBe(0);
    expect(SharedBoardUtils.countAdjacentLoneEdgeDiscs(board, 0, 5, 1)).toBe(1);
  });
});
