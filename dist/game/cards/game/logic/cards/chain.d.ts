/**
 * Find the best chain candidate (deterministic via injected PRNG)
 */
export function findChainChoice(gameState: any, primaryFlips: any, ownerVal: any, context: {} | undefined, prng: any): {
    applied: boolean;
    flips: never[];
    chosen: null;
} | {
    applied: boolean;
    flips: any;
    chosen: {
        from: {
            row: any;
            col: any;
        };
        dir: any;
        score: any;
        flips: any;
    };
};
//# sourceMappingURL=chain.d.ts.map