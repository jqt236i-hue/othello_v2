// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file movement.ts
 * @description Movement effects wrapper (delegates to game/logic/cards/movement.js)
 */
const MovementModule = require("../../logic/cards/movement");
const exports = {
    applyStrongWindWill: MovementModule.applyStrongWindWill,
    applySuperBuoyancyWill: MovementModule.applySuperBuoyancyWill,
    applySuperGravityWill: MovementModule.applySuperGravityWill
};
module.exports = exports;

export {};
