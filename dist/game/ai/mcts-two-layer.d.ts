export class TwoLayerMCTS {
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
    constructor({ gameInterface, network, cardSimulations, placementSimulations, maxCardOptions, c_puct, temperature, }: {
        gameInterface: object;
        network: object;
        cardSimulations?: number | undefined;
        placementSimulations?: number | undefined;
        maxCardOptions?: number | undefined;
        c_puct?: number | undefined;
        temperature?: number | undefined;
    });
    gameInterface: object;
    network: object;
    cardSimulations: number;
    placementSimulations: number;
    maxCardOptions: number;
    c_puct: number;
    temperature: number;
    /** @type {Map<string, MCTSNode>} */
    nodeMap: Map<string, MCTSNode>;
    /**
     * Run two-layer MCTS search.
     *
     * @param {object} rootState
     * @param {object|null} rootCardState
     * @param {string} rootPlayerKey
     * @returns {Promise<{cardId: string|null, placement: object|null}>}
     */
    search(rootState: object, rootCardState: object | null, rootPlayerKey: string): Promise<{
        cardId: string | null;
        placement: object | null;
    }>;
    /**
     * Get available card options including NO_CARD.
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Array<string|null>}
     */
    _getCardOptions(cardState: object | null, playerKey: string): Array<string | null>;
    /**
     * Evaluate a card option by running placement MCTS after the card effect.
     * @param {string|null} cardId
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Promise<number>} Expected value from current player's perspective
     */
    _evaluateCardOption(cardId: string | null, state: object, cardState: object | null, playerKey: string): Promise<number>;
    /**
     * Run standard placement-only MCTS.
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} playerKey
     * @returns {Promise<object|null>} Best placement action
     */
    _runPlacementMCTS(state: object, cardState: object | null, playerKey: string): Promise<object | null>;
    /**
     * Apply a card effect to the game state.
     * @param {object} state
     * @param {object|null} cardState
     * @param {string} cardId
     * @param {string} playerKey
     * @returns {{state: object, cardState: object|null}}
     */
    _applyCard(state: object, cardState: object | null, cardId: string, playerKey: string): {
        state: object;
        cardState: object | null;
    };
    /**
     * Compute opportunity cost of using a card.
     * @param {string|null} cardId
     * @returns {number}
     */
    _opportunityCost(cardId: string | null): number;
}
import { MCTSNode } from "./mcts-core";
//# sourceMappingURL=mcts-two-layer.d.ts.map