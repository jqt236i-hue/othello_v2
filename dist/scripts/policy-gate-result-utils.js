"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const POLICY_GATE_PAYLOAD_SCHEMA_VERSION = 'policy_gate_result.v1';
function normalizeDiagnosticValue(value) {
    if (value === undefined)
        return null;
    if (value === null)
        return null;
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return value;
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : value;
    }
    return value;
}
function addCriterion(criteria, key, spec) {
    if (!criteria || !key || !spec || typeof spec !== 'object')
        return;
    if (spec.enabled === false)
        return;
    if (typeof spec.passed !== 'boolean')
        return;
    criteria[key] = {
        code: typeof spec.code === 'string' && spec.code.trim()
            ? spec.code.trim()
            : key,
        passed: spec.passed,
        actual: normalizeDiagnosticValue(spec.actual),
        required: normalizeDiagnosticValue(spec.required)
    };
}
function attachPolicyGateDecisionDiagnostics(decision, extraCriteria) {
    if (!decision || typeof decision !== 'object')
        return decision;
    const criteria = {};
    addCriterion(criteria, 'average', {
        code: 'average-threshold',
        passed: decision.passedByAverage,
        actual: decision.uplift,
        required: decision.threshold
    });
    addCriterion(criteria, 'lowerBound', {
        code: 'lower-bound',
        enabled: ((Number.isFinite(decision.requiredMinLowerBound) && Number(decision.requiredMinLowerBound) > -1) ||
            decision.passedByLowerBound === false),
        passed: decision.passedByLowerBound,
        actual: decision.upliftLowerBound,
        required: decision.requiredMinLowerBound
    });
    addCriterion(criteria, 'minSeedUplift', {
        code: 'min-seed-uplift',
        enabled: ((Number.isFinite(decision.requiredMinSeedUplift) && Number(decision.requiredMinSeedUplift) > -1) ||
            decision.passedByMinSeedUplift === false),
        passed: decision.passedByMinSeedUplift,
        actual: decision.minSeedUplift,
        required: decision.requiredMinSeedUplift
    });
    addCriterion(criteria, 'seedPassCount', {
        code: 'min-seed-pass-count',
        enabled: ((Number.isFinite(decision.requiredMinSeedPassCount) && Number(decision.requiredMinSeedPassCount) > 0) ||
            decision.passedBySeedPassCount === false),
        passed: decision.passedBySeedPassCount,
        actual: decision.seedPassCount,
        required: decision.requiredMinSeedPassCount
    });
    const extra = extraCriteria && typeof extraCriteria === 'object'
        ? extraCriteria
        : {};
    for (const [key, spec] of Object.entries(extra)) {
        addCriterion(criteria, key, spec);
    }
    const earlyStopReason = typeof decision.earlyStopReason === 'string' && decision.earlyStopReason
        ? decision.earlyStopReason
        : null;
    const failureReasons = [];
    if (decision.passed === false && earlyStopReason) {
        failureReasons.push(earlyStopReason);
    }
    for (const criterion of Object.values(criteria)) {
        if (criterion.passed === false && !failureReasons.includes(criterion.code)) {
            failureReasons.push(criterion.code);
        }
    }
    return Object.assign({}, decision, {
        decisionCriteria: criteria,
        failureReasons,
        primaryFailureReason: decision.passed === false
            ? (failureReasons[0] || 'failed')
            : null
    });
}
module.exports = {
    POLICY_GATE_PAYLOAD_SCHEMA_VERSION,
    attachPolicyGateDecisionDiagnostics
};
//# sourceMappingURL=policy-gate-result-utils.js.map