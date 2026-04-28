"use strict";
/**
 * @file udg.ts
 * @description Ultimate Destroy God (UDG) effects wrapper (delegates to game/logic/cards/udg.js)
 */
const UdgModule = require("../../logic/cards/udg");
const exports = {
    processUltimateDestroyGodEffects: UdgModule.processUltimateDestroyGodEffects,
    processUltimateDestroyGodEffectsAtAnchor: UdgModule.processUltimateDestroyGodEffectsAtAnchor,
    processUltimateDestroyGodEffectsAtTurnStartAnchor: UdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor
};
module.exports = exports;
