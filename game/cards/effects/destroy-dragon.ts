/**
 * @file destroy-dragon.ts
 * @description Destroy Dragon effects wrapper (delegates to game/logic/cards/destroy_dragon.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as DestroyDragonModule from '../../logic/cards/destroy_dragon';

interface DestroyDragonExports {
  processDestroyDragonEffects: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processDestroyDragonEffectsAtAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processDestroyDragonEffectsAtTurnStartAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: DestroyDragonExports = {
  processDestroyDragonEffects: DestroyDragonModule.processDestroyDragonEffects,
  processDestroyDragonEffectsAtAnchor: DestroyDragonModule.processDestroyDragonEffectsAtAnchor,
  processDestroyDragonEffectsAtTurnStartAnchor: DestroyDragonModule.processDestroyDragonEffectsAtTurnStartAnchor
};

export = exports;
