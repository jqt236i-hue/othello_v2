/**
 * @file regen.ts
 * @description Regen Will effects wrapper (delegates to game/logic/cards/regen.js)
 */

import RegenModule = require('../../logic/cards/regen');


const _exports = {
  applyRegenWill: RegenModule.applyRegenWill,
  applyRegenAfterFlips: RegenModule.applyRegenAfterFlips
};

export = _exports;
