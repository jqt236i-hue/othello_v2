const SharedBoardUtils: any = require("../shared/shared-board-utils");
const {
  createCpuWorkerBoardUtils,
} = require("../game/ai/cpu-policy-lookahead-worker-runtime");
const {
  DEFAULT_BOARD_MAX_MATRIX_DIMENSION,
  DEFAULT_BOARD_MAX_SHAPE_ENTRIES,
} = require("../shared/board/expansion-descriptors");

function createExpandedState() {
  const board = Array.from({ length: 4 }, () => Array(4).fill(0));
  board[1][3] = 1;
  return {
    board,
    boardConfig: { rows: 4, cols: 4, shape: "rectangle" },
    boardExpansion: {
      cells: [
        { side: "left", row: 2, col: -1, owner: 1 },
        { side: "right", row: 1, col: 4, owner: -1 },
        { side: "right", row: 1, col: 5, owner: 0 },
      ],
      usedByPlayer: { black: true, white: false },
    },
    presentationHistory: Array.from({ length: 256 }, (_, index) => ({
      index,
      payload: "not-search-state",
    })),
  };
}

function createCardState() {
  return {
    markers: [
      {
        kind: "specialStone",
        row: 0,
        col: 0,
        data: { type: "METEOR_HOLE" },
      },
    ],
    unrelatedHistory: Array.from({ length: 256 }, (_, index) => ({
      index,
      payload: "not-search-state",
    })),
  };
}

function readOwners(board: unknown) {
  return SharedBoardUtils.collectBoardCoordinates(board).map(
    ({ row, col }: { row: number; col: number }) => ({
      row,
      col,
      owner: SharedBoardUtils.getCellValue(board, row, col),
    }),
  );
}

