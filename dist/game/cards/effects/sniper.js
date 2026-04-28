"use strict";
/**
 * @file sniper.ts
 * @description Sniper Will effects wrapper (delegates to game/logic/cards/sniper.js)
 */
const SniperModule = require("../../logic/cards/sniper");
const exports = {
    processSniperWillEffects: SniperModule.processSniperWillEffects,
    processSniperWillEffectsAtTurnStartAnchor: SniperModule.processSniperWillEffectsAtTurnStartAnchor
};
module.exports = exports;
//# sourceMappingURL=sniper.js.map