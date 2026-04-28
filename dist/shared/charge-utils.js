"use strict";
/**
 * @file charge-utils.ts
 * @description Charge value normalization utility shared across modules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeChargeValue = normalizeChargeValue;
/**
 * Normalize a charge value to a finite integer.
 */
function normalizeChargeValue(value) {
    return Number.isFinite(Number(value))
        ? Math.trunc(Number(value))
        : 0;
}
//# sourceMappingURL=charge-utils.js.map