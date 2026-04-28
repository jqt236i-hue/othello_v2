"use strict";
/**
 * @file clone.ts
 * @description Clone/Split effects wrapper (delegates to game/logic/cards/clone.js)
 */
const CloneModule = require("../../logic/cards/clone");
const exports = {
    applyCloneWill: CloneModule.applyCloneWill,
    applySplitWill: CloneModule.applySplitWill
};
module.exports = exports;
