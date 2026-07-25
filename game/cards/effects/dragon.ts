/**
 * @file dragon.ts
 * @description Dragon effects wrapper (delegates to game/logic/effects/dragon.js)
 */

import DragonModule = require('../../logic/effects/dragon');


const _exports: {
  processDragonEffects: any;
  processDragonEffectsAtAnchor: any;
  processDragonEffectsAtTurnStartAnchor: any;
} = {
  processDragonEffects: DragonModule.processDragonEffects,
  processDragonEffectsAtAnchor: DragonModule.processDragonEffectsAtAnchor,
  processDragonEffectsAtTurnStartAnchor: DragonModule.processDragonEffectsAtTurnStartAnchor
};

export = _exports;
