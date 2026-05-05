/**
 * @file othello-core.ts
 * @description Core Othello game logic functions (shared across browser and headless)
 */

import { Board, BoardValue, PlayerValue, CellPosition, Direction } from '../src/types';

const SharedConstants = require('../shared-constants');

const EMPTY: BoardValue = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
  ? Number(SharedConstants.EMPTY) as BoardValue
  : 0;
const DIRECTIONS: Direction[] = (SharedConstants && SharedConstants.DIRECTIONS) || [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

interface FlipResult {
  row: number;
  col: number;
}

interface LegalMove {
  row: number;
  col: number;
  flips: FlipResult[];
}

/**
 * Get flips for a basic Othello move (8 directions).
 */
function getFlipsBasic(board: Board, row: number, col: number, playerValue: PlayerValue): FlipResult[] {
  if (!Array.isArray(board) || !Array.isArray(board[row])) return [];
  if (board[row][col] !== EMPTY) return [];
  const out: FlipResult[] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const temp: FlipResult[] = [];
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
 */
function getLegalMovesBasic(board: Board, playerValue: PlayerValue): LegalMove[] {
  if (!Array.isArray(board)) return [];
  const moves: LegalMove[] = [];
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
 */
function getLegalMovesForPlayer(board: Board, playerValue: PlayerValue): LegalMove[] {
  return getLegalMovesBasic(board, playerValue);
}

/**
 * Check if a move is valid.
 */
function isValidMove(board: Board, row: number, col: number, playerValue: PlayerValue): boolean {
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

export {
  getFlipsBasic,
  getLegalMovesBasic,
  getLegalMovesForPlayer,
  isValidMove
};