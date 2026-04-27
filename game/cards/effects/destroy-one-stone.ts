/**
 * @file destroy-one-stone.ts
 * @description Destroy One Stone effects wrapper (delegates to game/logic/effects/destroy_one_stone.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as DestroyOneStoneModule from '../../logic/effects/destroy_one_stone';

interface DestroyOneStoneExports {
  applyDestroyOneStone: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: DestroyOneStoneExports = {
  applyDestroyOneStone: DestroyOneStoneModule.applyDestroyOneStone
};

export = exports;
