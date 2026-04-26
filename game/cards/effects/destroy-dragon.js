/**
 * @file destroy-dragon.js
 * @description Destroy Dragon effects wrapper (delegates to game/logic/cards/destroy_dragon.js)
 */

'use strict';

const DestroyDragonModule = require('../../logic/cards/destroy_dragon');

module.exports = {
    processDestroyDragonEffects: DestroyDragonModule.processDestroyDragonEffects,
    processDestroyDragonEffectsAtAnchor: DestroyDragonModule.processDestroyDragonEffectsAtAnchor,
    processDestroyDragonEffectsAtTurnStartAnchor: DestroyDragonModule.processDestroyDragonEffectsAtTurnStartAnchor
};
