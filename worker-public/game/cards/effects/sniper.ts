/**
 * @file sniper.ts
 * @description Sniper Will effects wrapper (delegates to game/logic/cards/sniper.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import SniperModule = require('../../logic/cards/sniper');


const effectExports = {
  processSniperWillEffects: SniperModule.processSniperWillEffects,
  processSniperWillEffectsAtTurnStartAnchor: SniperModule.processSniperWillEffectsAtTurnStartAnchor
};

export = effectExports;
