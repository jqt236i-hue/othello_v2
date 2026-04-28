declare function logPlacementEffects(effects: any, player: any): void;
declare function applyProtectionAfterMove(move: any, effects: any): any;
declare const PlacementEffects: {
    applyProtectionAfterMove: typeof applyProtectionAfterMove;
    logPlacementEffects: typeof logPlacementEffects;
};
export = PlacementEffects;
//# sourceMappingURL=placement.d.ts.map