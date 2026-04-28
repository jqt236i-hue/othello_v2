/**
 * @file othello-core.ts
 * @description Core Othello game logic functions (shared across browser and headless)
 */
import { Board, PlayerValue } from '../src/types';
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
declare function getFlipsBasic(board: Board, row: number, col: number, playerValue: PlayerValue): FlipResult[];
/**
 * Get all legal moves for a player.
 */
declare function getLegalMovesBasic(board: Board, playerValue: PlayerValue): LegalMove[];
/**
 * Get legal moves for a player (alias for getLegalMovesBasic).
 */
declare function getLegalMovesForPlayer(board: Board, playerValue: PlayerValue): LegalMove[];
/**
 * Check if a move is valid.
 */
declare function isValidMove(board: Board, row: number, col: number, playerValue: PlayerValue): boolean;
export { getFlipsBasic, getLegalMovesBasic, getLegalMovesForPlayer, isValidMove };
//# sourceMappingURL=othello-core.d.ts.map