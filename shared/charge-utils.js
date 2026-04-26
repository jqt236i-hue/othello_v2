/**
 * @file charge-utils.js
 * @description Charge value normalization utility shared across modules
 */

/**
 * Normalize a charge value to a finite integer.
 * @param {*} value - Raw charge value.
 * @returns {number} Normalized integer value.
 */
function normalizeChargeValue(value) {
  return Number.isFinite(Number(value))
    ? Math.trunc(Number(value))
    : 0;
}

module.exports = {
  normalizeChargeValue
};
