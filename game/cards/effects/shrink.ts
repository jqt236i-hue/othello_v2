/**
 * @file shrink.ts
 * @description Board Shrink effects wrapper (delegates to game/logic/cards/shrink.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as ShrinkModule from '../../logic/cards/shrink';

interface ShrinkExports {
  applyBoardShrinkWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: ShrinkExports = {
  applyBoardShrinkWill: ShrinkModule.applyBoardShrinkWill
};

export = exports;
