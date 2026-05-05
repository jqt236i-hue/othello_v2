/**
 * @file breeding.ts
 * @description Breeding effects wrapper (delegates to game/logic/cards/breeding.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import BreedingModule = require('../../logic/cards/breeding');


const effectExports = {
  processBreedingEffects: BreedingModule.processBreedingEffects,
  processBreedingEffectsAtAnchor: BreedingModule.processBreedingEffectsAtAnchor,
  processBreedingEffectsAtTurnStartAnchor: BreedingModule.processBreedingEffectsAtTurnStartAnchor
};

export = effectExports;
