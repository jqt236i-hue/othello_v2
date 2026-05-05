/**
 * @file destroy-dragon.ts
 * @description Destroy Dragon effects wrapper (delegates to game/logic/cards/destroy_dragon.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import DestroyDragonModule = require('../../logic/cards/destroy_dragon');


const _exports = {
  processDestroyDragonEffects: DestroyDragonModule.processDestroyDragonEffects,
  processDestroyDragonEffectsAtAnchor: DestroyDragonModule.processDestroyDragonEffectsAtAnchor,
  processDestroyDragonEffectsAtTurnStartAnchor: DestroyDragonModule.processDestroyDragonEffectsAtTurnStartAnchor
};

export = _exports;
