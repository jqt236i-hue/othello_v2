/**
 * @file chain.js
 * @description Chain Will effects wrapper (delegates to game/logic/cards/chain.js)
 */

'use strict';

const ChainModule = require('../../logic/cards/chain');

module.exports = {
    findChainChoice: ChainModule.findChainChoice
};
