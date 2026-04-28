"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function computeTemperature(moveNumber, boardSize = 8, initialTemp = 0.8, finalTemp = 0.2) {
    const halflife = boardSize;
    const decay = Math.pow(0.5, moveNumber / halflife);
    return finalTemp + (initialTemp - finalTemp) * decay;
}
class RPCConfig {
    constructor() {
        this.fullSearchRatio = 0.25;
        this.fullSearchNodes = 600;
        this.fastSearchNodes = 100;
    }
    shouldFullSearch(randomSeed) {
        const hash = Math.abs(Math.sin(randomSeed * 12345.6789));
        return hash < this.fullSearchRatio;
    }
    getSearchBudget(randomSeed) {
        return this.shouldFullSearch(randomSeed) ? this.fullSearchNodes : this.fastSearchNodes;
    }
}
class DiversityConfig {
    constructor() {
        this.gameBranchingRate = 0.05;
        this.positionBranchingRate = 0.025;
        this.branchingMovesMin = 3;
        this.branchingMovesMax = 10;
        this.temperatureSchedule = [1.0, 2.0, Infinity];
        this.temperatureProbs = [0.70, 0.25, 0.05];
    }
    maybeBranchGame(gameId) {
        const hash = Math.abs(Math.sin(gameId * 98765.4321));
        if (hash >= this.gameBranchingRate)
            return null;
        const branchPoint = Math.floor(-Math.log(1 - Math.random()) * 20);
        const numBranchMoves = this.branchingMovesMin +
            Math.floor(Math.random() * (this.branchingMovesMax - this.branchingMovesMin + 1));
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
    shouldBranchPosition(positionId) {
        const hash = Math.abs(Math.sin(positionId * 56789.1234));
        return hash < this.positionBranchingRate;
    }
}
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
    getTemperature(moveNumber) {
        return computeTemperature(moveNumber, this.boardSize, this.initialTemp, this.finalTemp);
    }
    getSearchBudget(moveNumber, randomSeed) {
        if (!this.useRPC)
            return this.rpc.fullSearchNodes;
        return this.rpc.getSearchBudget(randomSeed + moveNumber);
    }
    maybeBranchGame(gameId) {
        if (!this.useDiversity)
            return null;
        return this.diversity.maybeBranchGame(gameId);
    }
}
const MCTSTemperature = {
    computeTemperature,
    RPCConfig,
    DiversityConfig,
    MCTSTemperatureManager
};
module.exports = MCTSTemperature;
//# sourceMappingURL=mcts-temperature.js.map