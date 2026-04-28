declare function buildLv6LookaheadOptions(level: any, board: any, legalMovesCount: any, playerKey: any, runtimeMode: any, runtimeOverrides: any): {
    depth?: undefined;
    maxBranch?: undefined;
    nodeBudget?: undefined;
    maxTimeMs?: undefined;
    endgameSolveEmpties?: undefined;
    endgameDepth?: undefined;
    endgameNodeBudget?: undefined;
    endgameMaxTimeMs?: undefined;
} | {
    depth: number;
    maxBranch: number;
    nodeBudget: number;
    maxTimeMs: number;
    endgameSolveEmpties: number;
    endgameDepth: number;
    endgameNodeBudget: number;
    endgameMaxTimeMs: number;
};
declare function resolveLv6LookaheadWeights(): any;
declare function isSameMoveByCoord(a: any, b: any): boolean;
declare function resolveCandidateMoveByCoord(candidateMoves: any, move: any): any;
declare function maybeOverrideWithStrictPendingPlacement(selectedMove: any, candidateMoves: any, pendingType: any, movePlanScoreFn: any, board: any, boardBonusByCell: any, boardBonusConsumedByCell: any): any;
declare const _default: {
    buildLv6LookaheadOptions: typeof buildLv6LookaheadOptions;
    resolveLv6LookaheadWeights: typeof resolveLv6LookaheadWeights;
    resolveCandidateMoveByCoord: typeof resolveCandidateMoveByCoord;
    maybeOverrideWithStrictPendingPlacement: typeof maybeOverrideWithStrictPendingPlacement;
    isSameMoveByCoord: typeof isSameMoveByCoord;
};
export = _default;
//# sourceMappingURL=cpu-lv6-lookahead-profile.d.ts.map