export interface OthelloPosition {
  row: number;
  col: number;
}

export interface OthelloMove extends OthelloPosition {
  flips: OthelloPosition[];
}

export interface OthelloPrimitivesDependencies {
  empty: number;
  directions: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * Dense-matrix Reversi primitives shared by the headless core and browser
 * Dedicated Worker. Board-shape-aware callers keep that concern outside this
 * factory so both runtimes execute the same search dependency.
 */
export function createOthelloPrimitives(deps: OthelloPrimitivesDependencies) {
  function getFlipsBasic(
    board: number[][],
    row: number,
    col: number,
    playerValue: number,
  ): OthelloPosition[] {
    if (!Array.isArray(board) || !Array.isArray(board[row])) return [];
    if (board[row][col] !== deps.empty) return [];
    const out: OthelloPosition[] = [];
    for (const direction of deps.directions) {
      const dr = direction[0];
      const dc = direction[1];
      const temp: OthelloPosition[] = [];
      let currentRow = row + dr;
      let currentCol = col + dc;
      while (
        currentRow >= 0
        && currentCol >= 0
        && currentRow < board.length
        && Array.isArray(board[currentRow])
        && currentCol < board[currentRow].length
        && board[currentRow][currentCol] === -playerValue
      ) {
        temp.push({ row: currentRow, col: currentCol });
        currentRow += dr;
        currentCol += dc;
      }
      if (
        temp.length > 0
        && currentRow >= 0
        && currentCol >= 0
        && currentRow < board.length
        && Array.isArray(board[currentRow])
        && currentCol < board[currentRow].length
        && board[currentRow][currentCol] === playerValue
      ) out.push(...temp);
    }
    return out;
  }

  function getLegalMovesBasic(board: number[][], playerValue: number): OthelloMove[] {
    if (!Array.isArray(board)) return [];
    const moves: OthelloMove[] = [];
    for (let row = 0; row < board.length; row += 1) {
      const line = Array.isArray(board[row]) ? board[row] : [];
      for (let col = 0; col < line.length; col += 1) {
        const flips = getFlipsBasic(board, row, col, playerValue);
        if (flips.length > 0) moves.push({ row, col, flips });
      }
    }
    return moves;
  }

  return { getFlipsBasic, getLegalMovesBasic };
}
