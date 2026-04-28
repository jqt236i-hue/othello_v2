// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file sniper.ts
 * @description Sniper Will effects wrapper (delegates to game/logic/cards/sniper.js)
 */
const SniperModule = require("../../logic/cards/sniper");
const exports = {
    processSniperWillEffects: SniperModule.processSniperWillEffects,
    processSniperWillEffectsAtTurnStartAnchor: SniperModule.processSniperWillEffectsAtTurnStartAnchor
};
module.exports = exports;

export {};
