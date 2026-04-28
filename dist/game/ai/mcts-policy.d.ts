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
export function searchWithMcts(state: object, cardState: object | null, playerKey: string, opts?: {
    numSimulations?: number | undefined;
    temperature?: number | undefined;
}): Promise<object | null>;
export namespace _gameInterface {
    export { copyGameState as copyState };
    export { copyCardState };
    export function hashState(state: any, cardState: any, playerKey: any): string;
    export function hashAfterAction(parentHash: any, action: any): string;
    export function listActions(state: any, cardState: any, playerKey: any): any[];
    export function applyAction(state: any, cardState: any, action: any, playerKey: any): {
        state: any;
        cardState: any;
        nextPlayer: string;
    };
    export function isTerminal(state: any, cardState: any): {
        isTerminal: boolean;
        value: number;
    };
    export function nextPlayer(playerKey: any): "black" | "white";
    export function actionToKey(action: any): string;
}
export namespace _network {
    function evaluate(state: any, cardState: any, playerKey: any): Promise<{
        policy: Map<any, any>;
        value: number;
    }>;
}
declare function copyGameState(state: any): any;
declare function copyCardState(cardState: any): any;
export {};
//# sourceMappingURL=mcts-policy.d.ts.map