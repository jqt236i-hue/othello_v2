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
export interface RiskCellDependencies {
  toBoardCellKey: (row: number, col: number) => string;
  collectBoardCoordinates: (board: unknown) => CellCoord[];
  hasPlayableCell: (board: unknown, row: number, col: number) => boolean;
  resolveBoardBounds: (
    boardOrRows: unknown,
    maybeCols?: unknown,
  ) => BoardBounds | null;
  getCornerCells: (board: unknown) => CellCoord[];
  isCornerCell: (
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ) => boolean;
  isEdgeCell: (
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ) => boolean;
  getShapeCacheKey?: (board: unknown) => object | null;
}

export function createRiskCells(deps: RiskCellDependencies) {
  const riskCellCache = new WeakMap<
    object,
    { xKeys: ReadonlySet<string>; cKeys: ReadonlySet<string> }
  >();

  function buildRiskCellSets(board: unknown): {
    xKeys: ReadonlySet<string>;
    cKeys: ReadonlySet<string>;
  } {
    const cacheKey = deps.getShapeCacheKey?.(board) || null;
    if (cacheKey) {
      const cached = riskCellCache.get(cacheKey);
      if (cached) return cached;
    }
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
    const xKeys = new Set<string>();
    const cKeys = new Set<string>();
    for (const cell of coords) {
      for (const quadrant of quadrants) {
        if (
          coordKeys.has(
            deps.toBoardCellKey(cell.row + quadrant.vertical, cell.col),
          ) ||
          coordKeys.has(
            deps.toBoardCellKey(cell.row, cell.col + quadrant.horizontal),
          )
        )
          continue;
        const inwardRow = cell.row - quadrant.vertical,
          inwardCol = cell.col - quadrant.horizontal;
        const xKey = deps.toBoardCellKey(inwardRow, inwardCol),
          c1Key = deps.toBoardCellKey(inwardRow, cell.col),
          c2Key = deps.toBoardCellKey(cell.row, inwardCol);
        if (coordKeys.has(xKey)) xKeys.add(xKey);
        if (coordKeys.has(c1Key)) cKeys.add(c1Key);
        if (coordKeys.has(c2Key)) cKeys.add(c2Key);
      }
    }
    const computed = { xKeys, cKeys };
    if (cacheKey) riskCellCache.set(cacheKey, computed);
    return computed;
  }
  function isCorner(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    return deps.isCornerCell(row, col, boardOrRows, maybeCols);
  }
  function isEdge(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    return deps.isEdgeCell(row, col, boardOrRows, maybeCols);
  }
  function isXSquare(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (boardOrRows && typeof boardOrRows === "object")
      return (
        deps.hasPlayableCell(boardOrRows, row, col) &&
        buildRiskCellSets(boardOrRows).xKeys.has(deps.toBoardCellKey(row, col))
      );
    const bounds = deps.resolveBoardBounds(boardOrRows, maybeCols);
    return (
      !!bounds &&
      (row === bounds.minRow + 1 || row === bounds.maxRow - 1) &&
      (col === bounds.minCol + 1 || col === bounds.maxCol - 1)
    );
  }
  function isCSquare(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (boardOrRows && typeof boardOrRows === "object")
      return (
        deps.hasPlayableCell(boardOrRows, row, col) &&
        buildRiskCellSets(boardOrRows).cKeys.has(deps.toBoardCellKey(row, col))
      );
    const bounds = deps.resolveBoardBounds(boardOrRows, maybeCols);
    if (!bounds) return false;
    const nearTopBottom =
      (row === bounds.minRow || row === bounds.maxRow) &&
      (col === bounds.minCol + 1 || col === bounds.maxCol - 1);
    const nearLeftRight =
      (col === bounds.minCol || col === bounds.maxCol) &&
      (row === bounds.minRow + 1 || row === bounds.maxRow - 1);
    return nearTopBottom || nearLeftRight;
  }
  function getCornerProximity(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): { kind: string; corner: [number, number] } | null {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    if (boardOrRows && typeof boardOrRows === "object") {
      if (!deps.hasPlayableCell(boardOrRows, row, col)) return null;
      const isX = isXSquare(row, col, boardOrRows),
        isC = !isX && isCSquare(row, col, boardOrRows);
      if (!isX && !isC) return null;
      for (const corner of deps.getCornerCells(boardOrRows)) {
        for (const vertical of [-1, 1])
          for (const horizontal of [-1, 1]) {
            if (
              deps.hasPlayableCell(
                boardOrRows,
                corner.row + vertical,
                corner.col,
              ) ||
              deps.hasPlayableCell(
                boardOrRows,
                corner.row,
                corner.col + horizontal,
              )
            )
              continue;
            const inwardRow = corner.row - vertical,
              inwardCol = corner.col - horizontal;
            if (isX && inwardRow === row && inwardCol === col)
              return { kind: "X", corner: [corner.row, corner.col] };
            if (
              isC &&
              ((inwardRow === row && corner.col === col) ||
                (corner.row === row && inwardCol === col))
            )
              return { kind: "C", corner: [corner.row, corner.col] };
          }
      }
      return null;
    }
    const bounds = deps.resolveBoardBounds(boardOrRows, maybeCols);
    if (!bounds) return null;
    const rowNearTop = row === bounds.minRow + 1,
      rowNearBottom = row === bounds.maxRow - 1,
      colNearLeft = col === bounds.minCol + 1,
      colNearRight = col === bounds.maxCol - 1;
    if ((rowNearTop || rowNearBottom) && (colNearLeft || colNearRight))
      return {
        kind: "X",
        corner: [
          rowNearTop ? bounds.minRow : bounds.maxRow,
          colNearLeft ? bounds.minCol : bounds.maxCol,
        ],
      };
    if (
      (row === bounds.minRow || row === bounds.maxRow) &&
      (colNearLeft || colNearRight)
    )
      return {
        kind: "C",
        corner: [row, colNearLeft ? bounds.minCol : bounds.maxCol],
      };
    if (
      (col === bounds.minCol || col === bounds.maxCol) &&
      (rowNearTop || rowNearBottom)
    )
      return {
        kind: "C",
        corner: [rowNearTop ? bounds.minRow : bounds.maxRow, col],
      };
    return null;
  }
  function getCellType(
    row: number,
    col: number,
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): "unknown" | "corner" | "x" | "c" | "edge" | "inner" {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return "unknown";
    if (isCorner(row, col, boardOrRows, maybeCols)) return "corner";
    if (isXSquare(row, col, boardOrRows, maybeCols)) return "x";
    if (isCSquare(row, col, boardOrRows, maybeCols)) return "c";
    return isEdge(row, col, boardOrRows, maybeCols) ? "edge" : "inner";
  }
  return {
    getCornerProximity,
    isCorner,
    isEdge,
    isXSquare,
    isCSquare,
    getCellType,
  };
}
