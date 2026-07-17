import { createExpansionSockets } from "../shared/board/expansion-sockets";

const SharedBoardUtils = require("../shared/shared-board-utils");

function createBoard(rows = 4, cols = 4): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function attachShape(
  board: number[][],
  options: Record<string, unknown> = {},
): number[][] {
  SharedBoardUtils.attachBoardShape(board, options);
  return board;
}

describe("shared board expansion sockets", () => {
  const leaf = createExpansionSockets({
    toBoardCellKey: SharedBoardUtils.toBoardCellKey,
    buildBoardTopology: SharedBoardUtils.buildBoardTopology,
  });

  test("enumerates stable edge sockets on every side and keeps corner directions distinct", () => {
    const board = attachShape(createBoard());
    const sockets = leaf.getBoardExpansionEdgeSockets(board);

    expect(sockets).toHaveLength(16);
    expect(
      sockets.filter(
        (socket) => socket.anchor.row === 0 && socket.anchor.col === 0,
      ),
    ).toEqual([
      {
        kind: "edge",
        anchor: { row: 0, col: 0 },
        direction: { row: -1, col: 0 },
        directionKey: "up",
        additions: [{ row: -1, col: 0 }],
      },
      {
        kind: "edge",
        anchor: { row: 0, col: 0 },
        direction: { row: 0, col: -1 },
        directionKey: "left",
        additions: [{ row: 0, col: -1 }],
      },
    ]);
    expect(sockets.map((socket) => socket.directionKey)).toEqual([
      "up",
      "left",
      "up",
      "up",
      "up",
      "right",
      "left",
      "right",
      "left",
      "right",
      "down",
      "left",
      "down",
      "down",
      "right",
      "down",
    ]);
  });

  test("enumerates the four canonical corner sockets with three additions each", () => {
    const board = attachShape(createBoard());
    const sockets = leaf.getBoardExpansionCornerSockets(board);

    expect(sockets).toEqual([
      {
        kind: "corner",
        anchor: { row: 0, col: 0 },
        direction: { row: -1, col: -1 },
        directionKey: "up-left",
        additions: [
          { row: -1, col: 0 },
          { row: 0, col: -1 },
          { row: -1, col: -1 },
        ],
      },
      {
        kind: "corner",
        anchor: { row: 0, col: 3 },
        direction: { row: -1, col: 1 },
        directionKey: "up-right",
        additions: [
          { row: -1, col: 3 },
          { row: 0, col: 4 },
          { row: -1, col: 4 },
        ],
      },
      {
        kind: "corner",
        anchor: { row: 3, col: 0 },
        direction: { row: 1, col: -1 },
        directionKey: "down-left",
        additions: [
          { row: 4, col: 0 },
          { row: 3, col: -1 },
          { row: 4, col: -1 },
        ],
      },
      {
        kind: "corner",
        anchor: { row: 3, col: 3 },
        direction: { row: 1, col: 1 },
        directionKey: "down-right",
        additions: [
          { row: 4, col: 3 },
          { row: 3, col: 4 },
          { row: 4, col: 4 },
        ],
      },
    ]);
  });

  test("classifies only outside-connected holes as exterior and never overwrites a hole", () => {
    const board = attachShape(createBoard(), {
      cardState: {
        markers: [
          {
            kind: "specialStone",
            row: 0,
            col: 0,
            data: { type: "METEOR_HOLE" },
          },
          {
            kind: "specialStone",
            row: 2,
            col: 2,
            data: { type: "METEOR_HOLE" },
          },
        ],
      },
    });

    const exterior = leaf.getExteriorVoidKeys(board);
    expect(exterior.has("0,0")).toBe(true);
    expect(exterior.has("2,2")).toBe(false);
    expect(
      leaf
        .getBoardExpansionEdgeSockets(board)
        .some((socket) =>
          socket.additions.some((cell) => cell.row === 0 && cell.col === 0),
        ),
    ).toBe(false);
    expect(
      leaf
        .getBoardExpansionCornerSockets(board)
        .some((socket) =>
          socket.additions.some((cell) => cell.row === 0 && cell.col === 0),
        ),
    ).toBe(false);
  });

  test("recomputes sockets from active expansion cells inside the current candidate bounds", () => {
    const board = attachShape(createBoard(), {
      boardExpansion: {
        cells: [{ side: "top", row: -1, col: 1, owner: 0 }],
      },
    });
    const edgeSockets = leaf.getBoardExpansionEdgeSockets(board);
    const cornerSockets = leaf.getBoardExpansionCornerSockets(board);
    const topology = SharedBoardUtils.buildBoardTopology(board, {
      boardConfig: board,
    });

    expect(
      edgeSockets.some(
        (socket) =>
          socket.anchor.row === 0 &&
          socket.anchor.col === 1 &&
          socket.directionKey === "up",
      ),
    ).toBe(false);
    expect(edgeSockets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchor: { row: -1, col: 1 },
          directionKey: "up",
          additions: [{ row: -2, col: 1 }],
        }),
      ]),
    );
    expect(
      [...edgeSockets, ...cornerSockets].every((socket) =>
        socket.additions.every(
          (cell) =>
            cell.row >= topology.candidateBounds.minRow &&
            cell.row <= topology.candidateBounds.maxRow &&
            cell.col >= topology.candidateBounds.minCol &&
            cell.col <= topology.candidateBounds.maxCol,
        ),
      ),
    ).toBe(true);
  });

  test("shared facade delegates to the canonical socket helper", () => {
    const board = attachShape(createBoard());
    expect(SharedBoardUtils.getBoardExpansionEdgeSockets(board)).toEqual(
      leaf.getBoardExpansionEdgeSockets(board),
    );
    expect(SharedBoardUtils.getBoardExpansionCornerSockets(board)).toEqual(
      leaf.getBoardExpansionCornerSockets(board),
    );
  });
});
