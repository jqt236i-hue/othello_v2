/**
 * @file swap-with-enemy.ts
 * @description Swap With Enemy effects wrapper (delegates to game/logic/effects/swap_with_enemy.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as SwapWithEnemyModule from '../../logic/effects/swap_with_enemy';

interface SwapWithEnemyExports {
  applySwapWithEnemy: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: SwapWithEnemyExports = {
  applySwapWithEnemy: SwapWithEnemyModule.applySwapWithEnemy
};

export = exports;
