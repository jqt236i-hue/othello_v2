export interface CellCoord {
  row: number;
  col: number;
}

/** The read-only part of a resolved board view used by the view-scoped paths. */
export interface ControlCountBoardView {
  coordinates: readonly CellCoord[];
  isPlayable: (row: number, col: number) => boolean;
  get: (row: number, col: number) => number | null;
}

export interface ControlCountDependencies {
  getCellValue: (board: unknown, row: number, col: number) => number | null;
  getCornerCells: (board: unknown) => CellCoord[];
  collectBoardCoordinates: (board: unknown) => CellCoord[];
  isEdgeCell: (row: number, col: number, board: unknown) => boolean;
  isCornerCell: (row: number, col: number, board: unknown) => boolean;
  /** Resolves a game/card-state board once; null keeps the generic helper path. */
  resolveBoardView?: (board: unknown) => ControlCountBoardView | null;
  computeCornerKeySetForCoordinates?: (coords: readonly CellCoord[]) => ReadonlySet<string>;
  toBoardCellKey?: (row: number, col: number) => string;
}

export function createControlCounts(deps: ControlCountDependencies) {
  // Each generic helper call re-resolves a state-backed board. The view path
  // resolves it once per count and applies the same membership, corner and
  // owner rules in the same coordinate order.
  function resolveView(board: unknown): ControlCountBoardView | null {
    if (
      typeof deps.resolveBoardView !== "function"
      || typeof deps.computeCornerKeySetForCoordinates !== "function"
      || typeof deps.toBoardCellKey !== "function"
    ) return null;
    return deps.resolveBoardView(board);
  }

  function countCornerControl(board: unknown, playerValue: number): { ownCorners: number; oppCorners: number } {
    if (!board || typeof board !== "object") return { ownCorners: 0, oppCorners: 0 };
    let ownCorners = 0;
    let oppCorners = 0;
    const view = resolveView(board);
    if (view) {
      const cornerKeys = deps.computeCornerKeySetForCoordinates!(view.coordinates);
      for (const cell of view.coordinates) {
        if (!cornerKeys.has(deps.toBoardCellKey!(cell.row, cell.col))) continue;
        const value = view.get(cell.row, cell.col);
        if (value === playerValue) ownCorners += 1;
        else if (value === -playerValue) oppCorners += 1;
      }
      return { ownCorners, oppCorners };
    }
    for (const cell of deps.getCornerCells(board)) {
      const value = deps.getCellValue(board, cell.row, cell.col);
      if (value === playerValue) ownCorners += 1;
      else if (value === -playerValue) oppCorners += 1;
    }
    return { ownCorners, oppCorners };
  }

  function countEdgeControl(board: unknown, playerValue: number): { ownEdges: number; oppEdges: number } {
    if (!board || typeof board !== "object") return { ownEdges: 0, oppEdges: 0 };
    let ownEdges = 0;
    let oppEdges = 0;
    const view = resolveView(board);
    if (view) {
      let cornerKeys: ReadonlySet<string> | null = null;
      for (const cell of view.coordinates) {
        const { row, col } = cell;
        if (!view.isPlayable(row, col)) continue;
        const edge = !view.isPlayable(row - 1, col)
          || !view.isPlayable(row + 1, col)
          || !view.isPlayable(row, col - 1)
          || !view.isPlayable(row, col + 1);
        if (!edge) continue;
        cornerKeys = cornerKeys || deps.computeCornerKeySetForCoordinates!(view.coordinates);
        if (cornerKeys.has(deps.toBoardCellKey!(row, col))) continue;
        const value = view.get(row, col);
        if (value === playerValue) ownEdges += 1;
        else if (value === -playerValue) oppEdges += 1;
      }
      return { ownEdges, oppEdges };
    }
    for (const cell of deps.collectBoardCoordinates(board)) {
      if (!deps.isEdgeCell(cell.row, cell.col, board) || deps.isCornerCell(cell.row, cell.col, board)) continue;
      const value = deps.getCellValue(board, cell.row, cell.col);
      if (value === playerValue) ownEdges += 1;
      else if (value === -playerValue) oppEdges += 1;
    }
    return { ownEdges, oppEdges };
  }

  return { countCornerControl, countEdgeControl };
}
