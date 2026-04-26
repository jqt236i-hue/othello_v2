/**
 * @file udg.js
 * @description Ultimate Destroy God (UDG) effects wrapper (delegates to game/logic/cards/udg.js)
 */

'use strict';

const UdgModule = require('../../logic/cards/udg');

module.exports = {
    processUltimateDestroyGodEffects: UdgModule.processUltimateDestroyGodEffects,
    processUltimateDestroyGodEffectsAtAnchor: UdgModule.processUltimateDestroyGodEffectsAtAnchor,
    processUltimateDestroyGodEffectsAtTurnStartAnchor: UdgModule.processUltimateDestroyGodEffectsAtTurnStartAnchor
};
