declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const POLICY_GATE_PAYLOAD_SCHEMA_VERSION = 'policy_gate_result.v1';

function buildPolicyGatePayloadHeader(options: any) {
    const gateFamily = options && options.gateFamily ? String(options.gateFamily) : null;
    const gateType = options && options.gateType ? String(options.gateType) : gateFamily;
    const benchmarkSchemaVersion = options && options.benchmarkSchemaVersion
        ? options.benchmarkSchemaVersion
        : null;
    return {
        generatedAt: new Date().toISOString(),
        schemaVersion: benchmarkSchemaVersion,
        payloadSchemaVersion: POLICY_GATE_PAYLOAD_SCHEMA_VERSION,
        gateFamily,
        gateType,
        benchmarkSchemaVersion
    };
}

function normalizeDiagnosticValue(value: any): any {
    if (value === undefined) return null;
    if (value === null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return value;
        const numeric = Number(trimmed);
        return Number.isFinite(numeric) ? numeric : value;
    }
    return value;
}

interface CriterionSpec {
    code?: string;
    passed: boolean;
    enabled?: boolean;
    actual?: any;
    required?: any;
}

interface Criterion {
    code: string;
    passed: boolean;
    actual: any;
    required: any;
}

function addCriterion(criteria: Record<string, Criterion>, key: string, spec: CriterionSpec) {
    if (!criteria || !key || !spec || typeof spec !== 'object') return;
    if (spec.enabled === false) return;
    if (typeof spec.passed !== 'boolean') return;
    criteria[key] = {
        code: typeof spec.code === 'string' && spec.code.trim()
            ? spec.code.trim()
            : key,
        passed: spec.passed,
        actual: normalizeDiagnosticValue(spec.actual),
        required: normalizeDiagnosticValue(spec.required)
    };
}

interface Decision {
    passedByAverage?: boolean;
    uplift?: number;
    threshold?: number;
    passedByLowerBound?: boolean;
    requiredMinLowerBound?: number;
    upliftLowerBound?: number;
    passedByMinSeedUplift?: boolean;
    requiredMinSeedUplift?: number;
    minSeedUplift?: number;
    passedBySeedPassCount?: boolean;
    requiredMinSeedPassCount?: number;
    seedPassCount?: number;
    passed?: boolean;
    earlyStopReason?: string;
}

interface DecisionWithDiagnostics extends Decision {
    decisionCriteria: Record<string, Criterion>;
    failureReasons: string[];
    primaryFailureReason: string | null;
}

function attachPolicyGateDecisionDiagnostics(decision: Decision, extraCriteria?: Record<string, CriterionSpec>): DecisionWithDiagnostics {
    if (!decision || typeof decision !== 'object') return decision as any;

    const criteria: Record<string, Criterion> = {};
    addCriterion(criteria, 'average', {
        code: 'average-threshold',
        passed: decision.passedByAverage!,
        actual: decision.uplift,
        required: decision.threshold
    });
    addCriterion(criteria, 'lowerBound', {
        code: 'lower-bound',
        enabled: (
            (Number.isFinite(decision.requiredMinLowerBound!) && Number(decision.requiredMinLowerBound) > -1) ||
            decision.passedByLowerBound === false
        ),
        passed: decision.passedByLowerBound!,
        actual: decision.upliftLowerBound,
        required: decision.requiredMinLowerBound
    });
    addCriterion(criteria, 'minSeedUplift', {
        code: 'min-seed-uplift',
        enabled: (
            (Number.isFinite(decision.requiredMinSeedUplift!) && Number(decision.requiredMinSeedUplift) > -1) ||
            decision.passedByMinSeedUplift === false
        ),
        passed: decision.passedByMinSeedUplift!,
        actual: decision.minSeedUplift,
        required: decision.requiredMinSeedUplift
    });
    addCriterion(criteria, 'seedPassCount', {
        code: 'min-seed-pass-count',
        enabled: (
            (Number.isFinite(decision.requiredMinSeedPassCount!) && Number(decision.requiredMinSeedPassCount) > 0) ||
            decision.passedBySeedPassCount === false
        ),
        passed: decision.passedBySeedPassCount!,
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
    const failureReasons: string[] = [];
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

export = { 
    POLICY_GATE_PAYLOAD_SCHEMA_VERSION,
    buildPolicyGatePayloadHeader,
    attachPolicyGateDecisionDiagnostics
 } as any;
