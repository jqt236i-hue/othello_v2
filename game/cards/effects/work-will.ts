/**
 * @file work-will.ts
 * @description Work Will effects wrapper (delegates to game/logic/cards/work_will.js)
 */

import WorkWillModule = require('../../logic/cards/work_will');


const _exports = {
  placeWorkStone: WorkWillModule.placeWorkStone,
  processWorkEffects: WorkWillModule.processWorkEffects
};

export = _exports;
