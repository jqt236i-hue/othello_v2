// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

"use strict";
/**
 * @file lightning.ts
 * @description Lightning Will effects wrapper (delegates to game/logic/cards/lightning.js)
 */
const LightningModule = require("../../logic/cards/lightning");
const exports = {
    processLightningWillEffects: LightningModule.processLightningWillEffects,
    processLightningWillEffectsAtAnchor: LightningModule.processLightningWillEffectsAtAnchor,
    processLightningWillEffectsAtTurnStartAnchor: LightningModule.processLightningWillEffectsAtTurnStartAnchor
};
module.exports = exports;

export {};
