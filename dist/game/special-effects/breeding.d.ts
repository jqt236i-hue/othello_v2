declare function setUIImpl(obj: any): void;
/**
 * Process breeding effects (Stone spawning)
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @param {Object} [precomputedResult] - Optional pre-computed result from logic layer
 * @returns {Promise<void>}
 */
declare function processBreedingEffectsAtTurnStart(player: any, precomputedEvents?: null): Promise<void>;
/**
 * Placement-turn immediate activation for a newly placed breeding anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
declare function processBreedingImmediateAtPlacement(player: any, row: any, col: any, precomputedResult?: null): Promise<void>;
declare const _default: {
    processBreedingEffectsAtTurnStart: typeof processBreedingEffectsAtTurnStart;
    processBreedingImmediateAtPlacement: typeof processBreedingImmediateAtPlacement;
    setUIImpl: typeof setUIImpl;
};
export = _default;
//# sourceMappingURL=breeding.d.ts.map