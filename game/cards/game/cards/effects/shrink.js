"use strict";
/**
 * @file shrink.ts
 * @description Board Shrink effects wrapper (delegates to game/logic/cards/shrink.js)
 */
const ShrinkModule = require("../../logic/cards/shrink");
const exports = {
    applyBoardShrinkWill: ShrinkModule.applyBoardShrinkWill,
    applyBoardShrinkGod: ShrinkModule.applyBoardShrinkGod,
    BOARD_SHRINK_SELECTION_COUNT: ShrinkModule.BOARD_SHRINK_SELECTION_COUNT
};
module.exports = exports;
