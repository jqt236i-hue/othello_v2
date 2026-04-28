/**
 * Process breeding effects (Stone spawning)
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @param {Object} [precomputedResult] - Optional pre-computed result from logic layer
 * @returns {Promise<void>}
 */
export function processBreedingEffectsAtTurnStart(player: number, precomputedEvents?: null): Promise<void>;
/**
 * Placement-turn immediate activation for a newly placed breeding anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
export function processBreedingImmediateAtPlacement(player: number, row: number, col: number, precomputedResult?: Object): Promise<void>;
export function setUIImpl(obj: any): void;
//# sourceMappingURL=breeding.d.ts.map