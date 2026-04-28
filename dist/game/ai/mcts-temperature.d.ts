declare function computeTemperature(moveNumber: number, boardSize?: number, initialTemp?: number, finalTemp?: number): number;
declare class RPCConfig {
    fullSearchRatio: number;
    fullSearchNodes: number;
    fastSearchNodes: number;
    constructor();
    shouldFullSearch(randomSeed: number): boolean;
    getSearchBudget(randomSeed: number): number;
}
declare class DiversityConfig {
    gameBranchingRate: number;
    positionBranchingRate: number;
    branchingMovesMin: number;
    branchingMovesMax: number;
    temperatureSchedule: number[];
    temperatureProbs: number[];
    constructor();
    maybeBranchGame(gameId: number): {
        branchPoint: number;
        numBranchMoves: number;
        temp: number;
    } | null;
    shouldBranchPosition(positionId: number): boolean;
}
declare class MCTSTemperatureManager {
    boardSize: number;
    initialTemp: number;
    finalTemp: number;
    useRPC: boolean;
    useDiversity: boolean;
    rpc: RPCConfig;
    diversity: DiversityConfig;
    constructor(options?: any);
    getTemperature(moveNumber: number): number;
    getSearchBudget(moveNumber: number, randomSeed: number): number;
    maybeBranchGame(gameId: number): any;
}
declare const MCTSTemperature: {
    computeTemperature: typeof computeTemperature;
    RPCConfig: typeof RPCConfig;
    DiversityConfig: typeof DiversityConfig;
    MCTSTemperatureManager: typeof MCTSTemperatureManager;
};
export = MCTSTemperature;
//# sourceMappingURL=mcts-temperature.d.ts.map