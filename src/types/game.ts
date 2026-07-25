/**
 * Game state and event type definitions
 */

import { PlayerKey } from './player';
import { Board } from './board';
import { CardState } from './card';

export interface GameState {
  board: Board;
  boardExpansion?: {
    cells: Array<{
      row: number;
      col: number;
      side: string;
      owner: number;
    }>;
    usedByPlayer: Record<PlayerKey, boolean>;
  };
  currentPlayer: PlayerKey;
  turn: number;
  round: number;
  isGameOver: boolean;
  winner: PlayerKey | null;
  scores: {
    black: number;
    white: number;
  };
}

export interface FullGameState {
  gameState: GameState;
  cardState: CardState;
}

export type GamePhase = 
  | 'init'
  | 'draw'
  | 'card_select'
  | 'card_resolve'
  | 'place'
  | 'resolve'
  | 'turn_end'
  | 'game_over';

export interface GameConfig {
  boardRows: number;
  boardCols: number;
  initialHandSize: number;
  maxHandSize: number;
  drawInterval: number;
  enableCards: boolean;
  enableNetwork: boolean;
  cpuLevel: number;
}
