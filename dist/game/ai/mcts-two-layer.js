/**
 * @file mcts-two-layer.js
 * @description Two-layer MCTS (Duelyst-style IMC) for Card Othello.
 *
 * Layer 1: Card selection (NO_CARD or use a card)
 * Layer 2: Placement search (standard MCTS after card effect)
 *
 * This allows the model to evaluate card+placement combinations jointly
 * instead of deciding the card only at the root.
 */
'use strict';
const { MCTSTree, MCTSNode } = require('./mcts-core');
class TwoLayerMCTS {
    /**
     * @param {object} opts
     * @param {object} opts.gameInterface
     * @param {object} opts.network
     * @param {number} [opts.cardSimulations] - Sims per card option (default 50)
     * @param {number} [opts.placementSimulations] - Sims for placement MCTS (default 50)
     * @param {number} [opts.maxCardOptions] - Max card options to evaluate (default 6)
     * @param {number} [opts.c_puct] - PUCT constant (default 1.5)
     * @param {number} [opts.temperature] - Temperature for final selection (default 1.0)
     */
    constructor({ gameInterface, network, cardSimulations = 50, placementSimulations = 50, maxCardOptions = 6, c_puct = 1.5, temperature = 1.0, }) {
        this.gameInterface = gameInterface;
        this.network = network;
        this.cardSimulations = cardSimulations;
        this.placementSimulations = placementSimulations;
        this.maxCardOptions = maxCardOptions;
        this.c_puct = c_puct;
        this.temperature = temperature;
        /** @type {Map<string, MCTSNode>} */
        this.nodeMap = new Map();
    }
    /**
     * Run two-layer MCTS search.
     *
     * @param {object} rootState
     * @param {object|null} rootCardState
     * @param {string} rootPlayerKey
     * @returns {Promise<{cardId: string|null, placement: object|null}>}
     */
    async search(rootState, rootCardState, rootPlayerKey) {
        // Layer 1: Enumerate card options
        const cardOptions = this._getCardOptions(rootCardState, rootPlayerKey);
        if (cardOptions.length === 0) {
            return { cardId: null, placement: null };
        }
        // Evaluate each card option with Layer 2 MCTS
        let bestCard = null;
        let bestValue = -Infinity;
        const cardValues = [];
        for (const cardId of cardOptions) {
            const value = await this._evaluateCardOption(cardId, rootState, rootCardState, rootPlayerKey);
            cardValues.push({ cardId, value });
            if (value > bestValue) {
                bestValue = value;
                bestCard = cardId;
            }
        }
        // If NO_CARD is best, run standard placement MCTS
        if (bestCard === null || bestCard === '__no_card__') {
            const placement = await this._runPlacementMCTS(rootState, rootCardState, rootPlayerKey);
            return { cardId: null, placement };
        }
        // Apply selected card and then run placement MCTS
        const afterCard = this._applyCard(rootState, rootCardState, bestCard, rootPlayerKey);
        const placement = await this._runPlacementMCTS(afterCard.state, afterCard.cardState, rootPlayerKey);
        return { cardId: bestCard, placement };
    }
    /**
     * Get available card options including NO_CARD.
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Array<string|null>}
     */
    _getCardOptions(cardState, playerKey) {
        if (!cardState || !cardState.hand) {
            return [null]; // Only NO_CARD
        }
        const hand = cardState.hand[playerKey] || [];
        const options = [null]; // NO_CARD always available
        for (const card of hand.slice(0, this.maxCardOptions - 1)) {
            if (card && card.id) {
                options.push(card.id);
            }
        }
        return options;
    }
    /**
     * Evaluate a card option by running placement MCTS after the card effect.
     * @param {string|null} cardId
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Promise<number>} Expected value from current player's perspective
     */
    async _evaluateCardOption(cardId, state, cardState, playerKey) {
        let nextState = state;
        let nextCardState = cardState;
        // Apply card effect if not NO_CARD
        if (cardId !== null && cardId !== '__no_card__') {
            const result = this._applyCard(state, cardState, cardId, playerKey);
            nextState = result.state;
            nextCardState = result.cardState;
        }
        // Check if game ended after card effect
        const terminal = this.gameInterface.isTerminal(nextState, nextCardState);
        if (terminal.isTerminal) {
            return terminal.value;
        }
        // Run placement MCTS to get value estimate
        const tree = new MCTSTree({
            gameInterface: this.gameInterface,
            network: this.network,
            numSimulations: this.placementSimulations,
            c_puct: this.c_puct,
            temperature: this.temperature,
        });
        const result = await tree.search(nextState, nextCardState, playerKey);
        if (!Array.isArray(result) || result.length === 0) {
            return 0;
        }
        // Return weighted average of top moves' values
        result.sort((a, b) => b.visitCount - a.visitCount);
        const topResult = result[0];
        return topResult.value - this._opportunityCost(cardId);
    }
    /**
     * Run standard placement-only MCTS.
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Promise<object|null>} Best placement action
     */
    async _runPlacementMCTS(state, cardState, playerKey) {
        const tree = new MCTSTree({
            gameInterface: this.gameInterface,
            network: this.network,
            numSimulations: this.placementSimulations * 2, // More sims for final decision
            c_puct: this.c_puct,
            temperature: this.temperature,
        });
        const result = await tree.search(state, cardState, playerKey);
        if (!Array.isArray(result) || result.length === 0) {
            return null;
        }
        result.sort((a, b) => b.visitCount - a.visitCount);
        return result[0].action;
    }
    /**
     * Apply a card effect to the game state.
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} cardId
     * @param {string} playerKey
     * @returns {{state: object, cardState: object|null}}
     */
    _applyCard(state, cardState, cardId, playerKey) {
        // Delegates to gameInterface if available, otherwise does nothing
        if (this.gameInterface.applyCardEffect) {
            return this.gameInterface.applyCardEffect(state, cardState, cardId, playerKey);
        }
        // Fallback: just consume the card
        const newState = this.gameInterface.copyState(state);
        const newCardState = cardState ? this.gameInterface.copyCardState(cardState) : null;
        if (newCardState && newCardState.hand && newCardState.hand[playerKey]) {
            const hand = newCardState.hand[playerKey];
            const idx = hand.findIndex(c => c && c.id === cardId);
            if (idx >= 0) {
                hand.splice(idx, 1);
            }
        }
        return { state: newState, cardState: newCardState };
    }
    /**
     * Compute opportunity cost of using a card.
     * @param {string|null} cardId
     * @returns {number}
     */
    _opportunityCost(cardId) {
        if (!cardId || cardId === '__no_card__')
            return 0;
        // Simple heuristic: higher cost cards have higher opportunity cost
        // In a full implementation, this would use the card characteristic vector
        return 0.02; // Small penalty to encourage card usage when beneficial
    }
}
module.exports = { TwoLayerMCTS };
//# sourceMappingURL=mcts-two-layer.js.map