import type { GameState } from "../../../src/types";

interface SelectorsBoardShapeDeps {
  SharedBoardUtils?: any;
  SharedConstants?: any;
  P_EMPTY?: number;
}

function requireBoardUtils(deps?: SelectorsBoardShapeDeps): any {
  const boardUtils = deps && deps.SharedBoardUtils;
  if (
    !boardUtils ||
    typeof boardUtils.createBoardView !== "function" ||
    typeof boardUtils.resolveBoardConfig !== "function"
  ) {
    throw new Error(
      "SharedBoardUtils board kernel is required by CardSelectorsBoardShape",
    );
  }
  return boardUtils;
}

function resolveBoardConfig(gameState: GameState, deps?: SelectorsBoardShapeDeps): any {
  return requireBoardUtils(deps).resolveBoardConfig(gameState);
}

function createView(
  gameState: GameState,
  deps?: SelectorsBoardShapeDeps,
  cardState: unknown = null,
): any {
  return requireBoardUtils(deps).createBoardView(gameState, {
    cardState,
    strict: false,
  });
}

function isMainBoardCell(
  row: number,
  col: number,
  gameState: GameState,
  deps?: SelectorsBoardShapeDeps,
): boolean {
  return requireBoardUtils(deps).isMainBoardCell(row, col, gameState);
}

function resolveExpansionSide(
  side: string | null,
  row: number,
  col: number,
  gameState: GameState,
  deps?: SelectorsBoardShapeDeps,
): string | null {
  return requireBoardUtils(deps).resolveExpansionSide(
    side,
    row,
    col,
    gameState,
  );
}

function getExpansionCells(
  gameState: GameState,
  deps?: SelectorsBoardShapeDeps,
): Array<{ side: string | null; row: number; col: number; owner: number }> {
  return createView(gameState, deps).expansionCells.map((cell: any) => ({
    side: cell.side || null,
    row: cell.row,
    col: cell.col,
    owner: cell.owner,
  }));
}

function getCellValue(
  gameState: GameState,
  row: number,
  col: number,
  deps?: SelectorsBoardShapeDeps,
  cardState: unknown = null,
): any {
  return createView(gameState, deps, cardState).get(row, col);
}

function hasBoardShapeCell(
  gameState: GameState,
  row: number,
  col: number,
  deps?: SelectorsBoardShapeDeps,
  cardState: unknown = null,
): boolean {
  return createView(gameState, deps, cardState).has(row, col);
}

function forEachBoardShapeCell(
  gameState: GameState,
  visitor: (row: number, col: number, owner: number) => void,
  deps?: SelectorsBoardShapeDeps,
  cardState: unknown = null,
): void {
  if (typeof visitor !== "function") return;
  const view = createView(gameState, deps, cardState);
  for (const cell of view.coordinates) {
    const owner = view.get(cell.row, cell.col);
    if (owner === null) {
      throw new Error(`BoardView owner missing at ${cell.row},${cell.col}`);
    }
    visitor(cell.row, cell.col, owner);
  }
}

const CardSelectorsBoardShape = {
  resolveBoardConfig,
  isMainBoardCell,
  resolveExpansionSide,
  getExpansionCells,
  getCellValue,
  hasBoardShapeCell,
  forEachBoardShapeCell,
};

const selectorsBoardShapeRoot =
  typeof globalThis !== "undefined"
    ? (globalThis as any)
    : typeof self !== "undefined"
      ? (self as any)
      : null;
if (selectorsBoardShapeRoot && !selectorsBoardShapeRoot.CardSelectorsBoardShape) {
  selectorsBoardShapeRoot.CardSelectorsBoardShape = CardSelectorsBoardShape;
}

export = CardSelectorsBoardShape;
