/**
 * @file living-will.ts
 * @description Living Will effects wrapper (delegates to game/logic/cards/living_will.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import LivingWillModule = require('../../logic/cards/living_will');


const exports = {
  applyLivingWill: LivingWillModule.applyLivingWill,
  applyLivingWillAfterFlips: LivingWillModule.applyLivingWillAfterFlips
};

export = exports;
