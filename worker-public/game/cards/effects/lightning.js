/**
 * @file lightning.js
 * @description Lightning Will effects wrapper (delegates to game/logic/cards/lightning.js)
 */

'use strict';

const LightningModule = require('../../logic/cards/lightning');

module.exports = {
    processLightningWillEffects: LightningModule.processLightningWillEffects,
    processLightningWillEffectsAtAnchor: LightningModule.processLightningWillEffectsAtAnchor,
    processLightningWillEffectsAtTurnStartAnchor: LightningModule.processLightningWillEffectsAtTurnStartAnchor
};
