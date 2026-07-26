import {
  applyBoardKernelBoundaryAllowlist,
  scanBoardKernelSource,
} from "../scripts/check-board-kernel-boundary";

describe("board kernel boundary checker", () => {
  test.each([
    [
      "game/logic/cards/example.ts",
      "const value = board.__sharedBoardShapeMeta;",
      "hidden-shape-metadata",
    ],
    [
      "game/ai/example.ts",
      "const moves = OthelloCore.getLegalMovesBasic(board, player);",
      "dense-othello-priority",
    ],
    [
      "utils/match-authority/example.ts",
      "const black = gameState.board.flat().filter((v) => v === 1).length;",
      "authority-dense-board-aggregation",
    ],
    [
      "ui/board-visual/example.ts",
      "const boardExpansion = { active: true, cells: descriptors };",
      "ui-expansion-reconstruction",
    ],
    [
      "game/logic/cards/example.ts",
      "const cells = gameState.boardExpansion.cells;",
      "consumer-expansion-interpretation",
    ],
    [
      "ui/presentation/example.ts",
      "const cells = gameState.boardExpansion.cells;",
      "consumer-expansion-interpretation",
    ],
    [
      "shared/board-hint-projection.ts",
      "const owner = gameState.board[target.row][target.col];",
      "consumer-dense-board-cell-access",
    ],
    [
      "game/logic/cards/example.ts",
      "const owner = gameState.board[target.row][target.col];",
      "consumer-dense-board-cell-access",
    ],
    [
      "game/logic/card-resolution/example.ts",
      "const owner = gameState.board[target.row][target.col];",
      "consumer-dense-board-cell-access",
    ],
    [
      "game/logic/card-resolution/example.ts",
      "const board = Array.isArray(gameState.board) ? gameState.board : [];",
      "consumer-state-board-alias",
    ],
    [
      "game/logic/cards/example.ts",
      "const fallback = require('../cards-internal/expansion-fallback');",
      "consumer-expansion-fallback-import",
    ],
    [
      "game/logic/cards/example.ts",
      "const corner = row === 7 && col === 7;",
      "fixed-board-geometry",
    ],
    [
      "game/cards/example.ts",
      "SharedBoardUtils.forEachBoardShapeCell(gameState, visit);",
      "raw-state-shape-api",
    ],
    [
      "game/logic/cards.ts",
      "const owner = gameState.board[target.row][target.col];",
      "consumer-dense-board-cell-access",
    ],
    [
      "game/logic/core.ts",
      "BoardUtils.countDiscs(gs);",
      "raw-state-shape-api",
    ],
    [
      "ui/presentation-handler.ts",
      "const owner = state.board[target.row][target.col];",
      "consumer-dense-board-cell-access",
    ],
  ])("rejects %s (%s)", (file, source, expectedRule) => {
    const violations = scanBoardKernelSource(file, source);
    expect(violations.map((violation) => violation.rule)).toContain(
      expectedRule,
    );
  });

  test("allows explicit BoardContext use", () => {
    const violations = scanBoardKernelSource(
      "game/logic/cards/example.ts",
      [
        "const boardContext = SharedBoardUtils.createBoardContext(gameState, cardState);",
        "const cells = SharedBoardUtils.collectBoardCoordinates(boardContext);",
        "const nestedCells = SharedBoardUtils.collectBoardCoordinates(context.board);",
        "const view = SharedBoardUtils.createBoardView(gameState, { cardState, strict: false });",
        "const value = SharedBoardUtils.getStateCellValue(gameState, row, col, cardState);",
      ].join("\n"),
    );
    expect(violations).toEqual([]);
  });

  test.each([
    [
      "game/logic/cards/expansion.ts",
      "BoardUtils.createBoardView(gameState, { cardState: null, strict: false });",
    ],
    [
      "game/logic/cards/expansion.ts",
      "BoardUtils.canonicalizeStateBoard(gameState, null, { strict: false });",
    ],
    [
      "game/logic/core.ts",
      "const kernel = BoardUtils; kernel.getStateCellValue(gs, row, col, null);",
    ],
    [
      "game/logic/board_ops.ts",
      [
        "const { setStateCellValue: writeCell } = RequiredBoardKernel;",
        "writeCell(gameState, row, col, value, null);",
      ].join("\n"),
    ],
    [
      "game/game-core-logic.ts",
      [
        "import { countStateDiscs as count } from '../shared/shared-board-utils';",
        "count(gameState, null);",
      ].join("\n"),
    ],
    [
      "game/logic/core.ts",
      "BoardUtils.countStateDiscs(state, state && state.cardState ? state.cardState : null);",
    ],
    [
      "game/logic/core.ts",
      "BoardUtils.countStateDiscs(gameState);",
    ],
  ])("rejects missing or null cardState in %s", (file, source) => {
    const violations = scanBoardKernelSource(file, source);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "state-kernel-null-card-state" }),
      ]),
    );
  });

  test("tracks raw-state and dense-board aliases without rejecting BoardContext variables", () => {
    const violations = scanBoardKernelSource(
      "game/logic/cards.ts",
      [
        "const kernel = BoardUtils;",
        "const board = gs.board;",
        "const owner = board[target.row][target.col];",
        "const { board: denseBoard } = gameState;",
        "const other = denseBoard[row][col];",
        "const { countBoardEmpties: count } = kernel;",
        "const empties = count(snapshot.gameState);",
        "const boardContext = kernel.createBoardContext(gameState, cardState);",
        "const cells = kernel.collectBoardCoordinates(boardContext);",
      ].join("\n"),
    );
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "consumer-state-board-alias",
          detail: "gs.board",
        }),
        expect.objectContaining({
          rule: "consumer-dense-board-cell-access",
        }),
        expect.objectContaining({ rule: "raw-state-shape-api" }),
      ]),
    );
    expect(
      violations.filter(
        (violation) =>
          violation.rule === "raw-state-shape-api" &&
          violation.line === 9,
      ),
    ).toEqual([]);
  });

  test("rejects Array.isArray gates that discard a BoardContext", () => {
    const violations = scanBoardKernelSource(
      "game/cpu-decision.ts",
      "const boardRef = context && Array.isArray(context.board) ? context.board : null;",
    );
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "board-context-array-gate",
          detail: "Array.isArray(context.board)",
        }),
      ]),
    );
  });

  test("allows only the exact dense-contract fingerprint", () => {
    const raw = scanBoardKernelSource(
      "game/ai/othello-onnx-runtime.ts",
      [
        "function isCornerMove(move: any) {",
        "  const row = Number(move.row);",
        "  return row === 7;",
        "}",
      ].join("\n"),
    );
    const filtered = applyBoardKernelBoundaryAllowlist(raw);
    expect(filtered.remaining).toEqual([]);
    expect(filtered.usage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "game/ai/othello-onnx-runtime.ts",
          rule: "fixed-board-geometry",
          scope: "isCornerMove",
          detail: "row === 7",
          actualMatches: 1,
          maxMatches: 1,
        }),
      ]),
    );
  });

  test("allows only the exact standard policy-model coordinate gate", () => {
    const raw = scanBoardKernelSource(
      "game/ai/policy-onnx-runtime.ts",
      [
        "function isStandardBoardCoordinate(value: any) {",
        "  return value.row < 8 && value.col < 8;",
        "}",
      ].join("\n"),
    );
    const filtered = applyBoardKernelBoundaryAllowlist(raw);
    expect(filtered.remaining).toEqual([]);
    expect(filtered.usage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: "game/ai/policy-onnx-runtime.ts",
          rule: "fixed-board-geometry",
          scope: "isStandardBoardCoordinate",
          detail: "value.row < 8",
          actualMatches: 1,
          maxMatches: 1,
        }),
        expect.objectContaining({
          file: "game/ai/policy-onnx-runtime.ts",
          rule: "fixed-board-geometry",
          scope: "isStandardBoardCoordinate",
          detail: "value.col < 8",
          actualMatches: 1,
          maxMatches: 1,
        }),
      ]),
    );
  });

  test("does not let a different AST scope substitute for an allowlisted violation", () => {
    const raw = scanBoardKernelSource(
      "game/ai/othello-onnx-runtime.ts",
      [
        "function isCornerMove(move: any) {",
        "  const row = Number(move.row);",
        "  return row === 7;",
        "}",
        "function unrelated(move: any) {",
        "  const row = Number(move.row);",
        "  return row === 7;",
        "}",
      ].join("\n"),
    );
    const filtered = applyBoardKernelBoundaryAllowlist(raw);
    expect(filtered.remaining).toEqual([
      expect.objectContaining({
        rule: "fixed-board-geometry",
        scope: "unrelated",
        detail: "row === 7",
      }),
    ]);
  });

  test("enforces an exact fingerprint upper bound", () => {
    const raw = scanBoardKernelSource(
      "game/ai/othello-onnx-runtime.ts",
      [
        "function isCornerMove(move: any) {",
        "  const row = Number(move.row);",
        "  return row === 7 || row === 7;",
        "}",
      ].join("\n"),
    );
    const filtered = applyBoardKernelBoundaryAllowlist(raw);
    expect(filtered.remaining).toHaveLength(2);
    expect(filtered.usage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "isCornerMove",
          detail: "row === 7",
          actualMatches: 2,
          maxMatches: 1,
        }),
      ]),
    );
  });

  test("does not let a different dense write consume the fixture exception", () => {
    const raw = scanBoardKernelSource(
      "ui/board-visual/performance-harness.ts",
      [
        "function createGameState(state: any, stone: any, first: any) {",
        "  state.board[stone.row][stone.col] = stone.color;",
        "  state.board[first.row][first.col] = 1;",
        "}",
      ].join("\n"),
    );
    const filtered = applyBoardKernelBoundaryAllowlist(raw);
    expect(filtered.remaining).toEqual([
      expect.objectContaining({
        scope: "createGameState",
        detail: "state.board[first.row][first.col]",
      }),
    ]);
  });
});
