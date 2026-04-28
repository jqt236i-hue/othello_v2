// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

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

export {};
