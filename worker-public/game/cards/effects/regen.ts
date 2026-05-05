/**
 * @file regen.ts
 * @description Regen Will effects wrapper (delegates to game/logic/cards/regen.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import RegenModule = require('../../logic/cards/regen');


const effectExports = {
  applyRegenWill: RegenModule.applyRegenWill,
  applyRegenAfterFlips: RegenModule.applyRegenAfterFlips
};

export = effectExports;
