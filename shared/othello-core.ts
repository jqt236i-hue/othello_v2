/**
 * @file othello-core.ts
 * @description Core Reversi game logic functions (shared across browser and headless)
 */

import { BoardValue, Direction } from '../src/types';
import { createOthelloPrimitives } from './board/othello-primitives';

const SharedConstants = require('../shared-constants');

const EMPTY: BoardValue = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
  ? Number(SharedConstants.EMPTY) as BoardValue
  : 0;
const DIRECTIONS: Direction[] = (SharedConstants && SharedConstants.DIRECTIONS) || [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

const { getFlipsBasic, getLegalMovesBasic } = createOthelloPrimitives({
  empty: EMPTY,
  directions: DIRECTIONS,
});

/**
 * Get legal moves for a player (alias for getLegalMovesBasic).
 */
function getLegalMovesForPlayer(board: number[][], playerValue: number) {
  return getLegalMovesBasic(board, playerValue);
}

/**
 * Check if a move is valid.
 */
function isValidMove(board: number[][], row: number, col: number, playerValue: number): boolean {
  return getFlipsBasic(board, row, col, playerValue).length > 0;
}

export {
  getFlipsBasic,
  getLegalMovesBasic,
  getLegalMovesForPlayer,
  isValidMove
};
