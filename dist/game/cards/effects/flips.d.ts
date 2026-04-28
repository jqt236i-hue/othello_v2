/**
 * @file flips.ts
 * @description Flip helpers wrapper (delegates to game/logic/cards/flips.js)
 */
import type { GameState } from '../../../src/types';
declare const exports: {
    getDirectionalChainFlips: (gameState: GameState, row: number, col: number, ownerVal: number, dir: number[], context: any) => Array<{
        row: number;
        col: number;
    }>;
    getFlipsWithContext: (state: GameState, row: number, col: number, player: number, context?: any) => number[][];
};
export = exports;
//# sourceMappingURL=flips.d.ts.map