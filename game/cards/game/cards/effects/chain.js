"use strict";
/**
 * @file chain.ts
 * @description Chain Will effects wrapper (delegates to game/logic/cards/chain.js)
 */
const ChainModule = require("../../logic/cards/chain");
const exports = {
    findChainChoice: ChainModule.findChainChoice
};
module.exports = exports;
