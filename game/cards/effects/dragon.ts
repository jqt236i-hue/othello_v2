/**
 * @file dragon.ts
 * @description Dragon effects wrapper (delegates to game/logic/effects/dragon.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as DragonModule from '../../logic/effects/dragon';

interface DragonExports {
  processDragonEffects: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processDragonEffectsAtAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processDragonEffectsAtTurnStartAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: DragonExports = {
  processDragonEffects: DragonModule.processDragonEffects,
  processDragonEffectsAtAnchor: DragonModule.processDragonEffectsAtAnchor,
  processDragonEffectsAtTurnStartAnchor: DragonModule.processDragonEffectsAtTurnStartAnchor
};

export = exports;