describe("shared compact board search state", () => {
  test("projects canonical sparse topology once without retaining unrelated game state", () => {
    const gameState = createExpandedState();
    const cardState = createCardState();
    const canonical = SharedBoardUtils.createBoardContext(gameState, cardState);
    const search = SharedBoardUtils.prepareBoardForSearch(canonical);

    expect(SharedBoardUtils.isBoardSearchContext(search)).toBe(true);
    expect(SharedBoardUtils.isBoardContext(search)).toBe(false);
    expect(SharedBoardUtils.prepareBoardForSearch(search)).toBe(search);
    expect(Object.prototype.hasOwnProperty.call(search, "gameState")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(search, "cardState")).toBe(false);
    expect(readOwners(search)).toEqual(readOwners(canonical));
    expect(SharedBoardUtils.encodeBoard(search)).toBe(
      SharedBoardUtils.encodeBoard(canonical),
    );
    expect(SharedBoardUtils.getLegalMovesBasic(search, 1)).toEqual(
      SharedBoardUtils.getLegalMovesBasic(canonical, 1),
    );
    expect(SharedBoardUtils.hasPlayableCell(search, 0, 0)).toBe(false);
    expect(SharedBoardUtils.getCellValue(search, 0, 0)).toBeNull();
    expect(SharedBoardUtils.getCellValue(search, 2, -1)).toBe(1);

    gameState.board[1][3] = -1;
    cardState.unrelatedHistory[0].payload = "mutated-after-projection";
    expect(SharedBoardUtils.getCellValue(search, 1, 3)).toBe(1);
  });

  test("shares immutable topology across clones while isolating atomic owner updates", () => {
    const canonical = SharedBoardUtils.createBoardContext(
      createExpandedState(),
      createCardState(),
    );
    const search: any = SharedBoardUtils.prepareBoardForSearch(canonical);
    const clone: any = SharedBoardUtils.cloneBoard(search);
    const sourceEncoding = SharedBoardUtils.encodeBoard(search);
    const sharedTopology = SharedBoardUtils.buildBoardTopology(search);

    expect(SharedBoardUtils.isBoardSearchContext(clone)).toBe(true);
    expect(SharedBoardUtils.buildBoardTopology(clone)).toBe(sharedTopology);
    expect(clone.shape.playableKeys).toBe(search.shape.playableKeys);
    expect(clone.shape.meteorHoleKeys).toBe(search.shape.meteorHoleKeys);

    expect(
      SharedBoardUtils.setCellValues(clone, [
        { row: 0, col: 1, value: -1 },
        { row: 1, col: 4, value: 1 },
        { row: 1, col: 5, value: 1 },
      ]),
    ).toBe(true);
    expect(SharedBoardUtils.getCellValue(clone, 0, 1)).toBe(-1);
    expect(SharedBoardUtils.getCellValue(clone, 1, 4)).toBe(1);
    expect(SharedBoardUtils.getCellValue(clone, 1, 5)).toBe(1);
    expect(SharedBoardUtils.encodeBoard(search)).toBe(sourceEncoding);
    expect(SharedBoardUtils.getCellValue(search, 1, 4)).toBe(-1);
    expect(SharedBoardUtils.getCellValue(search, 1, 5)).toBe(0);

    const beforeRejectedUpdate = SharedBoardUtils.encodeBoard(clone);
    expect(
      SharedBoardUtils.setCellValues(clone, [
        { row: 1, col: 4, value: -1 },
        { row: 1, col: 4, value: 1 },
      ]),
    ).toBe(false);
    expect(SharedBoardUtils.encodeBoard(clone)).toBe(beforeRejectedUpdate);
    expect(SharedBoardUtils.setCellValue(clone, 0, 0, 1)).toBe(false);
    expect(SharedBoardUtils.encodeBoard(clone)).toBe(beforeRejectedUpdate);
  });

  test("applies only own indexed search updates without invoking caller iterators", () => {
    const search: any = SharedBoardUtils.prepareBoardForSearch(
      SharedBoardUtils.createBoardContext(
        createExpandedState(),
        createCardState(),
      ),
    );
    let iteratorCalls = 0;
    const updates: any[] = [{ row: 0, col: 1, value: -1 }];
    Object.defineProperty(updates, Symbol.iterator, {
      value: function* spoofedIterator() {
        iteratorCalls += 1;
        yield { row: 0, col: 2, value: 1 };
      },
    });

    expect(SharedBoardUtils.setCellValues(search, updates)).toBe(true);
    expect(SharedBoardUtils.getCellValue(search, 0, 1)).toBe(-1);
    expect(SharedBoardUtils.getCellValue(search, 0, 2)).toBe(0);
    expect(iteratorCalls).toBe(0);

    const emptyUpdates: any[] = [];
    Object.defineProperty(emptyUpdates, Symbol.iterator, {
      value: function* spoofedEmptyIterator() {
        iteratorCalls += 1;
        yield { row: 0, col: 2, value: 1 };
      },
    });
    const beforeEmptyUpdate = SharedBoardUtils.encodeBoard(search);
    expect(SharedBoardUtils.setCellValues(search, emptyUpdates)).toBe(true);
    expect(SharedBoardUtils.encodeBoard(search)).toBe(beforeEmptyUpdate);
    expect(iteratorCalls).toBe(0);
  });

  test("rejects sparse and oversized search updates without partial mutation", () => {
    const search: any = SharedBoardUtils.prepareBoardForSearch(
      SharedBoardUtils.createBoardContext(
        createExpandedState(),
        createCardState(),
      ),
    );
    const before = SharedBoardUtils.encodeBoard(search);
    const sparseUpdates: any[] = new Array(1);
    const oversizedUpdates = new Array(
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES + 1,
    );

    expect(SharedBoardUtils.setCellValues(search, sparseUpdates)).toBe(false);
    expect(
      SharedBoardUtils.setCellValues(search, oversizedUpdates),
    ).toBe(false);
    expect(SharedBoardUtils.encodeBoard(search)).toBe(before);
  });

  test("preserves meteor-hole expansion descriptors through projection and clone", () => {
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardConfig: { rows: 4, cols: 4, shape: "rectangle" },
      boardExpansion: {
        cells: [{ side: "right", row: 0, col: 4, owner: 0 }],
        usedByPlayer: { black: true, white: false },
      },
    };
    const cardState = {
      markers: [
        {
          kind: "specialStone",
          row: 0,
          col: 4,
          data: { type: "METEOR_HOLE" },
        },
      ],
    };
    const search: any = SharedBoardUtils.prepareBoardForSearch(
      SharedBoardUtils.createBoardContext(gameState, cardState),
    );
    const clone: any = SharedBoardUtils.cloneBoard(search);
    const expected = {
      side: "right",
      row: 0,
      col: 4,
      owner: 0,
    };

    for (const context of [search, clone]) {
      expect(context.shape.expansionCells).toContainEqual(expected);
      expect(context.shape.expansionOwnerByKey["0,4"]).toBe(0);
      expect(context.shape.topology.expansionKeys.has("0,4")).toBe(true);
      expect(context.shape.topology.holeKeys.has("0,4")).toBe(true);
      expect(SharedBoardUtils.getCellValue(context, 0, 4)).toBeNull();
    }
  });

  test("does not misclassify an exterior meteor-hole tombstone as a base cell", () => {
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardConfig: { rows: 4, cols: 4, shape: "rectangle" },
      boardExpansion: { cells: [] },
    };
    const cardState = {
      markers: [{
        kind: "specialStone",
        row: -1,
        col: 2,
        data: { type: "METEOR_HOLE" },
      }],
    };
    const canonical = SharedBoardUtils.createBoardContext(gameState, cardState);
    const liveTopology = SharedBoardUtils.buildBoardTopology(canonical);
    const search = SharedBoardUtils.prepareBoardForSearch(canonical);
    const searchTopology = SharedBoardUtils.buildBoardTopology(search);

    expect(liveTopology.baseKeys.has("-1,2")).toBe(false);
    expect(liveTopology.holeKeys.has("-1,2")).toBe(true);
    expect(searchTopology.baseKeys.has("-1,2")).toBe(false);
    expect(searchTopology.holeKeys.has("-1,2")).toBe(true);
    expect(searchTopology.existingKeys.has("-1,2")).toBe(true);
  });

  test("preserves a circle-envelope void meteor hole as non-base topology", () => {
    const gameState = {
      board: Array.from({ length: 10 }, () => Array(10).fill(0)),
      boardConfig: { rows: 10, cols: 10, shape: "circle" },
      boardExpansion: { cells: [] },
    };
    const cardState = {
      markers: [{
        kind: "specialStone",
        row: 0,
        col: 0,
        data: { type: "METEOR_HOLE" },
      }],
    };
    const canonical = SharedBoardUtils.createBoardContext(gameState, cardState);
    const liveTopology = SharedBoardUtils.buildBoardTopology(canonical);
    const search = SharedBoardUtils.prepareBoardForSearch(canonical);
    const searchTopology = SharedBoardUtils.buildBoardTopology(search);

    expect(liveTopology.baseKeys.has("0,0")).toBe(false);
    expect(liveTopology.holeKeys.has("0,0")).toBe(true);
    expect(searchTopology.baseKeys.has("0,0")).toBe(false);
    expect(searchTopology.holeKeys.has("0,0")).toBe(true);
    expect(searchTopology.existingKeys.has("0,0")).toBe(true);
  });

  test("preserves a circle-envelope expansion owner over its dense void", () => {
    const board = Array.from({ length: 10 }, () => Array(10).fill(0));
    board[0][0] = 1;
    const gameState = {
      board,
      boardConfig: { rows: 10, cols: 10, shape: "circle" },
      boardExpansion: {
        cells: [{ side: "top", row: 0, col: 0, owner: -1 }],
        usedByPlayer: { black: true, white: false },
      },
    };
    const canonical = SharedBoardUtils.createBoardContext(gameState, {
      markers: [],
    });
    const search = SharedBoardUtils.prepareBoardForSearch(canonical);

    expect(SharedBoardUtils.getCellValue(search, 0, 0)).toBe(-1);
    expect(SharedBoardUtils.encodeBoard(search)).toBe(
      SharedBoardUtils.encodeBoard(canonical),
    );
    expect(SharedBoardUtils.collectBoardCoordinates(search)).toEqual(
      SharedBoardUtils.collectBoardCoordinates(canonical),
    );
  });

  test("does not accept a shape-compatible forged object as a search context", () => {
    expect(
      SharedBoardUtils.isBoardSearchContext({
        kind: SharedBoardUtils.BOARD_SEARCH_CONTEXT_KIND,
        board: [[0]],
        shape: {
          playableKeys: new Set(["0,0"]),
        },
      }),
    ).toBe(false);
  });

  test("exposes immutable topology and expansion snapshots across clones", () => {
    const search: any = SharedBoardUtils.prepareBoardForSearch(
      SharedBoardUtils.createBoardContext(
        createExpandedState(),
        createCardState(),
      ),
    );
    const clone: any = SharedBoardUtils.cloneBoard(search);

    expect(Object.isFrozen(search)).toBe(true);
    expect(Object.isFrozen(search.board)).toBe(true);
    expect(Object.isFrozen(search.board[0])).toBe(true);
    expect(Object.isFrozen(search.shape)).toBe(true);
    expect(typeof search.shape.playableKeys.delete).toBe("undefined");
    expect(typeof search.shape.meteorHoleKeys.add).toBe("undefined");
    expect(Object.isFrozen(search.shape.expansionCells)).toBe(true);
    expect(Object.isFrozen(search.shape.expansionCells[0])).toBe(true);
    expect(Object.isFrozen(search.shape.expansionOwnerByKey)).toBe(true);
    expect(Object.isFrozen(search.shape.topology)).toBe(true);
    expect(typeof search.shape.topology.playableKeys.add).toBe("undefined");
    expect(typeof search.shape.topology.expansionSideByKey.set).toBe(
      "undefined",
    );

    expect(SharedBoardUtils.setCellValue(clone, 1, 4, 1)).toBe(true);
    expect(clone.shape.expansionOwnerByKey["1,4"]).toBe(1);
    expect(clone.shape.expansionCells).toContainEqual(
      expect.objectContaining({ row: 1, col: 4, owner: 1 }),
    );
    expect(search.shape.expansionOwnerByKey["1,4"]).toBe(-1);
    expect(search.shape.expansionCells).toContainEqual(
      expect.objectContaining({ row: 1, col: 4, owner: -1 }),
    );

    const sourceEncoding = SharedBoardUtils.encodeBoard(search);
    expect(() => {
      search.board[1][3] = -1;
    }).toThrow();
    expect(SharedBoardUtils.encodeBoard(search)).toBe(sourceEncoding);
  });

  test("fails closed on noncanonical keys and split expansion authority", () => {
    const worker = createCpuWorkerBoardUtils();
    const matrix = Array.from({ length: 2 }, () => Array(2).fill(0));
    const baseShape = {
      minRow: 0,
      maxRow: 1,
      minCol: 0,
      maxCol: 2,
      baseRows: 2,
      baseCols: 2,
      baseKeys: ["0,0", "0,1", "1,0", "1,1"],
      playableKeys: ["0,0", "0,1", "1,0", "1,1", "0,2"],
      meteorHoleKeys: [],
      expansionCells: [{ side: "right", row: 0, col: 2, owner: 0 }],
      expansionOwnerByKey: { "0,2": 0 },
      standard8x8: false,
    };

    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        playableKeys: ["00,0"],
      })
    ).toThrow(/not canonical/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        expansionCells: [
          { side: "right", row: 0, col: 2, owner: 0 },
          { side: "right", row: 0, col: 2, owner: 0 },
        ],
      })
    ).toThrow(/Duplicate search expansion cell/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        expansionOwnerByKey: {
          "0,2": 0,
          "0,1": 0,
        },
      })
    ).toThrow(/identical keys/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        expansionOwnerByKey: { "0,2": -1 },
      })
    ).toThrow(/inconsistent/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        baseKeys: [...baseShape.baseKeys, "0,2"],
      })
    ).toThrow(/base and expansion keys overlap/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        baseKeys: ["0,0", "0,1", "1,0"],
      })
    ).toThrow(/has no base or expansion authority/);
  });

  test("rejects inexact bounds and missing or overlapping shape authority", () => {
    const worker = createCpuWorkerBoardUtils();
    const matrix = Array.from({ length: 2 }, () => Array(2).fill(0));
    const baseShape: any = {
      minRow: 0,
      maxRow: 1,
      minCol: 0,
      maxCol: 1,
      baseRows: 2,
      baseCols: 2,
      baseKeys: ["0,0", "0,1", "1,0", "1,1"],
      playableKeys: ["0,0", "0,1", "1,0", "1,1"],
      meteorHoleKeys: [],
      expansionCells: [],
      expansionOwnerByKey: {},
      standard8x8: false,
    };

    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        maxRow: 256,
      })
    ).toThrow(/exactly match derived topology bounds/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        minRow: null,
      })
    ).toThrow(/outside the safe range/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        minRow: "0",
      })
    ).toThrow(/outside the safe range/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        playableKeys: undefined,
      })
    ).toThrow(/playable key must be an array or iterable set/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        baseKeys: undefined,
      })
    ).toThrow(/base key must be an array or iterable set/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        expansionOwnerByKey: undefined,
      })
    ).toThrow(/expansionOwnerByKey must be an object/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        meteorHoleKeys: ["0,0"],
      })
    ).toThrow(/overlap/);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        playableKeys: [],
      })
    ).toThrow(/at least one existing key/);

    const sparseOuter: any[] = new Array(2);
    sparseOuter[0] = [0, 0];
    expect(() =>
      worker.createBoardContext(sparseOuter, baseShape)
    ).toThrow(/row 1 is missing/);

    const sparseInner: any[][] = [
      new Array(2),
      [0, 0],
    ];
    sparseInner[0][1] = 0;
    expect(() =>
      worker.createBoardContext(sparseInner, baseShape)
    ).toThrow(/cell 0,0 is missing/);

    const sparseExpansionCells: any[] = new Array(1);
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        expansionCells: sparseExpansionCells,
      })
    ).toThrow(/expansion cell 0 is missing/);
  });

  test("rejects matrix/base dimension mismatches and oversized search sources", () => {
    const worker = createCpuWorkerBoardUtils();
    const mismatchedMatrix = Array.from(
      { length: 4 },
      () => Array(5).fill(0),
    );
    const playableKeys = Array.from({ length: 4 }, (_, row) =>
      Array.from({ length: 5 }, (_, col) => `${row},${col}`),
    ).flat();
    const mismatchedShape = {
      minRow: 0,
      maxRow: 3,
      minCol: 0,
      maxCol: 4,
      baseRows: 4,
      baseCols: 4,
      baseKeys: playableKeys,
      playableKeys,
      meteorHoleKeys: [],
      expansionCells: [],
      expansionOwnerByKey: {},
      standard8x8: false,
    };

    expect(() =>
      worker.createBoardContext(mismatchedMatrix, mismatchedShape)
    ).toThrow(/base dimensions must match the dense matrix/);

    const oversizedMatrix = Array.from(
      { length: DEFAULT_BOARD_MAX_MATRIX_DIMENSION + 1 },
      () => [0],
    );
    expect(() =>
      worker.createBoardContext(oversizedMatrix, {
        ...mismatchedShape,
        baseRows: oversizedMatrix.length,
        baseCols: 1,
      })
    ).toThrow(/non-empty bounded matrix/);

    const oversizedExpansionCells = new Array(
      DEFAULT_BOARD_MAX_SHAPE_ENTRIES + 1,
    );
    expect(() =>
      worker.createBoardContext([[0]], {
        minRow: 0,
        maxRow: 0,
        minCol: 0,
        maxCol: 0,
        baseRows: 1,
        baseCols: 1,
        baseKeys: ["0,0"],
        playableKeys: ["0,0"],
        meteorHoleKeys: [],
        expansionCells: oversizedExpansionCells,
        expansionOwnerByKey: {},
        standard8x8: false,
      })
    ).toThrow(/expansionCells exceeds the bounded shape size/);
  });

  test("preserves an all-hole terminal topology without inventing playable cells", () => {
    const worker = createCpuWorkerBoardUtils();
    const context = worker.createBoardContext(
      Array.from({ length: 2 }, () => Array(2).fill(0)),
      {
        minRow: 0,
        maxRow: 1,
        minCol: 0,
        maxCol: 1,
        baseRows: 2,
        baseCols: 2,
        baseKeys: ["0,0", "0,1", "1,0", "1,1"],
        playableKeys: [],
        meteorHoleKeys: ["0,0", "0,1", "1,0", "1,1"],
        expansionCells: [],
        expansionOwnerByKey: {},
        standard8x8: false,
      },
    );

    expect(worker.collectBoardCoordinates(context)).toEqual([]);
    expect(worker.getLegalMovesBasic(context, 1)).toEqual([]);
    expect(worker.getCellValue(context, 0, 0)).toBeNull();
    expect(Array.from(context.shape.topology.holeKeys)).toEqual([
      "0,0", "0,1", "1,0", "1,1",
    ]);
  });

  test("bounds iterable keys and expansion owner maps before full materialization", () => {
    const worker = createCpuWorkerBoardUtils();
    const matrix = Array.from({ length: 2 }, () => Array(2).fill(0));
    let nextCalls = 0;
    const oversizedIterable = {
      [Symbol.iterator]() {
        let index = 0;
        return {
          next() {
            nextCalls += 1;
            const row = Math.floor(index / 513) - 16;
            const col = (index % 513) - 256;
            index += 1;
            return { value: `${row},${col}`, done: false };
          },
        };
      },
    };
    const baseShape: any = {
      minRow: 0,
      maxRow: 1,
      minCol: 0,
      maxCol: 1,
      baseRows: 2,
      baseCols: 2,
      baseKeys: ["0,0", "0,1", "1,0", "1,1"],
      playableKeys: ["0,0"],
      meteorHoleKeys: [],
      expansionCells: [],
      expansionOwnerByKey: {},
      standard8x8: false,
    };

    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        playableKeys: oversizedIterable,
      })
    ).toThrow(/bounded search shape size/);
    expect(nextCalls).toBe(8193);

    let spoofedIteratorCalls = 0;
    const spoofedArray: any = ["0,0", "0,1", "1,0", "1,1"];
    Object.defineProperty(spoofedArray, Symbol.iterator, {
      value: function* spoofedIterator() {
        spoofedIteratorCalls += 1;
        yield* oversizedIterable;
      },
    });
    const spoofedContext = worker.createBoardContext(matrix, {
      ...baseShape,
      playableKeys: spoofedArray,
    });
    expect(worker.collectBoardCoordinates(spoofedContext)).toHaveLength(4);
    expect(spoofedIteratorCalls).toBe(0);

    const oversizedOwnerMap: Record<string, number> = {};
    for (let index = 0; index < 8193; index += 1) {
      const row = Math.floor(index / 513) - 16;
      const col = (index % 513) - 256;
      oversizedOwnerMap[`${row},${col}`] = 0;
    }
    expect(() =>
      worker.createBoardContext(matrix, {
        ...baseShape,
        expansionOwnerByKey: oversizedOwnerMap,
      })
    ).toThrow(/expansionOwnerByKey exceeds the bounded shape size/);
  });

  test("accepts readonly iterable keys and isolates topology caches by kernel shape", () => {
    const worker = createCpuWorkerBoardUtils();
    const matrix = Array.from({ length: 3 }, () => Array(3).fill(0));
    const sharedExternalTopology = { mutableTag: "external" };
    const readonlyKeys = (keys: string[]) => ({
      *[Symbol.iterator]() {
        yield* keys;
      },
    });
    const makeShape = (playableKeys: string[]) => ({
      minRow: 0,
      maxRow: 2,
      minCol: 0,
      maxCol: 2,
      baseRows: 3,
      baseCols: 3,
      baseKeys: readonlyKeys(playableKeys),
      playableKeys: readonlyKeys(playableKeys),
      meteorHoleKeys: readonlyKeys([]),
      expansionCells: [],
      expansionOwnerByKey: {},
      standard8x8: false,
      topology: sharedExternalTopology,
    });
    const full = worker.createBoardContext(
      matrix,
      makeShape([
        "0,0", "0,1", "0,2",
        "1,0", "1,1", "1,2",
        "2,0", "2,1", "2,2",
      ]),
    );
    const cross = worker.createBoardContext(
      matrix,
      makeShape(["0,1", "1,0", "1,1", "1,2", "2,1"]),
    );

    expect(worker.isXSquare(1, 1, full)).toBe(true);
    expect(worker.isXSquare(1, 1, cross)).toBe(false);
    expect(full.shape.playableKeys).not.toBe(cross.shape.playableKeys);
    expect(full.shape.topology).not.toBe(sharedExternalTopology);

    sharedExternalTopology.mutableTag = "mutated";
    expect((full.shape.topology as any).mutableTag).toBeUndefined();
    expect(worker.isXSquare(1, 1, full)).toBe(true);
  });
});
