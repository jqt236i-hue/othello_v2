/**
 * @file living-will.js
 * @description Living Will effects wrapper (delegates to game/logic/cards/living_will.js)
 */

'use strict';

const LivingWillModule = require('../../logic/cards/living_will');

module.exports = {
    applyLivingWill: LivingWillModule.applyLivingWill,
    applyLivingWillAfterFlips: LivingWillModule.applyLivingWillAfterFlips
};
