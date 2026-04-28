/**
 * @file timing-processor.ts
 * @description Turn timing and periodic effect processors
 */
import { CardState, GameState } from '../../src/types';
declare function onTurnStart(cardState: CardState, playerKey: string, gameState: GameState, prng: any, effectTimingContext: any): any;
declare function onTurnEnd(cardState: CardState, gameState: GameState, playerKey: string, deps: any): void;
declare function applyPlacementEffects(cardState: CardState, gameState: GameState, playerKey: string, row: number, col: number, flipCount: number, effectTimingContext: any): any;
declare function tickBombs(cardState: CardState, gameState: GameState, playerKey: string, deps: any): any;
declare function tickBombAt(cardState: CardState, gameState: GameState, bomb: any, activeKey: string, deps: any): any;
declare function processDragonEffects(cardState: CardState, gameState: GameState, playerKey: string, deps: any): any;
declare function processUltimateDestroyGodEffects(cardState: CardState, gameState: GameState, playerKey: string, deps: any): any;
declare function processHyperactiveMoves(cardState: CardState, gameState: GameState, prng: any, deps: any): any;
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