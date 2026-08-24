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
    typeof boardUtils.createBoardContext !== "function" ||
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
  cardState: unknown,
  gameState: GameState,
  deps?: SelectorsBoardShapeDeps,
): any {
  const boardUtils = requireBoardUtils(deps);
  const context = boardUtils.createBoardContext(gameState, cardState);
  return boardUtils.createBoardView(context.gameState, {
    cardState: context.cardState,
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
  cardState: unknown,
  gameState: GameState,
  deps?: SelectorsBoardShapeDeps,
): Array<{ side: string | null; row: number; col: number; owner: number }> {
  const view = createView(cardState, gameState, deps);
  return view.expansionCells
    .filter((cell: any) => view.isPlayable(cell.row, cell.col))
    .map((cell: any) => ({
      side: cell.side || null,
      row: cell.row,
      col: cell.col,
      owner: cell.owner,
    }));
}

function getCellValue(
  cardState: unknown,
  gameState: GameState,
  row: number,
  col: number,
  deps?: SelectorsBoardShapeDeps,
): any {
  return createView(cardState, gameState, deps).get(row, col);
}

function hasBoardShapeCell(
  cardState: unknown,
  gameState: GameState,
  row: number,
  col: number,
  deps?: SelectorsBoardShapeDeps,
): boolean {
  return createView(cardState, gameState, deps).isPlayable(row, col);
}

function forEachBoardShapeCell(
  cardState: unknown,
  gameState: GameState,
  visitor: (row: number, col: number, owner: number) => void,
  deps?: SelectorsBoardShapeDeps,
): void {
  if (typeof visitor !== "function") return;
  const view = createView(cardState, gameState, deps);
  for (const cell of view.coordinates) {
    const owner = view.get(cell.row, cell.col);
    if (owner === null) {
      throw new Error(`BoardView owner missing at ${cell.row},${cell.col}`);
    }
    visitor(cell.row, cell.col, owner);
  }
}

function getMeteorHoleCells(
  cardState: unknown,
  gameState: GameState,
  deps?: SelectorsBoardShapeDeps,
): Array<{ row: number; col: number }> {
  const view = createView(cardState, gameState, deps);
  return view.topology.existingCoordinates
    .filter((cell: any) =>
      view.topology.holeKeys.has(`${cell.row},${cell.col}`),
    )
    .map((cell: any) => ({ row: cell.row, col: cell.col }));
}

const CardSelectorsBoardShape = {
  resolveBoardConfig,
  isMainBoardCell,
  resolveExpansionSide,
  getExpansionCells,
  getCellValue,
  hasBoardShapeCell,
  forEachBoardShapeCell,
  getMeteorHoleCells,
};

export = CardSelectorsBoardShape;
