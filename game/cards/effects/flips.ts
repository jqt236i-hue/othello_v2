/**
 * @file flips.ts
 * @description Flip helpers wrapper (delegates to game/logic/cards/flips.js)
 */

import type { GameState } from '../../../src/types';
import FlipsModule = require('../../logic/cards/flips');

const exports = {
  getDirectionalChainFlips: FlipsModule.getDirectionalChainFlips,
  getFlipsWithContext: FlipsModule.getFlipsWithContext
};

export = exports;
