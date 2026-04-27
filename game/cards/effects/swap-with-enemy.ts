/**
 * @file swap-with-enemy.ts
 * @description Swap With Enemy effects wrapper (delegates to game/logic/effects/swap_with_enemy.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
const SwapWithEnemyModule = require('../../logic/effects/swap_with_enemy');

interface SwapWithEnemyExports {
  applySwapWithEnemy: any;
}

export = exports;
