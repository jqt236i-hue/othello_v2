/**
 * @file flips.ts
 * @description Flip calculation helpers (Shared between Browser and Headless)
 */
import { GameState } from '../../../src/types';
declare function getDirectionalChainFlips(gameState: GameState, row: number, col: number, ownerVal: number, dir: number[], context: any): Array<{
    row: number;
    col: number;
}>;
declare function getFlipsWithContext(state: GameState, row: number, col: number, player: number, context?: any): number[][];
declare const _default: {
    getDirectionalChainFlips: typeof getDirectionalChainFlips;
    getFlipsWithContext: typeof getFlipsWithContext;
};
export = _default;
//# sourceMappingURL=flips.d.ts.map