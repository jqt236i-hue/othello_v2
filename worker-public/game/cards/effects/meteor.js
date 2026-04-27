/**
 * @file meteor.js
 * @description Meteor Will effects wrapper (delegates to game/logic/cards/meteor.js)
 */

'use strict';

const MeteorModule = require('../../logic/cards/meteor');

module.exports = {
    applyMeteorWill: MeteorModule.applyMeteorWill
};
