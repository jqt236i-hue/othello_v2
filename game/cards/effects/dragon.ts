/**
 * @file dragon.ts
 * @description Dragon effects wrapper (delegates to game/logic/effects/dragon.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import DragonModule = require('../../logic/effects/dragon');


const exports: {
  processDragonEffects: any;
  processDragonEffectsAtAnchor: any;
  processDragonEffectsAtTurnStartAnchor: any;
} = {
  processDragonEffects: DragonModule.processDragonEffects,
  processDragonEffectsAtAnchor: DragonModule.processDragonEffectsAtAnchor,
  processDragonEffectsAtTurnStartAnchor: DragonModule.processDragonEffectsAtTurnStartAnchor
};

export = exports;
