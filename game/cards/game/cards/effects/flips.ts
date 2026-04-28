// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file flips.ts
 * @description Flip helpers wrapper (delegates to game/logic/cards/flips.js)
 */
const FlipsModule = require("../../logic/cards/flips");
const exports = {
    getDirectionalChainFlips: FlipsModule.getDirectionalChainFlips,
    getFlipsWithContext: FlipsModule.getFlipsWithContext
};
module.exports = exports;

export {};
