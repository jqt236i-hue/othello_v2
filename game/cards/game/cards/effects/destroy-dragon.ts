// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file destroy-dragon.ts
 * @description Destroy Dragon effects wrapper (delegates to game/logic/cards/destroy_dragon.js)
 */
const DestroyDragonModule = require("../../logic/cards/destroy_dragon");
const exports = {
    processDestroyDragonEffects: DestroyDragonModule.processDestroyDragonEffects,
    processDestroyDragonEffectsAtAnchor: DestroyDragonModule.processDestroyDragonEffectsAtAnchor,
    processDestroyDragonEffectsAtTurnStartAnchor: DestroyDragonModule.processDestroyDragonEffectsAtTurnStartAnchor
};
module.exports = exports;

export {};
