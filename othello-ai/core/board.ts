const BLACK = 1;
const WHITE = -1;
const EMPTY = 0;

type Player = typeof BLACK | typeof WHITE;
type Cell = Player | typeof EMPTY;
type Board = Cell[][];
type Move = { row: number; col: number; flips?: Array<{ row: number; col: number }> };

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

function createInitialBoard(): Board {
  const board = Array.from({ length: 8 }, () => Array<Cell>(8).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

function cloneBoard(board: unknown): Board {
  return Array.isArray(board)
    ? board.map((row) => Array.isArray(row) ? row.slice() as Cell[] : [])
    : createInitialBoard();
}

function inside(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function oppositePlayer(player: number): Player {
  return player === BLACK ? WHITE : BLACK;
}

function playerToKey(player: number): 'black' | 'white' {
  return player === BLACK ? 'black' : 'white';
}

function keyToPlayer(key: unknown): Player {
  return key === 'white' ? WHITE : BLACK;
}

function getCell(board: unknown, row: number, col: number): Cell {
  if (!Array.isArray(board) || !Array.isArray(board[row])) return EMPTY;
  const value = Number(board[row][col]);
  if (value === BLACK || value === WHITE) return value;
  return EMPTY;
}

function getFlips(board: unknown, row: number, col: number, player: number): Array<{ row: number; col: number }> {
  if (!inside(row, col) || getCell(board, row, col) !== EMPTY) return [];
  const opponent = oppositePlayer(player);
  const flips: Array<{ row: number; col: number }> = [];
  for (const [dr, dc] of DIRS) {
    let r = row + dr;
    let c = col + dc;
    const line: Array<{ row: number; col: number }> = [];
    while (inside(r, c) && getCell(board, r, c) === opponent) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (line.length > 0 && inside(r, c) && getCell(board, r, c) === player) flips.push(...line);
  }
  return flips;
}

function getLegalMoves(board: unknown, player: number): Move[] {
  const moves: Move[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const flips = getFlips(board, row, col, player);
      if (flips.length > 0) moves.push({ row, col, flips });
    }
  }
  return moves;
}

function applyMove(board: unknown, move: unknown, player: number): Board {
  const candidate = move && typeof move === 'object' ? move as Move : null;
  const row = Number(candidate && candidate.row);
  const col = Number(candidate && candidate.col);
  const flips = candidate && Array.isArray(candidate.flips) && candidate.flips.length > 0
    ? candidate.flips
    : getFlips(board, row, col, player);
  const next = cloneBoard(board);
  if (!inside(row, col) || flips.length <= 0) return next;
  next[row][col] = player as Cell;
  for (const flip of flips) {
    const r = Number(flip && flip.row);
    const c = Number(flip && flip.col);
    if (inside(r, c)) next[r][c] = player as Cell;
  }
  return next;
}

function countDiscs(board: unknown): { black: number; white: number; empty: number } {
  let black = 0;
  let white = 0;
  let empty = 0;
  for (const row of Array.isArray(board) ? board : []) {
    for (const cell of Array.isArray(row) ? row : []) {
      if (cell === BLACK) black += 1;
      else if (cell === WHITE) white += 1;
      else empty += 1;
    }
  }
  return { black, white, empty };
}

export = {
  BLACK,
  WHITE,
  EMPTY,
  createInitialBoard,
  cloneBoard,
  oppositePlayer,
  playerToKey,
  keyToPlayer,
  getFlips,
  getLegalMoves,
  applyMove,
  countDiscs
};
