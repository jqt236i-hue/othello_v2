"use strict";
/**
 * @file dragon.ts
 * @description Dragon effects wrapper (delegates to game/logic/effects/dragon.js)
 */
const DragonModule = require("../../logic/effects/dragon");
const exports = {
    processDragonEffects: DragonModule.processDragonEffects,
    processDragonEffectsAtAnchor: DragonModule.processDragonEffectsAtAnchor,
    processDragonEffectsAtTurnStartAnchor: DragonModule.processDragonEffectsAtTurnStartAnchor
};
module.exports = exports;
