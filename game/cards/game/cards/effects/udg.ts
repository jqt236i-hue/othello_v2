// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file udg.ts
 * @description Ultimate Destroy God (UDG) effects wrapper (delegates to game/logic/cards/udg.js)
 */
const UdgModule = require("../../logic/cards/udg");
const exports = {
    processUltimateDestroyGodEffects: UdgModule.processUltimateDestroyGodEffects,
    processUltimateDestroyGodEffectsAtAnchor: UdgModule.processUltimateDestroyGodEffectsAtAnchor,
    processUltimateDestroyGodEffectsAtTurnStartAnchor: UdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor
};
module.exports = exports;

export {};
