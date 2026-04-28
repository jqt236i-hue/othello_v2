declare function onTurnStart(cardState: any, playerKey: any, gameState: any, prng: any, effectTimingContext: any): any;
declare function onTurnEnd(cardState: any, gameState: any, playerKey: any, deps: any): void;
declare function applyPlacementEffects(cardState: any, gameState: any, playerKey: any, row: any, col: any, flipCount: any, effectTimingContext: any): any;
declare function tickBombs(cardState: any, gameState: any, playerKey: any, deps: any): any;
declare function tickBombAt(cardState: any, gameState: any, bomb: any, activeKey: any, deps: any): any;
declare function processDragonEffects(cardState: any, gameState: any, playerKey: any, deps: any): any;
declare function processUltimateDestroyGodEffects(cardState: any, gameState: any, playerKey: any, deps: any): any;
declare function processHyperactiveMoves(cardState: any, gameState: any, prng: any, deps: any): any;
declare const _default: {
    onTurnStart: typeof onTurnStart;
    onTurnEnd: typeof onTurnEnd;
    applyPlacementEffects: typeof applyPlacementEffects;
    tickBombs: typeof tickBombs;
    tickBombAt: typeof tickBombAt;
    processDragonEffects: typeof processDragonEffects;
    processUltimateDestroyGodEffects: typeof processUltimateDestroyGodEffects;
    processHyperactiveMoves: typeof processHyperactiveMoves;
};
export = _default;
//# sourceMappingURL=timing-processor.d.ts.map