/**
 * @file breeding.ts
 * @description Breeding effects wrapper (delegates to game/logic/cards/breeding.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import BreedingModule = require('../../logic/cards/breeding');

type BreedingEffectsDeps = Record<string, unknown>;
type BreedingRandomLike = { random: () => number };

interface BreedingSpawnedPosition {
  row: number;
  col: number;
  anchorRow: number;
  anchorCol: number;
  stoneId?: unknown;
}

interface BreedingDestroyedPosition {
  row: number;
  col: number;
  owner: PlayerKey;
  reason: string;
}

interface BreedingAnchorPosition {
  row: number;
  col: number;
  remainingNow: number;
}

interface BreedingImmediateResult {
  spawned: BreedingSpawnedPosition[];
  destroyed: BreedingDestroyedPosition[];
  flipped: Array<{ row: number; col: number }>;
}

interface BreedingProcessResult extends BreedingImmediateResult {
  anchors: BreedingAnchorPosition[];
}

interface BreedingEffectsExports {
  processBreedingEffects(cardState: CardState, gameState: GameState, playerKey: PlayerKey, prng: BreedingRandomLike, deps?: BreedingEffectsDeps): BreedingProcessResult;
  processBreedingEffectsAtAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, prng: BreedingRandomLike, deps?: BreedingEffectsDeps): BreedingImmediateResult;
  processBreedingEffectsAtTurnStartAnchor(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, prng: BreedingRandomLike, deps?: BreedingEffectsDeps): BreedingProcessResult;
}

const _exports: BreedingEffectsExports = {
  processBreedingEffects: BreedingModule.processBreedingEffects as unknown as BreedingEffectsExports['processBreedingEffects'],
  processBreedingEffectsAtAnchor: BreedingModule.processBreedingEffectsAtAnchor as unknown as BreedingEffectsExports['processBreedingEffectsAtAnchor'],
  processBreedingEffectsAtTurnStartAnchor: BreedingModule.processBreedingEffectsAtTurnStartAnchor as unknown as BreedingEffectsExports['processBreedingEffectsAtTurnStartAnchor']
};

export = _exports;
