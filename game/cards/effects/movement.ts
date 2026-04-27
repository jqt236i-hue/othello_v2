/**
 * @file movement.ts
 * @description Movement effects wrapper (delegates to game/logic/cards/movement.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as MovementModule from '../../logic/cards/movement';

interface MovementExports {
  applyStrongWindWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  applySuperBuoyancyWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  applySuperGravityWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: MovementExports = {
  applyStrongWindWill: MovementModule.applyStrongWindWill,
  applySuperBuoyancyWill: MovementModule.applySuperBuoyancyWill,
  applySuperGravityWill: MovementModule.applySuperGravityWill
};

export = exports;
