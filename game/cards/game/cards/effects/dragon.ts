// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

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

export {};
