/**
 * Process ultimate reverse dragons: convert surrounding enemy stones
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @returns {Promise<void}
 */
declare function processUltimateReverseDragonsAtTurnStart(player: any, precomputedEvents?: null): Promise<void>;
/**
 * Placement-turn immediate activation for a newly placed dragon anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
declare function processUltimateReverseDragonImmediateAtPlacement(player: any, row: any, col: any, precomputedResult?: null): Promise<void>;
declare const _default: {
    processUltimateReverseDragonsAtTurnStart: typeof processUltimateReverseDragonsAtTurnStart;
    processUltimateReverseDragonImmediateAtPlacement: typeof processUltimateReverseDragonImmediateAtPlacement;
};
export = _default;
//# sourceMappingURL=dragons.d.ts.map