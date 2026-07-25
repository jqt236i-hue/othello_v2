/**
 * @file hyperactive.ts
 * @description Hyperactive effects wrapper (delegates to game/logic/cards/hyperactive.js)
 */

import HyperactiveModule = require('../../logic/cards/hyperactive');


const _exports: any = {
  applyHyperactiveInheritWill: HyperactiveModule.applyHyperactiveInheritWill
};

export = _exports;
