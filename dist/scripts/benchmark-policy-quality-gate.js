#!/usr/bin/env node
// @ts-nocheck
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const benchmark_policy_adoption_1 = require("./benchmark-policy-adoption");
const policy_gate_result_utils_1 = __importDefault(require("./policy-gate-result-utils"));
const { POLICY_GATE_PAYLOAD_SCHEMA_VERSION, attachPolicyGateDecisionDiagnostics } = policy_gate_result_utils_1.default;
const policy_seed_utils_1 = __importDefault(require("./policy-seed-utils"));
const { buildSeedSchedule } = policy_seed_utils_1.default;
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const DEFAULT_QUALITY_WEIGHTS = Object.freeze({
    qualityWeightCorner: 0.20,
    qualityWeightEdge: 0.08,
    qualityWeightCornerRecovery: 0.15,
    qualityWeightCornerRecapture: 0.15,
    qualityWeightEdgeRecovery: 0.10,
    qualityWeightCornerHold: 0.08,
    qualityWeightCornerHoldTurns: 0.05,
    qualityWeightEdgeHold: 0.05,
    qualityWeightEdgeChain: 0.10,
    qualityWeightFinalCornerShare: 0.04,
    qualityWeightFinalEdgeShare: 0.02,
    qualityWeightFinalLongestEdgeRunShare: 0.06,
    qualityWeightBonus: 0.02,
    qualityWeightCardImmediate: 0.01,
    qualityWeightCardFuture: 0.01,
    qualityWeightPlaceDelta: 0.01
});
const QUALITY_WEIGHT_KEYS = Object.freeze(Object.keys(DEFAULT_QUALITY_WEIGHTS));
function parseArgs(argv) {
    let qualityThresholdOverride = null;
    let qualityGateStrengthFirst = null;
    const adoptionArgv = [];
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        if (token === '--quality-gate-strength-first') {
            qualityGateStrengthFirst = true;
            continue;
        }
        if (token === '--no-quality-gate-strength-first') {
            qualityGateStrengthFirst = false;
            continue;
        }
        if (token === '--threshold') {
            const rawValue = argv[i + 1];
            const num = Number(rawValue);
            if (Number.isFinite(num) && num < 0) {
                qualityThresholdOverride = num;
                adoptionArgv.push('--threshold', '0');
                i += 1;
                continue;
            }
        }
        adoptionArgv.push(token);
    }
    const args = (0, benchmark_policy_adoption_1.parseArgs)(adoptionArgv);
    args.gatePhase = 'quality';
    if (qualityThresholdOverride !== null) {
        args.threshold = qualityThresholdOverride;
    }
    if (qualityGateStrengthFirst !== null) {
        args.qualityGateStrengthFirst = qualityGateStrengthFirst;
    }
    else if (args.qualityGateStrengthFirst !== true) {
        args.qualityGateStrengthFirst = false;
    }
    const hasExplicitQualityWeights = QUALITY_WEIGHT_KEYS.some((key) => Number(args[key]) > 0);
    if (!hasExplicitQualityWeights) {
        for (const key of QUALITY_WEIGHT_KEYS) {
            args[key] = DEFAULT_QUALITY_WEIGHTS[key];
        }
    }
    return args;
}
function buildQualitySeedDecision(seedDecision, threshold) {
    const baselineQualityScore = Number(seedDecision && seedDecision.baselineQualityScore) || 0;
    const candidateQualityScore = Number(seedDecision && seedDecision.candidateQualityScore) || 0;
    const uplift = candidateQualityScore - baselineQualityScore;
    return {
        baselineScore: baselineQualityScore,
        candidateScore: candidateQualityScore,
        uplift,
        threshold,
        passed: uplift >= threshold,
        baselineQualityScore,
        candidateQualityScore,
        qualityWeights: seedDecision && seedDecision.qualityWeights ? seedDecision.qualityWeights : null
    };
}
function buildStrengthFirstSourceDecision(perSeed, options) {
    const sourceSeedDecisions = Array.isArray(perSeed)
        ? perSeed
            .map((entry) => entry && entry.decision ? entry.decision : null)
            .filter((entry) => !!entry)
        : [];
    const threshold = Math.max(0, Number.isFinite(options && options.threshold) ? Number(options.threshold) : 0);
    const minLowerBound = Math.max(0, Number.isFinite(options && options.minLowerBound) ? Number(options.minLowerBound) : 0);
    const minSeedUplift = Math.max(0, Number.isFinite(options && options.minSeedUplift) ? Number(options.minSeedUplift) : 0);
    const minSeedPassCount = Number.isFinite(options && options.minSeedPassCount)
        ? Math.max(0, Math.floor(Number(options.minSeedPassCount)))
        : 0;
    const confidenceLevel = Number.isFinite(options && options.confidenceLevel)
        ? Number(options.confidenceLevel)
        : 0.95;
    return (0, benchmark_policy_adoption_1.computeAdoptionDecisionAverage)(sourceSeedDecisions, threshold, minSeedUplift, minSeedPassCount, confidenceLevel, minLowerBound);
}
function buildQualityGatePayload(adoptionPayload, options, earlyStop) {
    const perSeed = Array.isArray(adoptionPayload && adoptionPayload.perSeed)
        ? adoptionPayload.perSeed.map((entry) => Object.assign({}, entry, {
            qualityDecision: buildQualitySeedDecision(entry && entry.decision, options.threshold)
        }))
        : [];
    const sourceSeedSchedule = adoptionPayload && adoptionPayload.seedSchedule
        ? adoptionPayload.seedSchedule
        : null;
    const seedSchedule = buildSeedSchedule(sourceSeedSchedule && Number.isFinite(Number(sourceSeedSchedule.baseSeed))
        ? Number(sourceSeedSchedule.baseSeed)
        : options.seed, sourceSeedSchedule && Number.isFinite(Number(sourceSeedSchedule.seedCount))
        ? Number(sourceSeedSchedule.seedCount)
        : options.seedCount, sourceSeedSchedule && Number.isFinite(Number(sourceSeedSchedule.seedStride))
        ? Number(sourceSeedSchedule.seedStride)
        : options.seedStride, perSeed.map((entry) => entry && entry.seed));
    const qualitySeedDecisions = perSeed.map((entry) => entry.qualityDecision);
    const maxPossibleSeedUplift = QUALITY_WEIGHT_KEYS.reduce((sum, key) => sum + (Number(options[key]) || 0), 0);
    const qualityDecision = earlyStop
        ? (0, benchmark_policy_adoption_1.buildEarlyStopDecision)(qualitySeedDecisions, options.seedCount, Object.assign({}, options, { maxPossibleSeedUplift }), earlyStop)
        : (0, benchmark_policy_adoption_1.computeAdoptionDecisionAverage)(qualitySeedDecisions, options.threshold, options.minSeedUplift, options.minSeedPassCount, options.confidenceLevel, options.minLowerBound);
    const rawSourceDecision = adoptionPayload && adoptionPayload.decision ? adoptionPayload.decision : null;
    const sourceDecision = options && options.qualityGateStrengthFirst
        ? buildStrengthFirstSourceDecision(perSeed, options)
        : rawSourceDecision;
    const combinedDecision = options && options.qualityGateStrengthFirst && sourceDecision
        ? Object.assign({}, qualityDecision, {
            passed: !!qualityDecision.passed && !!sourceDecision.passed,
            passedByQuality: !!qualityDecision.passed,
            passedBySourceStrength: !!sourceDecision.passed,
            sourceStrengthUplift: sourceDecision.uplift,
            sourceStrengthUpliftLowerBound: sourceDecision.upliftLowerBound,
            sourceStrengthMinSeedUplift: sourceDecision.minSeedUplift,
            sourceStrengthSeedPassCount: sourceDecision.seedPassCount,
            sourceStrengthSeedCount: sourceDecision.seedCount,
            sourceStrengthThreshold: sourceDecision.threshold,
            sourceStrengthRequiredMinLowerBound: sourceDecision.requiredMinLowerBound,
            sourceStrengthRequiredMinSeedUplift: sourceDecision.requiredMinSeedUplift,
            sourceStrengthRequiredMinSeedPassCount: sourceDecision.requiredMinSeedPassCount
        })
        : qualityDecision;
    const normalizedSourceDecision = sourceDecision
        ? attachPolicyGateDecisionDiagnostics(sourceDecision)
        : null;
    const normalizedRawSourceDecision = rawSourceDecision && sourceDecision !== rawSourceDecision
        ? attachPolicyGateDecisionDiagnostics(rawSourceDecision)
        : null;
    const decision = attachPolicyGateDecisionDiagnostics(combinedDecision, options && options.qualityGateStrengthFirst && normalizedSourceDecision
        ? {
            sourceStrength: {
                code: 'source-strength',
                passed: normalizedSourceDecision.passed,
                actual: normalizedSourceDecision.uplift,
                required: normalizedSourceDecision.threshold
            }
        }
        : null);
    const benchmarkSchemaVersion = adoptionPayload && adoptionPayload.schemaVersion
        ? adoptionPayload.schemaVersion
        : null;
    return {
        generatedAt: new Date().toISOString(),
        schemaVersion: benchmarkSchemaVersion,
        payloadSchemaVersion: POLICY_GATE_PAYLOAD_SCHEMA_VERSION,
        gateType: 'quality',
        gateFamily: 'quality',
        benchmarkSchemaVersion,
        config: {
            games: options.games,
            seed: options.seed,
            seedCount: options.seedCount,
            seedStride: options.seedStride,
            jobs: options.jobs,
            maxPlies: options.maxPlies,
            threshold: options.threshold,
            confidenceLevel: options.confidenceLevel,
            minLowerBound: options.minLowerBound,
            minSeedUplift: options.minSeedUplift,
            minSeedPassCount: options.minSeedPassCount,
            qualityGateStrengthFirst: !!(options && options.qualityGateStrengthFirst),
            candidateModelPath: options.candidateModelPath,
            baselineModelPath: options.baselineModelPath || null,
            opponentModelPath: options.opponentModelPath || null,
            qualityWeights: QUALITY_WEIGHT_KEYS.reduce((acc, key) => {
                acc[key] = Number(options[key]) || 0;
                return acc;
            }, {})
        },
        seedSchedule,
        baseline: adoptionPayload && adoptionPayload.baseline ? adoptionPayload.baseline : null,
        candidate: adoptionPayload && adoptionPayload.candidate ? adoptionPayload.candidate : null,
        earlyStop: earlyStop || null,
        perSeed,
        decision,
        sourceDecision: normalizedSourceDecision,
        rawSourceDecision: normalizedRawSourceDecision
    };
}
async function runQualityGate(options) {
    const maxPossibleSeedUplift = QUALITY_WEIGHT_KEYS.reduce((sum, key) => sum + (Number(options[key]) || 0), 0);
    const execution = await (0, benchmark_policy_adoption_1.runSeedEvaluations)(Object.assign({}, options, {
        maxPossibleSeedUplift,
        decisionSelector: (entry) => buildQualitySeedDecision(entry && entry.decision, options.threshold)
    }));
    const adoptionPayload = (0, benchmark_policy_adoption_1.buildAdoptionPayload)(options, execution.perSeed, execution.startedAt);
    return buildQualityGatePayload(adoptionPayload, options, execution.earlyStop);
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    const result = await runQualityGate(args);
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(result, null, 2), 'utf8');
        console.log(`[policy-quality-gate] wrote: ${args.out}`);
    }
    const d = result.decision;
    const source = result.sourceDecision;
    console.log(`[policy-quality-gate] baseline_quality=${d.baselineScore.toFixed(3)} candidate_quality=${d.candidateScore.toFixed(3)} ` +
        `uplift=${d.uplift.toFixed(3)} uplift_lb=${d.upliftLowerBound.toFixed(3)} threshold=${d.threshold.toFixed(3)} ` +
        `seeds=${d.seedCount || 1} seed_pass=${d.seedPassCount || 0}/${d.seedCount || 0} ` +
        `source_uplift=${source && Number.isFinite(source.uplift) ? source.uplift.toFixed(3) : 'n/a'} ` +
        `source_lb=${source && Number.isFinite(source.upliftLowerBound) ? source.upliftLowerBound.toFixed(3) : 'n/a'} ` +
        `source_pass=${source && source.passed === true} early_stop=${d.earlyStopReason || 'none'} failure_reason=${d.primaryFailureReason || 'none'} pass=${d.passed}`);
    process.exit(d.passed ? 0 : 2);
}
if (require.main === module) {
    main().catch((err) => {
        console.error('[policy-quality-gate] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}
module.exports = {
    DEFAULT_QUALITY_WEIGHTS,
    parseArgs,
    buildQualitySeedDecision,
    buildStrengthFirstSourceDecision,
    buildQualityGatePayload,
    runQualityGate
};
//# sourceMappingURL=benchmark-policy-quality-gate.js.map