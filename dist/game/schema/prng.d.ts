/**
 * Create a seeded PRNG
 * @param {number} [seed=1] - Seed value
 * @returns {Object} PRNG object with random() and shuffle()
 */
export function createPRNG(seed?: number): Object;
/**
 * Create a PRNG from a saved state
 * @param {{ seed: number, calls: number }} savedState
 * @returns {Object} PRNG object
 */
export function fromState(savedState: {
    seed: number;
    calls: number;
}): Object;
//# sourceMappingURL=prng.d.ts.map