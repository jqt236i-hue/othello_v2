// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file hyperactive.ts
 * @description Hyperactive effects wrapper (delegates to game/logic/cards/hyperactive.js)
 */
const HyperactiveModule = require("../../logic/cards/hyperactive");
const exports = {
    applyHyperactiveInheritWill: HyperactiveModule.applyHyperactiveInheritWill
};
module.exports = exports;

export {};
