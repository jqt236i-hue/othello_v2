/**
 * @file chain.ts
 * @description Chain Will effects wrapper (delegates to game/logic/cards/chain.js)
 */
import type { GameState } from '../../../src/types';
interface ChainExports {
    findChainChoice: (gameState: GameState, primaryFlips: any[], ownerVal: number, context?: Record<string, unknown>, prng?: any) => any | null;
}
declare const exports: ChainExports;
export = exports;
//# sourceMappingURL=chain.d.ts.map