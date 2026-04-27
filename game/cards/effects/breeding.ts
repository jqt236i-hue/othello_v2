/**
 * @file breeding.ts
 * @description Breeding effects wrapper (delegates to game/logic/cards/breeding.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import * as BreedingModule from '../../logic/cards/breeding';

interface BreedingExports {
  processBreedingEffects: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processBreedingEffectsAtAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
  processBreedingEffectsAtTurnStartAnchor: (
    cardState: CardState,
    gameState: GameState,
    playerKey: PlayerKey,
    deps?: Record<string, unknown>
  ) => Record<string, unknown>;
}

const exports: BreedingExports = {
  processBreedingEffects: BreedingModule.processBreedingEffects,
  processBreedingEffectsAtAnchor: BreedingModule.processBreedingEffectsAtAnchor,
  processBreedingEffectsAtTurnStartAnchor: BreedingModule.processBreedingEffectsAtTurnStartAnchor
};

export = exports;
