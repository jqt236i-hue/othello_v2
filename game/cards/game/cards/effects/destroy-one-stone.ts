// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file destroy-one-stone.ts
 * @description Destroy One Stone effects wrapper (delegates to game/logic/effects/destroy_one_stone.js)
 */
const DestroyOneStoneModule = require("../../logic/effects/destroy_one_stone");
const exports = {
    applyDestroyOneStone: DestroyOneStoneModule.applyDestroyOneStone
};
module.exports = exports;

export {};
