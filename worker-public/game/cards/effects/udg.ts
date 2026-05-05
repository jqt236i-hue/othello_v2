/**
 * @file udg.ts
 * @description Ultimate Destroy God (UDG) effects wrapper (delegates to game/logic/cards/udg.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import UdgModule = require('../../logic/cards/udg');


const effectExports: any = {
  processUltimateDestroyGodEffects: UdgModule.processUltimateDestroyGodEffects,
  processUltimateDestroyGodEffectsAtAnchor: UdgModule.processUltimateDestroyGodEffectsAtAnchor,
  processUltimateDestroyGodEffectsAtTurnStartAnchor: UdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor
};

export = effectExports;
