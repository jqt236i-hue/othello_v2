"use strict";
/**
 * @file hyperactive.ts
 * @description Hyperactive effects wrapper (delegates to game/logic/cards/hyperactive.js)
 */
const HyperactiveModule = require("../../logic/cards/hyperactive");
const exports = {
    applyHyperactiveInheritWill: HyperactiveModule.applyHyperactiveInheritWill
};
module.exports = exports;
