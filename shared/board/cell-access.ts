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
export interface BoardShapeMeta {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  standard8x8: boolean;
  playableKeys: Set<string>;
  coordinateCache: CellCoord[] | null;
  expansionOwnerByKey: Record<string, number>;
  expansionCells: Array<{ row: number; col: number; owner: number }>;
}
export interface CellAccessDependencies {
  defaultRows: number;
  defaultCols: number;
  empty: number;
  toBoardCellKey: (row: number, col: number) => string;
  normalizeOwner: (value: unknown) => number;
  resolveBoardConfig: (
    value: unknown,
    maybeCols?: unknown,
  ) => { rows: number; cols: number };
  getBoardShapeMeta: (board: unknown) => BoardShapeMeta | null;
}

export function createCellAccess(deps: CellAccessDependencies) {
  function isRawCellInBounds(
    board: unknown,
    row: number,
    col: number,
  ): boolean {
    return (
      Array.isArray(board) &&
      Number.isInteger(row) &&
      Number.isInteger(col) &&
      row >= 0 &&
      row < (board as unknown[][]).length &&
      Array.isArray((board as unknown[][])[row]) &&
      col >= 0 &&
      col < (board as unknown[][])[row].length
    );
  }
  function resolveBoardBounds(
    boardOrRows: unknown,
    maybeCols?: unknown,
  ): BoardBounds | null {
    if (Array.isArray(boardOrRows)) {
      const meta = deps.getBoardShapeMeta(boardOrRows);
      if (meta)
        return {
          minRow: meta.minRow,
          maxRow: meta.maxRow,
          minCol: meta.minCol,
          maxCol: meta.maxCol,
        };
      if (boardOrRows.length <= 0) return null;
      let maxCol = -1;
      for (const row of boardOrRows as unknown[][])
        if (Array.isArray(row) && row.length > 0)
          maxCol = Math.max(maxCol, row.length - 1);
      return maxCol < 0
        ? null
        : { minRow: 0, maxRow: boardOrRows.length - 1, minCol: 0, maxCol };
    }
    const config = deps.resolveBoardConfig(boardOrRows, maybeCols);
    return {
      minRow: 0,
      maxRow: config.rows - 1,
      minCol: 0,
      maxCol: config.cols - 1,
    };
  }
  function isStandardBoard8x8(board: unknown): boolean {
    const meta = deps.getBoardShapeMeta(board);
    if (meta) return meta.standard8x8 === true;
    return (
      Array.isArray(board) &&
      board.length === deps.defaultRows &&
      (board as unknown[][]).every(
        (row) => Array.isArray(row) && row.length === deps.defaultCols,
      )
    );
  }
  function hasPlayableCell(board: unknown, row: number, col: number): boolean {
    if (
      !Array.isArray(board) ||
      !Number.isInteger(row) ||
      !Number.isInteger(col)
    )
      return false;
    const meta = deps.getBoardShapeMeta(board);
    return meta
      ? meta.playableKeys.has(deps.toBoardCellKey(row, col))
      : isRawCellInBounds(board, row, col);
  }
  function collectBoardCoordinates(board: unknown): CellCoord[] {
    if (!Array.isArray(board)) return [];
    const meta = deps.getBoardShapeMeta(board);
    if (!meta) {
      const coords: CellCoord[] = [];
      for (let row = 0; row < (board as unknown[][]).length; row++) {
        const line = Array.isArray((board as unknown[][])[row])
          ? (board as unknown[][])[row]
          : [];
        for (let col = 0; col < line.length; col++) coords.push({ row, col });
      }
      return coords;
    }
    if (Array.isArray(meta.coordinateCache))
      return meta.coordinateCache.map((cell) => ({
        row: cell.row,
        col: cell.col,
      }));
    const coords = Array.from(meta.playableKeys)
      .map((key) => {
        const parts = key.split(",");
        return { row: Number(parts[0]), col: Number(parts[1]) };
      })
      .filter(
        (cell) => Number.isInteger(cell.row) && Number.isInteger(cell.col),
      )
      .sort((a, b) => a.row - b.row || a.col - b.col);
    meta.coordinateCache = coords.map((cell) => ({
      row: cell.row,
      col: cell.col,
    }));
    return coords;
  }
  function getCellValue(
    board: unknown,
    row: number,
    col: number,
  ): number | null {
    if (
      !Array.isArray(board) ||
      !Number.isInteger(row) ||
      !Number.isInteger(col)
    )
      return null;
    const meta = deps.getBoardShapeMeta(board);
    if (meta && !meta.playableKeys.has(deps.toBoardCellKey(row, col)))
      return null;
    if (isRawCellInBounds(board, row, col))
      return (board as unknown[][])[row][col] as number;
    if (!meta) return null;
    const key = deps.toBoardCellKey(row, col);
    return Object.prototype.hasOwnProperty.call(meta.expansionOwnerByKey, key)
      ? deps.normalizeOwner(meta.expansionOwnerByKey[key])
      : null;
  }
  function setCellValue(
    board: unknown,
    row: number,
    col: number,
    value: number,
  ): boolean {
    if (
      !Array.isArray(board) ||
      !Number.isInteger(row) ||
      !Number.isInteger(col)
    )
      return false;
    if (isRawCellInBounds(board, row, col)) {
      const meta = deps.getBoardShapeMeta(board);
      if (meta && !meta.playableKeys.has(deps.toBoardCellKey(row, col)))
        return false;
      (board as unknown[][])[row][col] = deps.normalizeOwner(value);
      return true;
    }
    const meta = deps.getBoardShapeMeta(board);
    if (!meta || !meta.playableKeys.has(deps.toBoardCellKey(row, col)))
      return false;
    const owner = deps.normalizeOwner(value);
    const key = deps.toBoardCellKey(row, col);
    meta.expansionOwnerByKey[key] = owner;
    for (const cell of meta.expansionCells)
      if (cell.row === row && cell.col === col) {
        cell.owner = owner;
        break;
      }
    return true;
  }
  function countBoardEmpties(board: unknown): number {
    if (!Array.isArray(board)) return 0;
    return collectBoardCoordinates(board).filter(
      (cell) => getCellValue(board, cell.row, cell.col) === deps.empty,
    ).length;
  }
  return {
    resolveBoardBounds,
    isStandardBoard8x8,
    hasPlayableCell,
    collectBoardCoordinates,
    getCellValue,
    setCellValue,
    countBoardEmpties,
  };
}
