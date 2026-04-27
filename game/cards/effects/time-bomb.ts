/**
 * @file time-bomb.ts
 * @description Time Bomb effects wrapper (delegates to game/logic/cards/time_bomb.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as TimeBombModule from '../../logic/cards/time_bomb';

interface TimeBombExports {
  applyTimeBombWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  tickBombs: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  tickBombAt: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: TimeBombExports = {
  applyTimeBombWill: TimeBombModule.applyTimeBombWill,
  tickBombs: TimeBombModule.tickBombs,
  tickBombAt: TimeBombModule.tickBombAt
};

export = exports;
