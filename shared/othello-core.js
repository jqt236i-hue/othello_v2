/**
 * @file othello-core.js
 * @description Core Othello game logic functions (shared across browser and headless)
 */

const SharedConstants = require('../shared-constants');

const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
  ? Number(SharedConstants.EMPTY)
  : 0;
const DIRECTIONS = (SharedConstants && SharedConstants.DIRECTIONS) || [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

/**
 * Get flips for a basic Othello move (8 directions).
 * @param {Array} board - 2D array representing the board.
 * @param {number} row - Row index.
 * @param {number} col - Column index.
 * @param {number} playerValue - Player value (1 or -1).
 * @returns {Array} Array of flipped positions as {row, col} objects.
 */
function getFlipsBasic(board, row, col, playerValue) {
  if (!Array.isArray(board) || !Array.isArray(board[row])) return [];
  if (board[row][col] !== EMPTY) return [];
  const out = [];
  for (const [dr, dc] of DIRECTIONS) {
    const temp = [];
    let r = row + dr;
    let c = col + dc;
    while (
      r >= 0 && c >= 0 &&
      r < board.length && c < board.length &&
      board[r][c] === -playerValue
    ) {
      temp.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
    if (
      temp.length > 0 &&
      r >= 0 && c >= 0 &&
      r < board.length && c < board.length &&
      board[r][c] === playerValue
    ) {
      out.push(...temp);
    }
  }
  return out;
}

/**
 * Get all legal moves for a player.
 * @param {Array} board - 2D array representing the board.
 * @param {number} playerValue - Player value (1 or -1).
 * @returns {Array} Array of legal moves as {row, col, flips} objects.
 */
function getLegalMovesBasic(board, playerValue) {
  if (!Array.isArray(board)) return [];
  const moves = [];
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      const flips = getFlipsBasic(board, row, col, playerValue);
      if (flips.length > 0) {
        moves.push({ row, col, flips });
      }
    }
  }
  return moves;
}

/**
 * Get legal moves for a player (alias for getLegalMovesBasic).
 * @param {Array} board - 2D array representing the board.
 * @param {number} playerValue - Player value (1 or -1).
 * @returns {Array} Array of legal moves.
 */
function getLegalMovesForPlayer(board, playerValue) {
  return getLegalMovesBasic(board, playerValue);
}

/**
 * Check if a move is valid.
 * @param {Array} board - 2D array representing the board.
 * @param {number} row - Row index.
 * @param {number} col - Column index.
 * @param {number} playerValue - Player value (1 or -1).
 * @returns {boolean} True if the move is valid.
 */
function isValidMove(board, row, col, playerValue) {
  if (!Array.isArray(board) || !Array.isArray(board[row])) return false;
  if (board[row][col] !== EMPTY) return false;
  for (const [dr, dc] of DIRECTIONS) {
    let r = row + dr;
    let c = col + dc;
    let hasOpponent = false;
    while (
      r >= 0 && c >= 0 &&
      r < board.length && c < board.length &&
      board[r][c] === -playerValue
    ) {
      hasOpponent = true;
      r += dr;
      c += dc;
    }
    if (
      hasOpponent &&
      r >= 0 && c >= 0 &&
      r < board.length && c < board.length &&
      board[r][c] === playerValue
    ) {
      return true;
    }
  }
  return false;
}

module.exports = {
  getFlipsBasic,
  getLegalMovesBasic,
  getLegalMovesForPlayer,
  isValidMove
};
