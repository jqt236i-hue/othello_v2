/**
 * @file effect-timing.ts
 * @description Turn-start and placement-effect orchestration shared between Browser and Headless.
 */
interface Context {
    constants?: any;
    helpers?: any;
    modules?: any;
    defaultPrng?: any;
}
interface PlacementEffects {
    chargeGained: number;
    freePlacementUsed?: boolean;
    [key: string]: any;
}
interface TurnStartSummary {
    ribo: {
        entries: any[];
        totalRepaid: number;
        totalDestroyed: number;
        completedCount: number;
    };
}
declare function onTurnStart(cardState: any, playerKey: string, gameState: any, prng: any, context: Context): TurnStartSummary;
declare function applyPlacementEffects(cardState: any, gameState: any, playerKey: string, row: number, col: number, flipCount: number, context: Context): PlacementEffects;
declare const _default: {
    onTurnStart: typeof onTurnStart;
    applyPlacementEffects: typeof applyPlacementEffects;
};
export = _default;
//# sourceMappingURL=effect-timing.d.ts.map