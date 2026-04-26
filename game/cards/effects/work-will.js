/**
 * @file work-will.js
 * @description Work Will effects wrapper (delegates to game/logic/cards/work_will.js)
 */

'use strict';

const WorkWillModule = require('../../logic/cards/work_will');

module.exports = {
    placeWorkStone: WorkWillModule.placeWorkStone,
    processWorkEffects: WorkWillModule.processWorkEffects
};
