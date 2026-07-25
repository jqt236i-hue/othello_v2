/**
 * @file flips.ts
 * @description Flip helpers wrapper (delegates to game/logic/cards/flips.js)
 */

import FlipsModule = require('../../logic/cards/flips');

const _exports = {
  getDirectionalChainFlips: FlipsModule.getDirectionalChainFlips,
  getFlipsWithContext: FlipsModule.getFlipsWithContext
};

export = _exports;
