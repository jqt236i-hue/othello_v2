const SharedBoardUtils = require("../shared/shared-board-utils");

function createGameState(
  rows = 4,
  cols = 4,
  options: Record<string, unknown> = {},
) {
  return {
    board: Array.from({ length: rows }, () => Array(cols).fill(0)),
    boardConfig: options.boardConfig || {
      rows,
      cols,
      shape: "rectangle",
    },
    boardExpansion: options.boardExpansion || { cells: [] },
  };
}

describe("shared board explicit context", () => {
  test("keeps shape sources explicit and clones contexts independently", () => {
    const gameState = createGameState(4, 4, {
      boardExpansion: {
        cells: [{ side: "right", row: 1, col: 4, owner: -1 }],
      },
    });
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
    const view = SharedBoardUtils.createBoardView(context.gameState, {
      cardState: context.cardState,
    });
    const clone = SharedBoardUtils.cloneBoardContext(context);
    const clonedView = SharedBoardUtils.createBoardView(clone.gameState, {
      cardState: clone.cardState,
    });

    expect(Object.isFrozen(context)).toBe(true);
    expect(view.isPlayable(0, 0)).toBe(false);
    expect(view.get(1, 4)).toBe(-1);
    expect(clonedView).not.toBe(view);
    expect(clonedView.topology.playableKeys).not.toBe(
      view.topology.playableKeys,
    );

    expect(SharedBoardUtils.setCellValue(clone, 1, 4, 1)).toBe(true);
    expect(SharedBoardUtils.getCellValue(clone, 1, 4)).toBe(1);
    expect(SharedBoardUtils.getCellValue(context, 1, 4)).toBe(-1);
    expect(view.topology.contentBounds).toEqual({
      minRow: 0,
      maxRow: 3,
      minCol: 0,
      maxCol: 4,
    });
  });

  test("rebuilds a view after explicit expansion and hole sources mutate", () => {
    const gameState = createGameState(4, 4, {
      boardExpansion: {
        cells: [{ side: "right", row: 1, col: 4, owner: 0 }],
      },
    });
    const cardState: any = { markers: [] };
    const context = SharedBoardUtils.createBoardContext(gameState, cardState);
    const initial = SharedBoardUtils.createBoardView(context.gameState, {
      cardState: context.cardState,
    });

    expect(initial.isPlayable(1, 4)).toBe(true);
    gameState.boardExpansion.cells.push({
      side: "right",
      row: 1,
      col: 5,
      owner: -1,
    });
    cardState.markers.push({
      kind: "specialStone",
      row: 1,
      col: 4,
      data: { type: "METEOR_HOLE" },
    });

    const refreshed = SharedBoardUtils.createBoardView(context.gameState, {
      cardState: context.cardState,
    });
    expect(refreshed).not.toBe(initial);
    expect(refreshed.isPlayable(1, 4)).toBe(false);
    expect(refreshed.isPlayable(1, 5)).toBe(true);
    expect(refreshed.get(1, 5)).toBe(-1);
  });

  test("rebuilds a cached view after only an expansion side changes", () => {
    const gameState = createGameState(4, 4, {
      boardExpansion: {
        cells: [{ side: "right", row: 1, col: 4, owner: 0 }],
      },
    });
    const cardState = { markers: [] };
    const initial = SharedBoardUtils.createBoardView(gameState, {
      cardState,
    });

    expect(initial.topology.expansionSideByKey.get("1,4")).toBe("right");
    gameState.boardExpansion.cells[0].side = "left";

    const refreshed = SharedBoardUtils.createBoardView(gameState, {
      cardState,
    });
    expect(refreshed).not.toBe(initial);
    expect(refreshed.topology.expansionSideByKey.get("1,4")).toBe("left");
  });

  test("excludes a base-shape void without treating it as a meteor hole", () => {
    const gameState = createGameState(10, 10, {
      boardConfig: { rows: 10, cols: 10, shape: "circle" },
    });
    const context = SharedBoardUtils.createBoardContext(gameState, {
      markers: [],
    });
    const view = SharedBoardUtils.createBoardView(context.gameState, {
      cardState: context.cardState,
    });

    expect(view.topology.playableKeys.size).toBe(80);
    expect(view.topology.playableKeys.has("0,0")).toBe(false);
    expect(view.topology.holeKeys.has("0,0")).toBe(false);
    expect(view.topology.playableKeys.has("4,4")).toBe(true);
    expect(SharedBoardUtils.isStandardBoard8x8(context)).toBe(false);
  });

  test("does not overwrite one 4x4 context when another context changes METEOR_HOLE interpretation", () => {
    const gameState = createGameState();
    const withHole = SharedBoardUtils.createBoardContext(gameState, {
      markers: [
        {
          kind: "specialStone",
          row: 0,
          col: 0,
          data: { type: "METEOR_HOLE" },
        },
      ],
    });
    const withoutHole = SharedBoardUtils.createBoardContext(gameState, {
      markers: [],
    });

    const holeViewBefore = SharedBoardUtils.createBoardView(
      withHole.gameState,
      { cardState: withHole.cardState },
    );
    const plainView = SharedBoardUtils.createBoardView(
      withoutHole.gameState,
      { cardState: withoutHole.cardState },
    );
    const holeViewAfter = SharedBoardUtils.createBoardView(
      withHole.gameState,
      { cardState: withHole.cardState },
    );

    expect(holeViewBefore.get(0, 0)).toBeNull();
    expect(holeViewBefore.count().empty).toBe(15);
    expect(plainView.get(0, 0)).toBe(0);
    expect(plainView.count().empty).toBe(16);
    expect(holeViewBefore.get(0, 0)).toBeNull();
    expect(holeViewAfter.get(0, 0)).toBeNull();
    expect(holeViewAfter.count().empty).toBe(15);

    expect(SharedBoardUtils.countBoardEmpties(withHole)).toBe(15);
    expect(SharedBoardUtils.countBoardEmpties(withoutHole)).toBe(16);
    expect(SharedBoardUtils.countBoardEmpties(withHole)).toBe(15);
  });
});
