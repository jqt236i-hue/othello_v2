const SharedBoardUtils = require("../shared/shared-board-utils");

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function createState(
  board: number[][],
  cells: any[] = [],
  boardConfig: any = {
    rows: board.length,
    cols: board[0]?.length || 0,
    shape: "rectangle",
  },
) {
  return {
    board,
    boardConfig,
    boardExpansion: {
      cells,
      usedByPlayer: { black: false, white: false },
    },
  };
}

function referenceLegalMoves(
  owners: Map<string, number>,
  player: number,
): Array<{ row: number; col: number; flips: Array<{ row: number; col: number }> }> {
  const coordinates = Array.from(owners.keys())
    .map((key) => {
      const [row, col] = key.split(",").map(Number);
      return { row, col };
    })
    .sort((left, right) => left.row - right.row || left.col - right.col);
  const out: Array<{
    row: number;
    col: number;
    flips: Array<{ row: number; col: number }>;
  }> = [];
  for (const start of coordinates) {
    if (owners.get(`${start.row},${start.col}`) !== 0) continue;
    const flips: Array<{ row: number; col: number }> = [];
    for (const [dr, dc] of DIRECTIONS) {
      const line: Array<{ row: number; col: number }> = [];
      let row = start.row + dr;
      let col = start.col + dc;
      while (owners.get(`${row},${col}`) === -player) {
        line.push({ row, col });
        row += dr;
        col += dc;
      }
      if (line.length > 0 && owners.get(`${row},${col}`) === player) {
        flips.push(...line);
      }
    }
    if (flips.length > 0) out.push({ ...start, flips });
  }
  return out;
}

