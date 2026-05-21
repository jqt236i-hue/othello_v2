export const GAME_RESULT_EVENT = 'reversi:game-result';
export const LEGACY_GAME_RESULT_EVENT = 'othello:game-result';

export type GameResultWinner = 'black' | 'white' | 'draw';

export type GameResultEventDetail = {
  counts: {
    black: number;
    white: number;
  };
  winner: GameResultWinner;
  source: 'showResult';
};
