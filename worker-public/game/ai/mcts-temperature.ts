declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function computeTemperature(moveNumber: number, boardSize: number = 8, initialTemp: number = 0.8, finalTemp: number = 0.2): number {
    const halflife = boardSize;
    const decay = Math.pow(0.5, moveNumber / halflife);
    return finalTemp + (initialTemp - finalTemp) * decay;
}

class RPCConfig {
    fullSearchRatio: number;
    fullSearchNodes: number;
    fastSearchNodes: number;

    constructor() {
        this.fullSearchRatio = 0.25;
        this.fullSearchNodes = 600;
        this.fastSearchNodes = 100;
    }

    shouldFullSearch(randomSeed: number): boolean {
        const hash = Math.abs(Math.sin(randomSeed * 12345.6789));
        return hash < this.fullSearchRatio;
    }

    getSearchBudget(randomSeed: number): number {
        return this.shouldFullSearch(randomSeed) ? this.fullSearchNodes : this.fastSearchNodes;
    }
}

class DiversityConfig {
    gameBranchingRate: number;
    positionBranchingRate: number;
    branchingMovesMin: number;
    branchingMovesMax: number;
    temperatureSchedule: number[];
    temperatureProbs: number[];

    constructor() {
        this.gameBranchingRate = 0.05;
        this.positionBranchingRate = 0.025;
        this.branchingMovesMin = 3;
        this.branchingMovesMax = 10;
        this.temperatureSchedule = [1.0, 2.0, Infinity];
        this.temperatureProbs = [0.70, 0.25, 0.05];
    }

    maybeBranchGame(gameId: number): { branchPoint: number; numBranchMoves: number; temp: number } | null {
        const hash = Math.abs(Math.sin(gameId * 98765.4321));
        if (hash >= this.gameBranchingRate) return null;

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

    shouldBranchPosition(positionId: number): boolean {
        const hash = Math.abs(Math.sin(positionId * 56789.1234));
        return hash < this.positionBranchingRate;
    }
}

class MCTSTemperatureManager {
    boardSize: number;
    initialTemp: number;
    finalTemp: number;
    useRPC: boolean;
    useDiversity: boolean;
    rpc: RPCConfig;
    diversity: DiversityConfig;

    constructor(options: any = {}) {
        this.boardSize = options.boardSize || 8;
        this.initialTemp = options.initialTemp || 0.8;
        this.finalTemp = options.finalTemp || 0.2;
        this.useRPC = options.useRPC !== false;
        this.useDiversity = options.useDiversity !== false;
        this.rpc = new RPCConfig();
        this.diversity = new DiversityConfig();
    }

    getTemperature(moveNumber: number): number {
        return computeTemperature(moveNumber, this.boardSize, this.initialTemp, this.finalTemp);
    }

    getSearchBudget(moveNumber: number, randomSeed: number): number {
        if (!this.useRPC) return this.rpc.fullSearchNodes;
        return this.rpc.getSearchBudget(randomSeed + moveNumber);
    }

    maybeBranchGame(gameId: number): any {
        if (!this.useDiversity) return null;
        return this.diversity.maybeBranchGame(gameId);
    }
}

const MCTSTemperature = {
    computeTemperature,
    RPCConfig,
    DiversityConfig,
    MCTSTemperatureManager
};

export = MCTSTemperature;
