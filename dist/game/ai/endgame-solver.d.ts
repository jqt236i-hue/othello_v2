/**
 * @file endgame-solver.js
 * @description Endgame solver using Minimax + Alpha-Beta pruning.
 *
 * Hybrid solver: switches from MCTS to exact solver when:
 *   - No cards remaining
 *   - Empty cells < threshold (default 15)
 *
 * Reference: Edex/Egaroucid endgame solving techniques.
 */
declare class EndgameSolver {
    constructor(maxDepth?: number);
    /**
     * Solve endgame position using Minimax with Alpha-Beta pruning.
     *
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @param {object} gameInterface
     * @returns {{value: number, bestAction: object|null}}
     */
    solve(state: any, cardState: any, playerKey: any, gameInterface: any): any;
    _solveRecursive(state: any, cardState: any, playerKey: any, gameInterface: any, depth: any, alpha: any, beta: any): any;
    _orderMoves(actions: any, state: any, playerKey: any, gameInterface: any): any;
    _heuristicEvaluate(state: any, cardState: any, playerKey: any, gameInterface: any): number;
    _hashState(state: any, cardState: any, playerKey: any): string;
}
declare class HybridSolver {
    /**
     * @param {object} opts
     * @param {object} opts.mctsModel
     * @param {EndgameSolver} opts.endgameSolver
     * @param {number} [opts.emptiesThreshold]
     * @param {object} opts.gameInterface
     */
    constructor({ mctsModel, endgameSolver, emptiesThreshold, gameInterface }: {
        mctsModel: any;
        endgameSolver: any;
        emptiesThreshold?: number | undefined;
        gameInterface: any;
    });
    /**
     * Search using hybrid approach.
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Promise<object>} Best action
     */
    search(state: any, cardState: any, playerKey: any): Promise<any>;
    _countEmptyCells(state: any): number;
    _countCardsRemaining(cardState: any): number;
}
declare const _default: {
    EndgameSolver: typeof EndgameSolver;
    HybridSolver: typeof HybridSolver;
};
export = _default;
//# sourceMappingURL=endgame-solver.d.ts.map