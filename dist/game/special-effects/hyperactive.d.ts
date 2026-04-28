/**
 * Process hyperactive stone moves at turn start (both players).
 * Runs AFTER bombs/dragons/breeding.
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @param {Object} [precomputedResult] - Optional pre-computed result from logic layer
 * @returns {Promise<void>}
 */
declare function processHyperactiveMovesAtTurnStart(player: any, precomputedResult?: null, precomputedEvents?: null): Promise<void>;
/**
 * Placement-turn immediate activation for a newly placed hyperactive stone.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
declare function processHyperactiveImmediateAtPlacement(player: any, row: any, col: any, precomputedResult?: null): Promise<void>;
declare const _default: {
    processHyperactiveMovesAtTurnStart: typeof processHyperactiveMovesAtTurnStart;
    processHyperactiveImmediateAtPlacement: typeof processHyperactiveImmediateAtPlacement;
};
export = _default;
//# sourceMappingURL=hyperactive.d.ts.map