"use strict";
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
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
    solve(state, cardState, playerKey, gameInterface) {
        this.transpositionTable.clear();
        this.nodeCount = 0;
        const result = this._solveRecursive(state, cardState, playerKey, gameInterface, 0, -Infinity, Infinity);
        return result;
    }
    _solveRecursive(state, cardState, playerKey, gameInterface, depth, alpha, beta) {
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
        let bestAction = null;
        // Move ordering: try captures and corners first
        const orderedActions = this._orderMoves(actions, state, playerKey, gameInterface);
        for (const action of orderedActions) {
            const result = gameInterface.applyAction(state, cardState, action, playerKey);
            const childResult = this._solveRecursive(result.state, result.cardState, result.nextPlayer, gameInterface, depth + 1, -beta, -alpha);
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
    _orderMoves(actions, state, playerKey, gameInterface) {
        // Simple move ordering: corners first, then edges, then others
        const scored = actions.map(action => {
            let score = 0;
            if (action.type === 'place') {
                const { row, col } = action;
                // Corner bonus
                if ((row === 0 || row === 7) && (col === 0 || col === 7)) {
                    score += 100;
                }
                // Edge bonus
                else if (row === 0 || row === 7 || col === 0 || col === 7) {
                    score += 50;
                }
                // Mobility bonus
                const flips = gameInterface.countFlips(state, row, col, playerKey);
                score += flips;
            }
            return { action, score };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.action);
    }
    _heuristicEvaluate(state, cardState, playerKey, gameInterface) {
        // Simple heuristic: disc difference normalized
        if (gameInterface.getDiscCounts) {
            const counts = gameInterface.getDiscCounts(state);
            const own = playerKey === 'black' ? counts.black : counts.white;
            const opp = playerKey === 'black' ? counts.white : counts.black;
            return (own - opp) / 64;
        }
        return 0;
    }
    _hashState(state, cardState, playerKey) {
        const boardStr = JSON.stringify(state && state.board);
        const chargeStr = cardState ? JSON.stringify(cardState.charge) : '';
        return `${boardStr}|${chargeStr}|${playerKey}`;
    }
}
class HybridSolver {
    /**
     * @param {object} opts
     * @param {object} opts.mctsModel
     * @param {EndgameSolver} opts.endgameSolver
     * @param {number} [opts.emptiesThreshold]
     * @param {object} opts.gameInterface
     */
    constructor({ mctsModel, endgameSolver, emptiesThreshold = 15, gameInterface }) {
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
    async search(state, cardState, playerKey) {
        const empties = this._countEmptyCells(state);
        const cardsRemaining = this._countCardsRemaining(cardState);
        // Use exact solver when no cards and few empty cells
        if (cardsRemaining === 0 && empties < this.emptiesThreshold) {
            const result = this.solver.solve(state, cardState, playerKey, this.gameInterface);
            return result.bestAction;
        }
        // Otherwise use MCTS
        return this.mcts.search(state, cardState, playerKey);
    }
    _countEmptyCells(state) {
        if (!state || !state.board)
            return 0;
        let count = 0;
        for (const row of state.board) {
            for (const cell of row) {
                if (cell === 0 || cell === '' || cell === null)
                    count++;
            }
        }
        return count;
    }
    _countCardsRemaining(cardState) {
        if (!cardState || !cardState.deck)
            return 0;
        let count = 0;
        for (const player of ['black', 'white']) {
            const deck = cardState.deck[player];
            if (Array.isArray(deck))
                count += deck.length;
            const hand = cardState.hand[player];
            if (Array.isArray(hand))
                count += hand.length;
        }
        return count;
    }
}
module.exports = { EndgameSolver, HybridSolver };
//# sourceMappingURL=endgame-solver.js.map