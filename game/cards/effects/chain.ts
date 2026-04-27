/**
 * @file chain.ts
 * @description Chain Will effects wrapper (delegates to game/logic/cards/chain.js)
 */

import type { GameState } from '../../../src/types';
import * as ChainModule from '../../logic/cards/chain';

interface ChainExports {
  findChainChoice: (
    gameState: GameState,
    primaryFlips: any[],
    ownerVal: number,
    context?: Record<string, unknown>,
    prng?: any
  ) => any | null;
}

const exports: ChainExports = {
  findChainChoice: ChainModule.findChainChoice
};

export = exports;
