/**
 * @file charge-utils.ts
 * @description Charge value normalization utility shared across modules
 */

/**
 * Normalize a charge value to a finite integer.
 */
function normalizeChargeValue(value: unknown): number {
  return Number.isFinite(Number(value))
    ? Math.trunc(Number(value))
    : 0;
}

export {
  normalizeChargeValue
};