export class EndgameSolver {
    constructor(maxDepth?: number);
    maxDepth: number;
    transpositionTable: Map<any, any>;
    nodeCount: number;
    /**
     * Solve endgame position using Minimax with Alpha-Beta pruning.
     *
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @param {object} gameInterface
     * @returns {{value: number, bestAction: object|null}}
     */
    solve(state: object, cardState: object | null, playerKey: string, gameInterface: object): {
        value: number;
        bestAction: object | null;
    };
    _solveRecursive(state: any, cardState: any, playerKey: any, gameInterface: any, depth: any, alpha: any, beta: any): any;
    _orderMoves(actions: any, state: any, playerKey: any, gameInterface: any): any;
    _heuristicEvaluate(state: any, cardState: any, playerKey: any, gameInterface: any): number;
    _hashState(state: any, cardState: any, playerKey: any): string;
}
export class HybridSolver {
    /**
     * @param {object} opts
     * @param {object} opts.mctsModel
     * @param {EndgameSolver} opts.endgameSolver
     * @param {number} [opts.emptiesThreshold]
     * @param {object} opts.gameInterface
     */
    constructor({ mctsModel, endgameSolver, emptiesThreshold, gameInterface }: {
        mctsModel: object;
        endgameSolver: EndgameSolver;
        emptiesThreshold?: number | undefined;
        gameInterface: object;
    });
    mcts: object;
    solver: EndgameSolver;
    emptiesThreshold: number;
    gameInterface: object;
    /**
     * Search using hybrid approach.
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Promise<object>} Best action
     */
    search(state: object, cardState: object | null, playerKey: string): Promise<object>;
    _countEmptyCells(state: any): number;
    _countCardsRemaining(cardState: any): number;
}
//# sourceMappingURL=endgame-solver.d.ts.map