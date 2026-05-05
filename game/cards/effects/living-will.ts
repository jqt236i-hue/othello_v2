/**
 * @file living-will.ts
 * @description Living Will effects wrapper (delegates to game/logic/cards/living_will.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import LivingWillModule = require('../../logic/cards/living_will');


const _exports: any = {
  applyLivingWill: LivingWillModule.applyLivingWill,
  applyLivingWillAfterFlips: LivingWillModule.applyLivingWillAfterFlips
};

export = _exports;
