/**
 * @file flips.ts
 * @description Flip helpers wrapper (delegates to game/logic/cards/flips.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as FlipsModule from '../../logic/cards/flips';

interface FlipsExports {
  getDirectionalChainFlips: (
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => any[];
  getFlipsWithContext: (
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    cardState?: CardState,
    deps?: Record<string, unknown>
  ) => any[];
}

const exports: FlipsExports = {
  getDirectionalChainFlips: FlipsModule.getDirectionalChainFlips,
  getFlipsWithContext: FlipsModule.getFlipsWithContext
};

export = exports;