describe("shared board state kernel", () => {
  test("uses repeated expansion cells for flips, legal moves, and counts", () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][3] = 1;
    const state = createState(board, [
      { side: "right", row: 1, col: 4, owner: -1 },
      { side: "right", row: 1, col: 5, owner: 0 },
    ]);
    const view = SharedBoardUtils.createBoardView(state, {
      cardState: { markers: [] },
    });

    expect(view.getFlips(1, 5, 1)).toEqual([{ row: 1, col: 4 }]);
    expect(view.getLegalMoves(1)).toContainEqual({
      row: 1,
      col: 5,
      flips: [{ row: 1, col: 4 }],
    });
    expect(view.count()).toMatchObject({ black: 1, white: 1 });
    expect(SharedBoardUtils.countStateDiscs(state, { markers: [] })).toEqual({
      black: 1,
      white: 1,
    });
  });

  test("treats a circle-envelope void expansion descriptor as its owner source", () => {
    const board = Array.from({ length: 10 }, () => Array(10).fill(0));
    board[0][0] = 1;
    const state = createState(
      board,
      [{ side: "top", row: 0, col: 0, owner: -1 }],
      { rows: 10, cols: 10, shape: "circle" },
    );
    const view = SharedBoardUtils.createBoardView(state, {
      cardState: { markers: [] },
    });

    expect(view.topology.baseKeys.has("0,0")).toBe(false);
    expect(view.topology.expansionKeys.has("0,0")).toBe(true);
    expect(view.get(0, 0)).toBe(-1);
  });

  test("keeps holes as existing non-playable tombstones", () => {
    const state = createState(Array.from({ length: 4 }, () => Array(4).fill(0)), [
      { side: "right", row: 1, col: 4, owner: 0 },
    ]);
    const cardState = {
      markers: [
        {
          kind: "specialStone",
          row: 1,
          col: 4,
          data: { type: "METEOR_HOLE" },
        },
      ],
    };
    const view = SharedBoardUtils.createBoardView(state, { cardState });

    expect(view.has(1, 4)).toBe(true);
    expect(view.isPlayable(1, 4)).toBe(false);
    expect(view.get(1, 4)).toBeNull();
  });

  test("does not revive stale legacy fields when cells is explicitly empty", () => {
    const state: any = createState(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
    );
    Object.assign(state.boardExpansion, {
      active: true,
      side: "right",
      row: 1,
      col: 4,
      owner: 1,
    });

    const view = SharedBoardUtils.createBoardView(state, {
      cardState: { markers: [] },
    });
    expect(view.expansionCells).toEqual([]);
    expect(view.has(1, 4)).toBe(false);
  });

  test("strict inspection rejects duplicate coordinates and invalid owners", () => {
    const state = createState(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
      [
        { side: "right", row: 1, col: 4, owner: 0 },
        { side: "right", row: 1, col: 4, owner: 7 },
      ],
    );
    const result = SharedBoardUtils.inspectBoardState(
      state,
      { markers: [] },
      { strict: true },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/duplicate expansion coordinate/);
  });

  test("does not let a lax cached view bypass strict hole validation", () => {
    const state = createState(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
      [{ side: "right", row: 1, col: 4, owner: -1 }],
    );
    const cardState = {
      markers: [
        {
          kind: "specialStone",
          row: 1,
          col: 4,
          data: { type: "METEOR_HOLE" },
        },
      ],
    };

    expect(
      SharedBoardUtils.createBoardView(state, {
        cardState,
        strict: false,
      }).isPlayable(1, 4),
    ).toBe(false);
    expect(() =>
      SharedBoardUtils.createBoardView(state, {
        cardState,
        strict: true,
      }),
    ).toThrow(/hole expansion cell 1,4 must be empty/);
  });

  test("does not reuse a lax cached view after an owner becomes invalid", () => {
    const state = createState(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
    );
    const cardState = { markers: [] };

    SharedBoardUtils.createBoardView(state, {
      cardState,
      strict: false,
    });
    state.board[0][0] = 7;

    expect(() =>
      SharedBoardUtils.createBoardView(state, {
        cardState,
        strict: false,
      }),
    ).toThrow(/base cell 0,0 has invalid owner/);
  });

  test("does not reuse a lax cached view after expansion cells become malformed", () => {
    const state: any = createState(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
    );
    const cardState = { markers: [] };

    SharedBoardUtils.createBoardView(state, {
      cardState,
      strict: false,
    });
    state.boardExpansion.cells = [null];

    expect(() =>
      SharedBoardUtils.createBoardView(state, {
        cardState,
        strict: false,
      }),
    ).toThrow(/boardExpansion\.cells\[0\] must be an object/);
  });

  test("applies mixed base and expansion updates atomically and invalidates the cached view once", () => {
    const state: any = createState(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
      [
        { side: "right", row: 1, col: 4, owner: -1 },
        { side: "right", row: 1, col: 5, owner: 0 },
      ],
    );
    const cardState = { markers: [] };
    const before = SharedBoardUtils.createBoardView(state, {
      cardState,
      strict: false,
    });

    expect(
      SharedBoardUtils.setStateCellValues(
        state,
        [
          { row: 0, col: 0, value: -1 },
          { row: 1, col: 4, value: 1 },
          { row: 1, col: 5, value: 1 },
        ],
        cardState,
      ),
    ).toBe(true);

    const after = SharedBoardUtils.createBoardView(state, {
      cardState,
      strict: false,
    });
    expect(after).not.toBe(before);
    expect(after.get(0, 0)).toBe(-1);
    expect(after.get(1, 4)).toBe(1);
    expect(after.get(1, 5)).toBe(1);
    expect(state.boardExpansion).toMatchObject({
      active: true,
      row: 1,
      col: 5,
      owner: 1,
    });

    const snapshot = JSON.stringify(state);
    expect(
      SharedBoardUtils.setStateCellValues(
        state,
        [
          { row: 0, col: 0, value: 1 },
          { row: 0, col: 0, value: -1 },
        ],
        cardState,
      ),
    ).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  test("keeps dense and state batch validation identical for owners and duplicate coordinates", () => {
    const dense = Array.from({ length: 2 }, () => Array(2).fill(0));
    const before = JSON.stringify(dense);

    expect(
      SharedBoardUtils.setCellValues(dense, [
        { row: 0, col: 0, value: 7 },
      ]),
    ).toBe(false);
    expect(JSON.stringify(dense)).toBe(before);

    expect(
      SharedBoardUtils.setCellValues(dense, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 0, value: -1 },
      ]),
    ).toBe(false);
    expect(JSON.stringify(dense)).toBe(before);

    expect(
      SharedBoardUtils.setCellValues(dense, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: -1 },
      ]),
    ).toBe(true);
    expect(dense).toEqual([
      [1, 0],
      [0, -1],
    ]);
  });

  test("digest ignores descriptor order and survives JSON roundtrip", () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    const cells = [
      { side: "left", row: 1, col: -1, owner: 1 },
      { side: "right", row: 2, col: 4, owner: -1 },
    ];
    const first = createState(board.map((row) => row.slice()), cells);
    const second = createState(board.map((row) => row.slice()), [...cells].reverse());
    const cardState = { markers: [] };

    const firstDigest = SharedBoardUtils.createBoardView(first, {
      cardState,
    }).boardDigest;
    const secondDigest = SharedBoardUtils.createBoardView(second, {
      cardState,
    }).boardDigest;
    const roundtripDigest = SharedBoardUtils.createBoardView(
      JSON.parse(JSON.stringify(first)),
      { cardState: JSON.parse(JSON.stringify(cardState)) },
    ).boardDigest;

    expect(secondDigest).toBe(firstDigest);
    expect(roundtripDigest).toBe(firstDigest);
  });

  test("invalidates cached views after board, expansion, hole, and config changes", () => {
    const state = createState(
      Array.from({ length: 6 }, () => Array(6).fill(0)),
      [{ side: "right", row: 1, col: 6, owner: 0 }],
      { rows: 6, cols: 6, shape: "rectangle" },
    );
    const cardState: any = { markers: [] };
    const initial = SharedBoardUtils.createBoardView(state, { cardState });
    state.board[0][0] = 1;
    const boardChanged = SharedBoardUtils.createBoardView(state, { cardState });
    state.boardExpansion.cells[0].owner = -1;
    const expansionChanged = SharedBoardUtils.createBoardView(state, {
      cardState,
    });
    cardState.markers.push({
      kind: "specialStone",
      row: 1,
      col: 6,
      data: { type: "METEOR_HOLE" },
    });
    state.boardExpansion.cells[0].owner = 0;
    const holeChanged = SharedBoardUtils.createBoardView(state, { cardState });
    state.boardConfig.shape = "circle";
    const configChanged = SharedBoardUtils.createBoardView(state, { cardState });

    expect(boardChanged).not.toBe(initial);
    expect(expansionChanged).not.toBe(boardChanged);
    expect(holeChanged).not.toBe(expansionChanged);
    expect(configChanged).not.toBe(holeChanged);
  });

  test("honors blocked and protected flip constraints", () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][1] = 1;
    board[1][2] = -1;
    const view = SharedBoardUtils.createBoardView(createState(board), {
      cardState: { markers: [] },
    });

    expect(view.getFlips(1, 3, 1)).toEqual([{ row: 1, col: 2 }]);
    expect(
      view.getFlips(1, 3, 1, { protectedKeys: new Set(["1,2"]) }),
    ).toEqual([]);
    expect(
      view.getFlips(1, 3, 1, {
        permanentProtectedKeys: new Set(["1,2"]),
      }),
    ).toEqual([]);
    expect(
      view.getFlips(1, 3, 1, { blockedKeys: new Set(["1,3"]) }),
    ).toEqual([]);
    expect(
      view.getFlips(1, 3, 1, { blockedKeys: new Set(["1,1"]) }),
    ).toEqual([]);
  });

  test("atomically adds canonical expansion cells and writes owners through state", () => {
    const state: any = createState(
      Array.from({ length: 4 }, () => Array(4).fill(0)),
      [{ side: "right", row: 2, col: 4, owner: 0 }],
    );
    const cardState = { markers: [] };

    expect(
      SharedBoardUtils.addStateExpansionCells(
        state,
        [{ side: "left", row: 1, col: -1, owner: -1 }],
        cardState,
      ),
    ).toMatchObject({ added: true });
    expect(state.boardExpansion.cells.map((cell: any) => [cell.row, cell.col])).toEqual([
      [1, -1],
      [2, 4],
    ]);
    expect(
      SharedBoardUtils.setStateCellValue(state, 2, 4, 1, cardState),
    ).toBe(true);
    expect(
      SharedBoardUtils.getStateCellValue(state, 2, 4, cardState),
    ).toBe(1);
  });

  test("matches an independent sparse reference across seeded shapes", () => {
    let seed = 0x5eed1234;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let sample = 0; sample < 32; sample += 1) {
      const board = Array.from({ length: 4 }, () =>
        Array.from({ length: 5 }, () => {
          const roll = next() % 3;
          return roll === 0 ? -1 : roll === 1 ? 0 : 1;
        }),
      );
      const cells = [
        { side: "left", row: 1, col: -1, owner: (next() % 3) - 1 },
        { side: "right", row: 2, col: 5, owner: (next() % 3) - 1 },
        { side: "top", row: -1, col: 2, owner: (next() % 3) - 1 },
      ];
      const state = createState(board, cells, {
        rows: 4,
        cols: 5,
        shape: "rectangle",
      });
      const view = SharedBoardUtils.createBoardView(state, {
        cardState: { markers: [] },
      });
      const owners = new Map<string, number>();
      for (const cell of view.coordinates) {
        owners.set(`${cell.row},${cell.col}`, view.get(cell.row, cell.col));
      }

      expect(view.getLegalMoves(1)).toEqual(referenceLegalMoves(owners, 1));
      expect(view.getLegalMoves(-1)).toEqual(referenceLegalMoves(owners, -1));
    }
  });
});
