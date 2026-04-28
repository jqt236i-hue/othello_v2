"use strict";
/**
 * @file movement.ts
 * @description Movement effects wrapper (delegates to game/logic/cards/movement.js)
 */
const MovementModule = require("../../logic/cards/movement");
const exports = {
    applyStrongWindWill: MovementModule.applyStrongWindWill,
    applySuperBuoyancyWill: MovementModule.applySuperBuoyancyWill,
    applySuperGravityWill: MovementModule.applySuperGravityWill
};
module.exports = exports;
