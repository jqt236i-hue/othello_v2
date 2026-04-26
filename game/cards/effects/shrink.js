/**
 * @file shrink.js
 * @description Board Shrink effects wrapper (delegates to game/logic/cards/shrink.js)
 */

'use strict';

const ShrinkModule = require('../../logic/cards/shrink');

module.exports = {
    applyBoardShrinkWill: ShrinkModule.applyBoardShrinkWill
};
