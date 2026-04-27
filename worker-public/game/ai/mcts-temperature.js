/**
 * @file mcts-temperature.js
 * @description KataGo-style temperature management and diversity configs for MCTS.
 */

'use strict';

/**
 * Compute temperature using KataGo-style exponential decay.
 *
 * @param {number} moveNumber - Current move number (0-indexed)
 * @param {number} [boardSize] - Board size (default 8)
 * @param {number} [initialTemp] - Initial temperature (default 0.8)
 * @param {number} [finalTemp] - Final temperature (default 0.2)
 * @returns {number}
 */
function computeTemperature(moveNumber, boardSize = 8, initialTemp = 0.8, finalTemp = 0.2) {
    const halflife = boardSize;
    const decay = Math.pow(0.5, moveNumber / halflife);
    return finalTemp + (initialTemp - finalTemp) * decay;
}

/**
 * RPC (Playout Cap Randomization) configuration.
 */
class RPCConfig {
    constructor() {
        this.fullSearchRatio = 0.25;  // 25% of moves use full search
        this.fullSearchNodes = 600;
        this.fastSearchNodes = 100;
    }

    /**
     * Should this move use full search?
     * @param {number} randomSeed
     * @returns {boolean}
     */
    shouldFullSearch(randomSeed) {
        // Deterministic based on seed
        const hash = Math.abs(Math.sin(randomSeed * 12345.6789));
        return hash < this.fullSearchRatio;
    }

    /**
     * Get search budget for this move.
     * @param {number} randomSeed
     * @returns {number}
     */
    getSearchBudget(randomSeed) {
        return this.shouldFullSearch(randomSeed) ? this.fullSearchNodes : this.fastSearchNodes;
    }
}

/**
 * Game/Position branching configuration for diversity.
 */
class DiversityConfig {
    constructor() {
        this.gameBranchingRate = 0.05;      // 5% of games branch
        this.positionBranchingRate = 0.025;  // 2.5% of positions branch
        this.branchingMovesMin = 3;
        this.branchingMovesMax = 10;
        this.temperatureSchedule = [1.0, 2.0, Infinity];
        this.temperatureProbs = [0.70, 0.25, 0.05];
    }

    /**
     * Maybe create a branch configuration for a game.
     * @param {number} gameId
     * @returns {{branchPoint: number, numBranchMoves: number, temp: number}|null}
     */
    maybeBranchGame(gameId) {
        const hash = Math.abs(Math.sin(gameId * 98765.4321));
        if (hash >= this.gameBranchingRate) return null;

        const branchPoint = Math.floor(-Math.log(1 - Math.random()) * 20);
        const numBranchMoves = this.branchingMovesMin +
            Math.floor(Math.random() * (this.branchingMovesMax - this.branchingMovesMin + 1));

        // Select temperature from schedule
        const tempHash = Math.random();
        let temp = this.temperatureSchedule[0];
        let cumsum = 0;
        for (let i = 0; i < this.temperatureProbs.length; i++) {
            cumsum += this.temperatureProbs[i];
            if (tempHash <= cumsum) {
                temp = this.temperatureSchedule[i];
                break;
            }
        }

        return { branchPoint, numBranchMoves, temp };
    }

    /**
     * Should we branch at this position?
     * @param {number} positionId
     * @returns {boolean}
     */
    shouldBranchPosition(positionId) {
        const hash = Math.abs(Math.sin(positionId * 56789.1234));
        return hash < this.positionBranchingRate;
    }
}

/**
 * Combined temperature + diversity manager for MCTS.
 */
class MCTSTemperatureManager {
    constructor(options = {}) {
        this.boardSize = options.boardSize || 8;
        this.initialTemp = options.initialTemp || 0.8;
        this.finalTemp = options.finalTemp || 0.2;
        this.useRPC = options.useRPC !== false;
        this.useDiversity = options.useDiversity !== false;
        this.rpc = new RPCConfig();
        this.diversity = new DiversityConfig();
    }

    /**
     * Get temperature for current move.
     * @param {number} moveNumber
     * @returns {number}
     */
    getTemperature(moveNumber) {
        return computeTemperature(moveNumber, this.boardSize, this.initialTemp, this.finalTemp);
    }

    /**
     * Get search budget for current move.
     * @param {number} moveNumber
     * @param {number} randomSeed
     * @returns {number}
     */
    getSearchBudget(moveNumber, randomSeed) {
        if (!this.useRPC) return this.rpc.fullSearchNodes;
        return this.rpc.getSearchBudget(randomSeed + moveNumber);
    }

    /**
     * Maybe branch this game.
     * @param {number} gameId
     * @returns {object|null}
     */
    maybeBranchGame(gameId) {
        if (!this.useDiversity) return null;
        return this.diversity.maybeBranchGame(gameId);
    }
}

module.exports = {
    computeTemperature,
    RPCConfig,
    DiversityConfig,
    MCTSTemperatureManager,
};
