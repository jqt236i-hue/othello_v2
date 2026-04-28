/**
 * @file turn_pipeline.ts
 * @description Pure turn driver used by headless tests.
 */
declare function applyTurn(cardState: any, gameState: any, playerKey: string, action: any, prng?: any, options?: any): any;
declare function applyTurnSafe(cardState: any, gameState: any, playerKey: string, action: any, prng?: any, options?: any): any;
declare const _default: {
    applyTurn: typeof applyTurn;
    applyTurnSafe: typeof applyTurnSafe;
};
export = _default;
//# sourceMappingURL=turn_pipeline.d.ts.map