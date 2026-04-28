export = deepClone;
/**
 * Deep clone helper for plain data objects used by game/card state.
 * Prefer structuredClone when available; fallback to JSON clone.
 *
 * @param {any} value
 * @returns {any}
 */
declare function deepClone(value: any): any;
//# sourceMappingURL=deepClone.d.ts.map