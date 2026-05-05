/**
 * @file lightning.ts
 * @description Lightning Will effects wrapper (delegates to game/logic/cards/lightning.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import LightningModule = require('../../logic/cards/lightning');


const effectExports = {
  processLightningWillEffects: LightningModule.processLightningWillEffects,
  processLightningWillEffectsAtAnchor: LightningModule.processLightningWillEffectsAtAnchor,
  processLightningWillEffectsAtTurnStartAnchor: LightningModule.processLightningWillEffectsAtTurnStartAnchor
};

export = effectExports;
