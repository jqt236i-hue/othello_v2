/**
 * @file chain.ts
 * @description Chain Will effects wrapper (delegates to game/logic/cards/chain.js)
 */

import type { GameState } from '../../../src/types';
import ChainModule = require('../../logic/cards/chain');

interface ChainExports {
  findChainChoice: (
    gameState: GameState,
    primaryFlips: any[],
    ownerVal: number,
    context?: Record<string, unknown>,
    prng?: any
  ) => any | null;
}

const effectExports: ChainExports = {
  findChainChoice: ChainModule.findChainChoice
};

export = effectExports;
