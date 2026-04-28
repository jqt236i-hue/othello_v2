/**
 * @file bombs.js
 * @description Bomb handling (tick + explosion UI)
 */
/**
 * Process all bombs: decrement turn counters and explode those that reach 0
 * @async
 * @returns {Promise<void>}
 */
export function processBombs(precomputedEvents?: null): Promise<void>;
/**
 * Handle UI for bomb explosion
 * @param {number} row
 * @param {number} col
 */
export function explodeBombUI(row: number, col: number): Promise<void>;
//# sourceMappingURL=bombs.d.ts.map