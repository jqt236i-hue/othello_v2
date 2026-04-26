/**
 * @file breeding.js
 * @description Breeding effects wrapper (delegates to game/logic/cards/breeding.js)
 */

'use strict';

const BreedingModule = require('../../logic/cards/breeding');

module.exports = {
    processBreedingEffects: BreedingModule.processBreedingEffects,
    processBreedingEffectsAtAnchor: BreedingModule.processBreedingEffectsAtAnchor,
    processBreedingEffectsAtTurnStartAnchor: BreedingModule.processBreedingEffectsAtTurnStartAnchor
};
