export interface CellCoord {
  row: number;
  col: number;
}

export interface ControlCountDependencies {
  getCellValue: (board: unknown, row: number, col: number) => number | null;
  getCornerCells: (board: unknown) => CellCoord[];
  collectBoardCoordinates: (board: unknown) => CellCoord[];
  isEdgeCell: (row: number, col: number, board: unknown) => boolean;
  isCornerCell: (row: number, col: number, board: unknown) => boolean;
}

export function createControlCounts(deps: ControlCountDependencies) {
  function countCornerControl(board: unknown, playerValue: number): { ownCorners: number; oppCorners: number } {
    if (!board || typeof board !== "object") return { ownCorners: 0, oppCorners: 0 };
    let ownCorners = 0;
    let oppCorners = 0;
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
