/**
 * @file movement.js
 * @description Movement effects wrapper (delegates to game/logic/cards/movement.js)
 */

'use strict';

const MovementModule = require('../../logic/cards/movement');

module.exports = {
    applyStrongWindWill: MovementModule.applyStrongWindWill,
    applySuperBuoyancyWill: MovementModule.applySuperBuoyancyWill,
    applySuperGravityWill: MovementModule.applySuperGravityWill
};
