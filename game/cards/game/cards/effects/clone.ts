// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file clone.ts
 * @description Clone/Split effects wrapper (delegates to game/logic/cards/clone.js)
 */
const CloneModule = require("../../logic/cards/clone");
const exports = {
    applyCloneWill: CloneModule.applyCloneWill,
    applySplitWill: CloneModule.applySplitWill
};
module.exports = exports;

export {};
