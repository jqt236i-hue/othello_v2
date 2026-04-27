/**
 * @file work-will.ts
 * @description Work Will effects wrapper (delegates to game/logic/cards/work_will.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as WorkWillModule from '../../logic/cards/work_will';

interface WorkWillExports {
  placeWorkStone: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processWorkEffects: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: WorkWillExports = {
  placeWorkStone: WorkWillModule.placeWorkStone,
  processWorkEffects: WorkWillModule.processWorkEffects
};

export = exports;
