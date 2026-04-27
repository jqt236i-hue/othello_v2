/**
 * @file work-will.ts
 * @description Work Will effects wrapper (delegates to game/logic/cards/work_will.js)
 */

import type { CardState, GameState, PlayerKey } from '../../../src/types';
import WorkWillModule = require('../../logic/cards/work_will');


const exports = {
  placeWorkStone: WorkWillModule.placeWorkStone,
  processWorkEffects: WorkWillModule.processWorkEffects
};

export = exports;
