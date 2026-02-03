/**
 * @file prng.js
 * @description Seeded PRNG (Pseudo-Random Number Generator) for deterministic gameplay.
 * Uses a simple LCG (Linear Congruential Generator) for reproducibility.
 * 
 * For online play, both client and server use the same seed to produce identical results.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SeededPRNG = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Create a seeded PRNG
     * @param {number} [seed=1] - Seed value
     * @returns {Object} PRNG object with random() and shuffle()
     */
    function createPRNG(seed) {
        // Use a simple LCG for deterministic random numbers
        // Parameters from Numerical Recipes
        let state = (seed === undefined || seed === null) ? 1 : seed;
        state = state >>> 0; // Convert to unsigned 32-bit integer

        const prng = {
            _seed: seed,
            _calls: 0,

            /**
             * Get next random number in [0, 1)
             * @returns {number}
             */
            random: function () {
                // LCG: state = (a * state + c) mod m
                state = (state * 1664525 + 1013904223) >>> 0;
                this._calls++;
                return state / 0x100000000; // Divide by 2^32
            },

            /**
             * Shuffle an array in place (Fisher-Yates)
             * @param {Array} array
             */
            shuffle: function (array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(this.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
            },

            /**
             * Get a random integer in [0, max)
             * @param {number} max
             * @returns {number}
             */
            nextInt: function (max) {
                return Math.floor(this.random() * max);
            },

            /**
             * Get current state for serialization
             * @returns {{ seed: number, calls: number }}
             */
            getState: function () {
                return {
                    seed: this._seed,
                    calls: this._calls
                };
            },

            /**
             * Restore PRNG to a previous state
             * @param {{ seed: number, calls: number }} savedState
             */
            restoreState: function (savedState) {
                // Reset to seed and replay calls
                this._seed = savedState.seed;
                this._calls = 0;
                state = (savedState.seed === undefined || savedState.seed === null)
                    ? 1
                    : savedState.seed;
                state = state >>> 0;

                // Replay to reach the saved call count
                for (let i = 0; i < savedState.calls; i++) {
                    state = (state * 1664525 + 1013904223) >>> 0;
                }
                this._calls = savedState.calls;
            }
        };

        return prng;
    }

    /**
     * Create a PRNG from a saved state
     * @param {{ seed: number, calls: number }} savedState
     * @returns {Object} PRNG object
     */
    function fromState(savedState) {
        const prng = createPRNG(savedState.seed);
        prng.restoreState(savedState);
        return prng;
    }

    return {
        createPRNG,
        fromState
    };
}));
