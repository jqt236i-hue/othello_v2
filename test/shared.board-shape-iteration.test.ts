import { createShapeIteration } from "../shared/board/shape-iteration";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board shape iteration", () => {
  test("keeps main and attached expansion visitation and disc counts fixture-equivalent", () => {
    const leaf = createShapeIteration({
      black: 1,
      white: -1,
      resolveBoardConfig: SharedBoardUtils.resolveBoardConfig,
      collectExpansionDescriptors: SharedBoardUtils.collectExpansionDescriptors,
      getBoardShapeMeta: SharedBoardUtils.getBoardShapeMeta,
      countDiscsViaBoardUtils: null,
    });
    const board = [
      [1, 0, 0, 0],
      [0, -1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    SharedBoardUtils.attachBoardShape(board, {
      boardExpansion: {
        cells: [{ side: "bottom", row: 4, col: 2, owner: -1 }],
      },
    });
    const visited: string[] = [];
    leaf.forEachBoardShapeCell(board, (row, col, value, side) =>
      visited.push(`${row},${col}:${value}:${side || "main"}`),
    );

    expect(visited).toHaveLength(17);
    expect(visited).toContain("4,2:-1:bottom");
    expect(leaf.countDiscsByPlayer(board)).toEqual({ black: 1, white: 2 });
    expect(SharedBoardUtils.countDiscsByPlayer(board)).toEqual(
      leaf.countDiscsByPlayer(board),
    );
  });
});
