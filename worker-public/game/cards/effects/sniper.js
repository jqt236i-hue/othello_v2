/**
 * @file sniper.js
 * @description Sniper Will effects wrapper (delegates to game/logic/cards/sniper.js)
 */

'use strict';

const SniperModule = require('../../logic/cards/sniper');

module.exports = {
    processSniperWillEffects: SniperModule.processSniperWillEffects,
    processSniperWillEffectsAtTurnStartAnchor: SniperModule.processSniperWillEffectsAtTurnStartAnchor
};
