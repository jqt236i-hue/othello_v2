// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

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
        try {
            return globalThis.structuredClone(value);
        } catch (e) {
            // Some persisted playback/presentation metadata still carries transient
            // helper functions. JSON cloning preserves the serializable state shape
            // while stripping those non-cloneable helpers.
        }
    }
    return JSON.parse(JSON.stringify(value));
}

module.exports = deepClone;

export {};
