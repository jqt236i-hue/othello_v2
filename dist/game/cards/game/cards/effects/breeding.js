"use strict";
/**
 * @file breeding.ts
 * @description Breeding effects wrapper (delegates to game/logic/cards/breeding.js)
 */
const BreedingModule = require("../../logic/cards/breeding");
const exports = {
    processBreedingEffects: BreedingModule.processBreedingEffects,
    processBreedingEffectsAtAnchor: BreedingModule.processBreedingEffectsAtAnchor,
    processBreedingEffectsAtTurnStartAnchor: BreedingModule.processBreedingEffectsAtTurnStartAnchor
};
module.exports = exports;
//# sourceMappingURL=breeding.js.map