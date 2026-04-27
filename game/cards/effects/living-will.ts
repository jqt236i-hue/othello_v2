/**
 * @file living-will.ts
 * @description Living Will effects wrapper (delegates to game/logic/cards/living_will.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as LivingWillModule from '../../logic/cards/living_will';

interface LivingWillExports {
  applyLivingWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  applyLivingWillAfterFlips: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: LivingWillExports = {
  applyLivingWill: LivingWillModule.applyLivingWill,
  applyLivingWillAfterFlips: LivingWillModule.applyLivingWillAfterFlips
};

export = exports;
