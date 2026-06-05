"use strict";

const BLACK = 1;
const WHITE = -1;
const EMPTY = 0;
const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
];

function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
  board[3][3] = WHITE;
  board[3][4] = BLACK;
  board[4][3] = BLACK;
  board[4][4] = WHITE;
  return board;
}

function cloneBoard(board) {
  return Array.isArray(board) ? board.map((row) => Array.isArray(row) ? row.slice() : []) : createInitialBoard();
}

function inside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function oppositePlayer(player) {
  return player === BLACK ? WHITE : BLACK;
}

function playerToKey(player) {
  return player === BLACK ? "black" : "white";
}

function keyToPlayer(key) {
  return key === "white" ? WHITE : BLACK;
}

function getCell(board, row, col) {
  return Array.isArray(board) && Array.isArray(board[row]) ? Number(board[row][col]) || EMPTY : EMPTY;
}

function getFlips(board, row, col, player) {
  if (!inside(row, col) || getCell(board, row, col) !== EMPTY) return [];
  const opponent = oppositePlayer(player);
  const flips = [];
  for (const [dr, dc] of DIRS) {
    let r = row + dr;
    let c = col + dc;
    const line = [];
    while (inside(r, c) && getCell(board, r, c) === opponent) {
      line.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (line.length > 0 && inside(r, c) && getCell(board, r, c) === player) flips.push(...line);
  }
  return flips;
}

function getLegalMoves(board, player) {
  const moves = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const flips = getFlips(board, row, col, player);
      if (flips.length > 0) moves.push({ row, col, flips });
    }
  }
  return moves;
}

function applyMove(board, move, player) {
  const row = Number(move && move.row);
  const col = Number(move && move.col);
  const flips = Array.isArray(move && move.flips) && move.flips.length > 0
    ? move.flips
    : getFlips(board, row, col, player);
  const next = cloneBoard(board);
  if (!inside(row, col) || flips.length <= 0) return next;
  next[row][col] = player;
  for (const flip of flips) {
    const r = Number(flip && flip.row);
    const c = Number(flip && flip.col);
    if (inside(r, c)) next[r][c] = player;
  }
  return next;
}

function countDiscs(board) {
  let black = 0;
  let white = 0;
  let empty = 0;
  for (const row of board || []) {
    for (const cell of row || []) {
      if (cell === BLACK) black += 1;
      else if (cell === WHITE) white += 1;
      else empty += 1;
    }
  }
  return { black, white, empty };
}

module.exports = {
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
