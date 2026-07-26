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
export interface CellAccessDependencies {
  defaultRows: number;
  defaultCols: number;
  empty: number;
  normalizeOwner: (value: unknown) => number;
  resolveBoardConfig: (
    value: unknown,
    maybeCols?: unknown,
  ) => { rows: number; cols: number };
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
    return isRawCellInBounds(board, row, col);
  }
  function collectBoardCoordinates(board: unknown): CellCoord[] {
    if (!Array.isArray(board)) return [];
    const coords: CellCoord[] = [];
    for (let row = 0; row < (board as unknown[][]).length; row++) {
      const line = Array.isArray((board as unknown[][])[row])
        ? (board as unknown[][])[row]
        : [];
      for (let col = 0; col < line.length; col++) coords.push({ row, col });
    }
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
    if (isRawCellInBounds(board, row, col))
      return (board as unknown[][])[row][col] as number;
    return null;
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
      (board as unknown[][])[row][col] = deps.normalizeOwner(value);
      return true;
    }
    return false;
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
