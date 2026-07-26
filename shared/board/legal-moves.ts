export interface CellCoord {
  row: number;
  col: number;
}

export interface LegalMove extends CellCoord {
  flips: CellCoord[];
}

export interface LegalMoveDependencies {
  empty: number;
  directions: number[][];
  hasPlayableCell: (board: unknown, row: number, col: number) => boolean;
  getCellValue: (board: unknown, row: number, col: number) => number | null;
  collectBoardCoordinates: (board: unknown) => CellCoord[];
}

export function createLegalMoves(deps: LegalMoveDependencies) {
  function getFlipsBasic(board: unknown, row: number, col: number, playerValue: number): CellCoord[] {
    if (!deps.hasPlayableCell(board, row, col)) return [];
    if (deps.getCellValue(board, row, col) !== deps.empty) return [];
    const out: CellCoord[] = [];
    for (const dir of deps.directions) {
      const temp: CellCoord[] = [];
      let currentRow = row + dir[0];
      let currentCol = col + dir[1];
      while (deps.hasPlayableCell(board, currentRow, currentCol) && deps.getCellValue(board, currentRow, currentCol) === -playerValue) {
        temp.push({ row: currentRow, col: currentCol });
        currentRow += dir[0];
        currentCol += dir[1];
      }
      if (temp.length > 0 && deps.hasPlayableCell(board, currentRow, currentCol) && deps.getCellValue(board, currentRow, currentCol) === playerValue) out.push.apply(out, temp);
    }
    return out;
  }

  function getLegalMovesBasic(board: unknown, playerValue: number): LegalMove[] {
    if (!board || typeof board !== "object") return [];
    const moves: LegalMove[] = [];
    for (const cell of deps.collectBoardCoordinates(board)) {
      const flips = getFlipsBasic(board, cell.row, cell.col, playerValue);
      if (flips.length > 0) moves.push({ row: cell.row, col: cell.col, flips });
    }
    return moves;
  }

  return { getFlipsBasic, getLegalMovesBasic };
}
