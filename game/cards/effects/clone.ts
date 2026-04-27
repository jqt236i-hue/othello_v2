/**
 * @file clone.ts
 * @description Clone/Split effects wrapper (delegates to game/logic/cards/clone.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as CloneModule from '../../logic/cards/clone';

interface CloneExports {
  applyCloneWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  applySplitWill: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    row: number,
    col: number,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: CloneExports = {
  applyCloneWill: CloneModule.applyCloneWill,
  applySplitWill: CloneModule.applySplitWill
};

export = exports;
