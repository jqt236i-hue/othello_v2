/**
 * @file movement.ts
 * @description Movement effects wrapper (delegates to game/logic/cards/movement.js)
 */

import MovementModule = require('../../logic/cards/movement');

const _exports: any = {
  applyStrongWindWill: MovementModule.applyStrongWindWill,
  applySuperBuoyancyWill: MovementModule.applySuperBuoyancyWill,
  applySuperGravityWill: MovementModule.applySuperGravityWill
};

export = _exports;
