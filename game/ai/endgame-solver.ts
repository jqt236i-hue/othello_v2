declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
  if (typeof __non_webpack_require__ !== 'undefined') {
    return __non_webpack_require__(id);
  }
  if (typeof require === 'function') {
    return require(id);
  }
  throw new Error('Unable to require ' + id);
}

const SharedBoardUtils = _require('../../shared/shared-board-utils');

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



class EndgameSolver {
    maxDepth: number;
    transpositionTable: Map<string, any>;
    nodeCount: number;

    constructor(maxDepth = 20) {
        this.maxDepth = maxDepth;
        this.transpositionTable = new Map();
        this.nodeCount = 0;
    }

    /**
     * Solve endgame position using Minimax with Alpha-Beta pruning.
     *
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @param {object} gameInterface
     * @returns {{value: number, bestAction: object|null}}
     */
    solve(state: any, cardState: any, playerKey: any, gameInterface: any) {
        this.transpositionTable.clear();
        this.nodeCount = 0;
        const result = this._solveRecursive(state, cardState, playerKey, gameInterface, 0, -Infinity, Infinity);
        return result;
    }

    _solveRecursive(state: any, cardState: any, playerKey: any, gameInterface: any, depth: any, alpha: any, beta: any): any {
        this.nodeCount++;

        // Check terminal
        const terminal = gameInterface.isTerminal(state, cardState);
        if (terminal.isTerminal) {
            return { value: terminal.value, bestAction: null };
        }

        // Check max depth
        if (depth >= this.maxDepth) {
            // Fallback to heuristic evaluation
            const heuristic = this._heuristicEvaluate(state, cardState, playerKey, gameInterface);
            return { value: heuristic, bestAction: null };
        }

        // Transposition table lookup
        const stateHash = this._hashState(state, cardState, playerKey);
        const cached = this.transpositionTable.get(stateHash);
        if (cached && cached.depth >= this.maxDepth - depth) {
            return cached.result;
        }

        // Get legal actions
        const actions = gameInterface.listActions(state, cardState, playerKey);
        if (actions.length === 0) {
            // Pass: switch player
            const nextPlayer = gameInterface.nextPlayer(playerKey);
            const passResult = this._solveRecursive(state, cardState, nextPlayer, gameInterface, depth + 1, -beta, -alpha);
            return { value: -passResult.value, bestAction: null };
        }

        let bestValue = -Infinity;
        let bestAction: any = null;

        // Move ordering: try captures and corners first
        const orderedActions = this._orderMoves(actions, state, cardState, playerKey, gameInterface);

        for (const action of orderedActions) {
            const result = gameInterface.applyAction(state, cardState, action, playerKey);
            const childResult = this._solveRecursive(
                result.state, result.cardState, result.nextPlayer, gameInterface, depth + 1, -beta, -alpha
            );
            const value = -childResult.value;

            if (value > bestValue) {
                bestValue = value;
                bestAction = action;
            }

            alpha = Math.max(alpha, value);
            if (alpha >= beta) {
                break; // Alpha-beta cutoff
            }
        }

        const result = { value: bestValue, bestAction };
        this.transpositionTable.set(stateHash, { depth: this.maxDepth - depth, result });
        return result;
    }

    _orderMoves(actions: any, state: any, cardState: any, playerKey: any, gameInterface: any) {
        // Simple move ordering: corners first, then edges, then others
        const boardContext = this._createBoardContext(state, cardState);
        const scored = actions.map((action: any) => {
            let score = 0;
            if (action.type === 'place') {
                const { row, col } = action;
                // Corner bonus
                if (
                    boardContext &&
                    SharedBoardUtils.isCornerCell(row, col, boardContext)
                ) {
                    score += 100;
                }
                // Edge bonus
                else if (
                    boardContext &&
                    SharedBoardUtils.isEdgeCell(row, col, boardContext)
                ) {
                    score += 50;
                }
                // Mobility bonus
                const flips = gameInterface.countFlips(state, row, col, playerKey);
                score += flips;
            }
            return { action, score };
        });
        scored.sort((a: any, b: any) => b.score - a.score);
        return scored.map((s: any) => s.action);
    }

    _heuristicEvaluate(state: any, cardState: any, playerKey: any, gameInterface: any) {
        // Simple heuristic: disc difference normalized
        if (gameInterface.getDiscCounts) {
            const counts = gameInterface.getDiscCounts(state);
            const own = playerKey === 'black' ? counts.black : counts.white;
            const opp = playerKey === 'black' ? counts.white : counts.black;
            const boardContext = this._createBoardContext(state, cardState);
            const playableCellCount = boardContext
                ? SharedBoardUtils.collectBoardCoordinates(boardContext).length
                : 0;
            return (own - opp) / Math.max(1, playableCellCount || (own + opp));
        }
        return 0;
    }

    _createBoardContext(state: any, cardState: any) {
        if (!state || !Array.isArray(state.board)) return null;
        return SharedBoardUtils.createBoardContext(state, cardState || null);
    }

    _hashState(state: any, cardState: any, playerKey: any) {
        const boardContext = this._createBoardContext(state, cardState);
        const boardStr = boardContext
            ? SharedBoardUtils.encodeBoard(boardContext)
            : JSON.stringify(state || null);
        const chargeStr = cardState ? JSON.stringify(cardState.charge) : '';
        return `${boardStr}|${chargeStr}|${playerKey}`;
    }
}

class HybridSolver {
    mcts: any;
    solver: EndgameSolver;
    emptiesThreshold: number;
    gameInterface: any;

    /**
     * @param {object} opts
     * @param {object} opts.mctsModel
     * @param {EndgameSolver} opts.endgameSolver
     * @param {number} [opts.emptiesThreshold]
     * @param {object} opts.gameInterface
     */
    constructor({ mctsModel, endgameSolver, emptiesThreshold = 15, gameInterface }: { mctsModel: any; endgameSolver: any; emptiesThreshold?: number; gameInterface: any }) {
        this.mcts = mctsModel;
        this.solver = endgameSolver;
        this.emptiesThreshold = emptiesThreshold;
        this.gameInterface = gameInterface;
    }

    /**
     * Search using hybrid approach.
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Promise<object>} Best action
     */
    async search(state: any, cardState: any, playerKey: any) {
        const empties = this._countEmptyCells(state, cardState);
        const cardsRemaining = this._countCardsRemaining(cardState);

        // Use exact solver when no cards and few empty cells
        if (cardsRemaining === 0 && empties < this.emptiesThreshold) {
            const result = this.solver.solve(state, cardState, playerKey, this.gameInterface);
            return result.bestAction;
        }

        // Otherwise use MCTS
        return this.mcts.search(state, cardState, playerKey);
    }

    _countEmptyCells(state: any, cardState: any) {
        if (!state || !Array.isArray(state.board)) return 0;
        const boardContext = SharedBoardUtils.createBoardContext(state, cardState || null);
        return SharedBoardUtils.countBoardEmpties(boardContext);
    }

    _countCardsRemaining(cardState: any) {
        if (!cardState || !cardState.deck) return 0;
        let count = 0;
        for (const player of ['black', 'white']) {
            const deck = cardState.deck[player];
            if (Array.isArray(deck)) count += deck.length;
            const hand = cardState.hand[player];
            if (Array.isArray(hand)) count += hand.length;
        }
        return count;
    }
}

export = { EndgameSolver, HybridSolver };
