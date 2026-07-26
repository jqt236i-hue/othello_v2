export interface CellCoord {
  row: number;
  col: number;
}
export interface BoardBounds {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}
export interface CornerDependencies {
  toBoardCellKey: (row: number, col: number) => string;
  collectBoardCoordinates: (board: unknown) => CellCoord[];
  hasPlayableCell: (board: unknown, row: number, col: number) => boolean;
  resolveBoardBounds: (
    boardOrRows: unknown,
    maybeCols?: unknown,
  ) => BoardBounds | null;
  getShapeCacheKey?: (board: unknown) => object | null;
}

export function createBoardCorners(deps: CornerDependencies) {
  const cornerKeyCache = new WeakMap<object, ReadonlySet<string>>();

  function computeCornerKeySet(board: unknown): Set<string> {
    const coords = deps.collectBoardCoordinates(board);
    const coordKeys = new Set(
      coords.map((cell) => deps.toBoardCellKey(cell.row, cell.col)),
    );
    const quadrants = [
      { vertical: -1, horizontal: -1 },
      { vertical: -1, horizontal: 1 },
      { vertical: 1, horizontal: -1 },
      { vertical: 1, horizontal: 1 },
    ];
    const corners = new Set<string>();
    for (const cell of coords) {
      for (const quadrant of quadrants) {
        const verticalKey = deps.toBoardCellKey(
          cell.row + quadrant.vertical,
          cell.col,
        );
        const horizontalKey = deps.toBoardCellKey(
          cell.row,
          cell.col + quadrant.horizontal,
        );
        if (!coordKeys.has(verticalKey) && !coordKeys.has(horizontalKey))
          corners.add(deps.toBoardCellKey(cell.row, cell.col));
      }
    }
    return corners;
  }

  function readCornerKeySet(board: unknown): ReadonlySet<string> {
    const cacheKey = deps.getShapeCacheKey?.(board) || null;
    if (!cacheKey) return computeCornerKeySet(board);
    const cached = cornerKeyCache.get(cacheKey);
    if (cached) return cached;
    const computed = computeCornerKeySet(board);
    cornerKeyCache.set(cacheKey, computed);
    return computed;
  }

  function buildCornerKeySet(board: unknown): Set<string> {
    return new Set(readCornerKeySet(board));
  }
  function isCornerCell(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (boardOrRows && typeof boardOrRows === "object") {
      if (!deps.hasPlayableCell(boardOrRows, row, col)) return false;
      if (Array.isArray(boardOrRows)) {
        const bounds = deps.resolveBoardBounds(boardOrRows);
        if (!bounds) return false;
        return (
          (row === bounds.minRow || row === bounds.maxRow) &&
          (col === bounds.minCol || col === bounds.maxCol)
        );
      }
      return readCornerKeySet(boardOrRows).has(
        deps.toBoardCellKey(row, col),
      );
    }
    const bounds = deps.resolveBoardBounds(boardOrRows, maybeCols);
    return (
      !!bounds &&
      (row === bounds.minRow || row === bounds.maxRow) &&
      (col === bounds.minCol || col === bounds.maxCol)
    );
  }
  function isEdgeCell(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (boardOrRows && typeof boardOrRows === "object") {
      if (!deps.hasPlayableCell(boardOrRows, row, col)) return false;
      if (Array.isArray(boardOrRows)) {
        const bounds = deps.resolveBoardBounds(boardOrRows);
        if (!bounds) return false;
        return (
          row === bounds.minRow ||
          row === bounds.maxRow ||
          col === bounds.minCol ||
          col === bounds.maxCol
        );
      }
      return [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1],
      ].some((pos) => !deps.hasPlayableCell(boardOrRows, pos[0], pos[1]));
    }
    const bounds = deps.resolveBoardBounds(boardOrRows, maybeCols);
    return (
      !!bounds &&
      (row === bounds.minRow ||
        row === bounds.maxRow ||
        col === bounds.minCol ||
        col === bounds.maxCol)
    );
  }
  function getCornerCells(board: unknown): CellCoord[] {
    const cornerKeys = readCornerKeySet(board);
    return deps
      .collectBoardCoordinates(board)
      .filter((cell) =>
        cornerKeys.has(deps.toBoardCellKey(cell.row, cell.col)),
      );
  }
  function getPerimeterCells(board: unknown): CellCoord[] {
    return deps
      .collectBoardCoordinates(board)
      .filter((cell) => isEdgeCell(cell.row, cell.col, board));
  }
  function isEffectiveCornerCell(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    return isCornerCell(row, col, boardOrRows, maybeCols);
  }
  function isEffectiveEdgeCell(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    return isEdgeCell(row, col, boardOrRows, maybeCols);
  }
  return {
    buildCornerKeySet,
    getCornerCells,
    getPerimeterCells,
    getEffectiveCornerCells: getCornerCells,
    getEffectiveEdgeCells: getPerimeterCells,
    isCornerCell,
    isEdgeCell,
    isEffectiveCornerCell,
    isEffectiveEdgeCell,
  };
}
