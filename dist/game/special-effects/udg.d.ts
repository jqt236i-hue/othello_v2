/**
 * @file udg.js
 * @description Ultimate Destroy God effect handlers
 */
/**
 * Process ultimate destroy gods: destroy surrounding enemy stones (Destroy)
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @returns {Promise<void>}
 */
export function processUltimateDestroyGodsAtTurnStart(player: number, precomputedResult?: null, precomputedEvents?: null): Promise<void>;
/**
 * Placement-turn immediate activation for a newly placed UDG anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
export function processUltimateDestroyGodImmediateAtPlacement(player: number, row: number, col: number, precomputedResult?: Object): Promise<void>;
//# sourceMappingURL=udg.d.ts.map