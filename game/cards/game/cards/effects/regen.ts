// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file regen.ts
 * @description Regen Will effects wrapper (delegates to game/logic/cards/regen.js)
 */
const RegenModule = require("../../logic/cards/regen");
const exports = {
    applyRegenWill: RegenModule.applyRegenWill,
    applyRegenAfterFlips: RegenModule.applyRegenAfterFlips
};
module.exports = exports;

export {};
