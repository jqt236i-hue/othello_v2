export function buildLv6LookaheadOptions(level: any, board: any, legalMovesCount: any, playerKey: any, runtimeMode: any, runtimeOverrides: any): {
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
export function resolveLv6LookaheadWeights(): any;
export function resolveCandidateMoveByCoord(candidateMoves: any, move: any): any;
export function maybeOverrideWithStrictPendingPlacement(selectedMove: any, candidateMoves: any, pendingType: any, movePlanScoreFn: any, board: any, boardBonusByCell: any, boardBonusConsumedByCell: any): any;
export function isSameMoveByCoord(a: any, b: any): boolean;
//# sourceMappingURL=cpu-lv6-lookahead-profile.d.ts.map