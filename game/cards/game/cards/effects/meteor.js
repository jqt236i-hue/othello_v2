"use strict";
/**
 * @file meteor.ts
 * @description Meteor Will effects wrapper (delegates to game/logic/cards/meteor.js)
 */
const MeteorModule = require("../../logic/cards/meteor");
const exports = {
    applyMeteorWill: MeteorModule.applyMeteorWill
};
module.exports = exports;
