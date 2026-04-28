// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file chain.ts
 * @description Chain Will effects wrapper (delegates to game/logic/cards/chain.js)
 */
const ChainModule = require("../../logic/cards/chain");
const exports = {
    findChainChoice: ChainModule.findChainChoice
};
module.exports = exports;

export {};
