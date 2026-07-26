import type { GameState } from "../../../src/types";

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
  if (typeof __non_webpack_require__ !== "undefined") {
    return __non_webpack_require__(id);
  }
  if (typeof require === "function") return require(id);
  throw new Error(`Unable to require ${id}`);
}

function getRuntimeGlobalValue(key: string): any {
  if (typeof globalThis !== "undefined" && (globalThis as any)[key]) {
    return (globalThis as any)[key];
  }
  if (typeof self !== "undefined" && (self as any)[key]) {
    return (self as any)[key];
  }
  return null;
}

function safeRequire(id: string): any {
  try {
    return _require(id);
  } catch (_error) {
    return null;
  }
}

const SharedConstants =
  safeRequire("../../../shared-constants") ||
  getRuntimeGlobalValue("SharedConstants");
const BoardUtils =
  safeRequire("../../../shared/shared-board-utils") ||
  getRuntimeGlobalValue("SharedBoardUtils");

if (
  !BoardUtils ||
  typeof BoardUtils.createBoardView !== "function" ||
  typeof BoardUtils.getStateCellValue !== "function" ||
  typeof BoardUtils.setStateCellValue !== "function"
) {
  throw new Error("SharedBoardUtils board kernel is required by CardExpansionFallback");
}

const P_BLACK =
  SharedConstants && SharedConstants.BLACK !== undefined
    ? SharedConstants.BLACK
    : 1;
const P_WHITE =
  SharedConstants && SharedConstants.WHITE !== undefined
    ? SharedConstants.WHITE
    : -1;
const P_EMPTY =
  SharedConstants && SharedConstants.EMPTY !== undefined
    ? SharedConstants.EMPTY
    : 0;

function normalizeExpansionOwner(owner: any): number {
  return owner === P_BLACK || owner === P_WHITE ? owner : P_EMPTY;
}

function resolveBoardDims(gameState: GameState): { rows: number; cols: number } {
  const config = BoardUtils.resolveBoardConfig(gameState);
  return { rows: config.rows, cols: config.cols };
}

function isMainBoardCell(
  row: number,
  col: number,
  gameState: GameState,
): boolean {
  return BoardUtils.isMainBoardCell(row, col, gameState);
}

function resolveExpansionSide(
  side: any,
  row: number,
  col: number,
  gameState: GameState,
): string | null {
  return BoardUtils.resolveExpansionSide(side, row, col, gameState);
}

function isExpansionCoordinate(
  row: number,
  col: number,
  gameState: GameState,
): boolean {
  return BoardUtils.isExpansionCoordinate(row, col, gameState);
}

function getExpansionCells(
  gameState: GameState,
): Array<{ side: string | null; row: number; col: number; owner: number }> {
  return BoardUtils.createBoardView(gameState, {
    cardState: null,
    strict: false,
  }).expansionCells.map((cell: any) => ({
    side: cell.side || null,
    row: cell.row,
    col: cell.col,
    owner: cell.owner,
  }));
}

function syncLegacyExpansionFields(
  expansion: any,
  gameState: GameState,
): void {
  if (!gameState || typeof gameState !== "object") return;
  if (expansion && (gameState as any).boardExpansion !== expansion) {
    (gameState as any).boardExpansion = expansion;
  }
  const inspection = BoardUtils.canonicalizeStateBoard(gameState, null, {
    strict: false,
  });
  if (!inspection || inspection.ok !== true) {
    throw new Error("Invalid board expansion state");
  }
}

function ensureExpansionStateMutable(gameState: GameState): any {
  if (
    !(gameState as any).boardExpansion ||
    typeof (gameState as any).boardExpansion !== "object"
  ) {
    (gameState as any).boardExpansion = {
      active: false,
      side: null,
      row: null,
      col: null,
      owner: P_EMPTY,
      usedByPlayer: { black: false, white: false },
      cells: [],
    };
  }
  const expansion = (gameState as any).boardExpansion;
  if (!expansion.usedByPlayer || typeof expansion.usedByPlayer !== "object") {
    expansion.usedByPlayer = { black: false, white: false };
  }
  syncLegacyExpansionFields(expansion, gameState);
  return expansion;
}

function getCellValue(
  gameState: GameState,
  row: number,
  col: number,
): any {
  return BoardUtils.getStateCellValue(gameState, row, col, null);
}

function setCellValue(
  gameState: GameState,
  row: number,
  col: number,
  value: any,
): boolean {
  return BoardUtils.setStateCellValue(gameState, row, col, value, null);
}

const CardExpansionFallback = {
  normalizeExpansionOwner,
  resolveBoardDims,
  isMainBoardCell,
  resolveExpansionSide,
  isExpansionCoordinate,
  getExpansionCells,
  syncLegacyExpansionFields,
  ensureExpansionStateMutable,
  getCellValue,
  setCellValue,
};

const expansionFallbackRuntimeRoot =
  typeof self !== "undefined"
    ? (self as any)
    : typeof global !== "undefined"
      ? (global as any)
      : null;

if (expansionFallbackRuntimeRoot) {
  expansionFallbackRuntimeRoot.CardExpansionFallback = CardExpansionFallback;
}

export = CardExpansionFallback;
