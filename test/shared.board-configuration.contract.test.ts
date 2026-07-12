import { createBoardConfiguration } from "../shared/board/configuration";

const SharedBoardUtils = require("../shared/shared-board-utils");

describe("shared board configuration contract", () => {
  const createLeaf = () =>
    createBoardConfiguration({
      defaultRows: SharedBoardUtils.DEFAULT_BOARD_ROWS,
      defaultCols: SharedBoardUtils.DEFAULT_BOARD_COLS,
      minRows: SharedBoardUtils.MIN_BOARD_ROWS,
      maxRows: SharedBoardUtils.MAX_BOARD_ROWS,
      minCols: SharedBoardUtils.MIN_BOARD_COLS,
      maxCols: SharedBoardUtils.MAX_BOARD_COLS,
      outerMin: SharedBoardUtils.OUTER_MIN,
      defaultCircleSize: SharedBoardUtils.DEFAULT_CIRCLE_BOARD_SIZE,
      minCircleSize: SharedBoardUtils.MIN_CIRCLE_BOARD_SIZE,
      maxCircleSize: SharedBoardUtils.MAX_CIRCLE_BOARD_SIZE,
      circleSizeStep: SharedBoardUtils.CIRCLE_BOARD_SIZE_STEP,
      clampBoardDimension: (value, fallback, min, max) =>
        Math.max(
          min,
          Math.min(
            max,
            Number.isFinite(Number(value))
              ? Math.floor(Number(value))
              : Number.isFinite(Number(fallback))
                ? Math.floor(Number(fallback))
                : min,
          ),
        ),
    });

  test.each([
    ["missing input", undefined, undefined, { rows: 8, cols: 8 }],
    ["numeric dimensions", 6, 9, { rows: 6, cols: 9 }],
    [
      "ragged board array",
      [
        [0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      undefined,
      { rows: 4, cols: 5 },
    ],
    [
      "direct dimensions",
      { rows: 7, cols: 6 },
      undefined,
      { rows: 7, cols: 6 },
    ],
    [
      "base bounds dimensions",
      { baseBounds: { minRow: 4, maxRow: 9, minCol: 2, maxCol: 8 } },
      undefined,
      { rows: 6, cols: 7 },
    ],
    [
      "outer bounds dimensions",
      { outerBounds: { minRow: -1, maxRow: 7, minCol: -1, maxCol: 10 } },
      undefined,
      { rows: 7, cols: 10 },
    ],
    [
      "nested boardConfig takes precedence",
      { rows: 9, cols: 9, boardConfig: { rows: 5, cols: 7 } },
      undefined,
      { rows: 5, cols: 7 },
    ],
  ])(
    "%s resolves with the established priority order",
    (_name, value, maybeCols, expected) => {
      expect(
        SharedBoardUtils.resolveBoardConfig(value, maybeCols),
      ).toMatchObject(expected);
      expect(createLeaf().resolveBoardConfig(value, maybeCols)).toEqual(
        SharedBoardUtils.resolveBoardConfig(value, maybeCols),
      );
    },
  );

  test("source extraction distinguishes snapshots from unrelated objects", () => {
    expect(
      SharedBoardUtils.extractBoardConfigSource({
        roomBoardConfig: { rows: 7, cols: 9 },
      }),
    ).toEqual({ rows: 7, cols: 9 });
    expect(
      SharedBoardUtils.maybeResolveBoardConfig({
        roomBoardConfig: { rows: 7, cols: 9 },
      }),
    ).toMatchObject({ rows: 7, cols: 9 });
    expect(
      SharedBoardUtils.extractBoardConfigSource({ unrelated: true }),
    ).toBeNull();
    expect(
      SharedBoardUtils.maybeResolveBoardConfig({ unrelated: true }),
    ).toBeNull();
    expect(
      createLeaf().extractBoardConfigSource({
        roomBoardConfig: { rows: 7, cols: 9 },
      }),
    ).toEqual({ rows: 7, cols: 9 });
    expect(
      createLeaf().maybeResolveBoardConfig({ unrelated: true }),
    ).toBeNull();
  });

  test.each([
    [5, 6],
    [6, 6],
    [7, 8],
    [10, 10],
    [12, 12],
    [15, 16],
    [17, 16],
  ])("normalizes circle size %i to supported even size %i", (requested, expectedSize) => {
    const expected = {
      rows: expectedSize,
      cols: expectedSize,
      shape: "circle",
      standard8x8: false,
    };

    expect(SharedBoardUtils.resolveBoardConfig({ rows: requested, cols: 8, shape: "circle" }))
      .toMatchObject(expected);
    expect(createLeaf().resolveBoardConfig({ rows: requested, cols: 8, shape: "circle" }))
      .toEqual(SharedBoardUtils.resolveBoardConfig({ rows: requested, cols: 8, shape: "circle" }));
  });

  test("keeps unknown shapes rectangular", () => {
    expect(SharedBoardUtils.resolveBoardConfig({ rows: 8, cols: 8, shape: "unknown" }))
      .toMatchObject({ rows: 8, cols: 8, shape: "rectangle", standard8x8: true });
  });

  test("treats a shape-only change as board geometry change", () => {
    expect(SharedBoardUtils.compareBoardGeometry(
      { rows: 10, cols: 10, shape: "rectangle" },
      { rows: 10, cols: 10, shape: "circle" },
    )).toMatchObject({ changed: true });
  });
});
