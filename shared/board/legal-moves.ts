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
      let currentRow = row + dir[0];
      let currentCol = col + dir[1];
      let opponentCount = 0;
      while (deps.hasPlayableCell(board, currentRow, currentCol) && deps.getCellValue(board, currentRow, currentCol) === -playerValue) {
        opponentCount += 1;
        currentRow += dir[0];
        currentCol += dir[1];
      }
      if (
        opponentCount > 0 &&
        deps.hasPlayableCell(board, currentRow, currentCol) &&
        deps.getCellValue(board, currentRow, currentCol) === playerValue
      ) {
        for (let step = 1; step <= opponentCount; step += 1) {
          out.push({
            row: row + dir[0] * step,
            col: col + dir[1] * step,
          });
        }
      }
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
