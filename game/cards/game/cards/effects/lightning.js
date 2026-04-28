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
