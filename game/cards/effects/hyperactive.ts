/**
 * @file hyperactive.ts
 * @description Hyperactive effects wrapper (delegates to game/logic/cards/hyperactive.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import HyperactiveModule = require('../../logic/cards/hyperactive');


const exports: any = {
  applyHyperactiveInheritWill: HyperactiveModule.applyHyperactiveInheritWill
};

export = exports;
