import { createShapeIteration } from "../shared/board/shape-iteration";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board shape iteration", () => {
  test("keeps explicit state expansion visitation and context disc counts fixture-equivalent", () => {
    const leaf = createShapeIteration({
      black: 1,
      white: -1,
      resolveBoardConfig: SharedBoardUtils.resolveBoardConfig,
      collectExpansionDescriptors: SharedBoardUtils.collectExpansionDescriptors,
      countDiscsViaBoardUtils: null,
    });
    const board = [
      [1, 0, 0, 0],
      [0, -1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const gameState = {
      board,
      boardConfig: { rows: 4, cols: 4, shape: "rectangle" },
      boardExpansion: {
        cells: [{ side: "bottom", row: 4, col: 2, owner: -1 }],
      },
    };
    const context = SharedBoardUtils.createBoardContext(gameState, {
      markers: [],
    });
    const visited: string[] = [];
    leaf.forEachBoardShapeCell(gameState, (row, col, value, side) =>
      visited.push(`${row},${col}:${value}:${side || "main"}`),
    );

    expect(visited).toHaveLength(17);
    expect(visited).toContain("4,2:-1:bottom");
    expect(leaf.countDiscsByPlayer(gameState)).toEqual({ black: 1, white: 2 });
    expect(SharedBoardUtils.countDiscsByPlayer(context)).toEqual(
      leaf.countDiscsByPlayer(gameState),
    );
  });
});
