declare function copyGameState(state: any): any;
declare function copyCardState(cardState: any): any;
/**
 * Run a lightweight MCTS search and return the most visited action.
 *
 * @param {object} state
 * @param {object|null} cardState
 * @param {string} playerKey
 * @param {object} [opts]
 * @param {number} [opts.numSimulations]
 * @param {number} [opts.temperature]
 * @returns {Promise<object|null>}  Best action or null on failure.
 */
declare function searchWithMcts(state: any, cardState: any, playerKey: any, opts: any): Promise<any>;
declare const _default: {
    searchWithMcts: typeof searchWithMcts;
    _gameInterface: {
        copyState: typeof copyGameState;
        copyCardState: typeof copyCardState;
        hashState(state: any, cardState: any, playerKey: any): string;
        hashAfterAction(parentHash: any, action: any): string;
        listActions(state: any, cardState: any, playerKey: any): any[];
        applyAction(state: any, cardState: any, action: any, playerKey: any): {
            state: any;
            cardState: any;
            nextPlayer: string;
        };
        isTerminal(state: any, cardState: any): {
            isTerminal: boolean;
            value: number;
        };
        nextPlayer(playerKey: any): "black" | "white";
        actionToKey(action: any): string;
    };
    _network: {
        evaluate(state: any, cardState: any, playerKey: any): Promise<{
            policy: Map<any, any>;
            value: number;
        }>;
    };
};
export = _default;
//# sourceMappingURL=mcts-policy.d.ts.map