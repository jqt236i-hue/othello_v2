/**
 * @file chain.ts
 * @description Chain-Will selection helpers (Shared between Browser and Headless)
 */
import { GameState } from '../../../src/types';
interface Point {
    row: number;
    col: number;
}
interface ChainCandidate {
    from: Point;
    dir: any;
    score: number;
    flips: Point[];
}
interface ChainResult {
    applied: boolean;
    flips: Point[];
    chosen: ChainCandidate | null;
}
/**
 * Find the best chain candidate (deterministic via injected PRNG)
 */
declare function findChainChoice(gameState: GameState, primaryFlips: any[], ownerVal: number, context?: any, prng?: {
    random(): number;
}): ChainResult;
declare const _default: {
    findChainChoice: typeof findChainChoice;
};
export = _default;
//# sourceMappingURL=chain.d.ts.map