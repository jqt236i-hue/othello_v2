/**
 * @file flips.js
 * @description Flip helpers wrapper (delegates to game/logic/cards/flips.js)
 */

'use strict';

const FlipsModule = require('../../logic/cards/flips');

module.exports = {
    getDirectionalChainFlips: FlipsModule.getDirectionalChainFlips,
    getFlipsWithContext: FlipsModule.getFlipsWithContext
};
