/**
 * @file dragon.js
 * @description Dragon effects wrapper (delegates to game/logic/effects/dragon.js)
 */

'use strict';

const DragonModule = require('../../logic/effects/dragon');

module.exports = {
    processDragonEffects: DragonModule.processDragonEffects,
    processDragonEffectsAtAnchor: DragonModule.processDragonEffectsAtAnchor,
    processDragonEffectsAtTurnStartAnchor: DragonModule.processDragonEffectsAtTurnStartAnchor
};
