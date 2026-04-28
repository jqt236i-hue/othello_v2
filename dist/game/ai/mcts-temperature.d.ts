/**
 * Compute temperature using KataGo-style exponential decay.
 *
 * @param {number} moveNumber - Current move number (0-indexed)
 * @param {number} [boardSize] - Board size (default 8)
 * @param {number} [initialTemp] - Initial temperature (default 0.8)
 * @param {number} [finalTemp] - Final temperature (default 0.2)
 * @returns {number}
 */
export function computeTemperature(moveNumber: number, boardSize?: number, initialTemp?: number, finalTemp?: number): number;
/**
 * RPC (Playout Cap Randomization) configuration.
 */
export class RPCConfig {
    fullSearchRatio: number;
    fullSearchNodes: number;
    fastSearchNodes: number;
    /**
     * Should this move use full search?
     * @param {number} randomSeed
     * @returns {boolean}
     */
    shouldFullSearch(randomSeed: number): boolean;
    /**
     * Get search budget for this move.
     * @param {number} randomSeed
     * @returns {number}
     */
    getSearchBudget(randomSeed: number): number;
}
/**
 * Game/Position branching configuration for diversity.
 */
export class DiversityConfig {
    gameBranchingRate: number;
    positionBranchingRate: number;
    branchingMovesMin: number;
    branchingMovesMax: number;
    temperatureSchedule: number[];
    temperatureProbs: number[];
    /**
     * Maybe create a branch configuration for a game.
     * @param {number} gameId
     * @returns {{branchPoint: number, numBranchMoves: number, temp: number}|null}
     */
    maybeBranchGame(gameId: number): {
        branchPoint: number;
        numBranchMoves: number;
        temp: number;
    } | null;
    /**
     * Should we branch at this position?
     * @param {number} positionId
     * @returns {boolean}
     */
    shouldBranchPosition(positionId: number): boolean;
}
/**
 * Combined temperature + diversity manager for MCTS.
 */
export class MCTSTemperatureManager {
    constructor(options?: {});
    boardSize: any;
    initialTemp: any;
    finalTemp: any;
    useRPC: boolean;
    useDiversity: boolean;
    rpc: RPCConfig;
    diversity: DiversityConfig;
    /**
     * Get temperature for current move.
     * @param {number} moveNumber
     * @returns {number}
     */
    getTemperature(moveNumber: number): number;
    /**
     * Get search budget for current move.
     * @param {number} moveNumber
     * @param {number} randomSeed
     * @returns {number}
     */
    getSearchBudget(moveNumber: number, randomSeed: number): number;
    /**
     * Maybe branch this game.
     * @param {number} gameId
     * @returns {object|null}
     */
    maybeBranchGame(gameId: number): object | null;
}
//# sourceMappingURL=mcts-temperature.d.ts.map