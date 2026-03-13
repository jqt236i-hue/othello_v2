'use strict';

/**
 * Deep clone helper for plain data objects used by game/card state.
 * Prefer structuredClone when available; fallback to JSON clone.
 *
 * @param {any} value
 * @returns {any}
 */
function deepClone(value) {
    if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

module.exports = deepClone;
