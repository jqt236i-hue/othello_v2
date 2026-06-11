declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    TRAINING_CHECKPOINT_HEAD_SPECS,
    createEmptyResumeCheckpointPaths,
    cloneResumeCheckpointPaths,
    detectCheckpointHead,
    isCheckpointNameCompatibleWithHead
} = require('./training-checkpoint-utils');
const {
    DEFAULT_SELFPLAY_WHITE_DECK_CODE
} = require('./selfplay-deck-options');
const {
    TRAINING_CYCLE_STEP_ORDER
} = require('./training-cycle-steps');

function defaultSelfplayJobs() {
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    return Math.max(1, Math.min(10, cpuCount));
}

function normalizeRestartFromStep(stepName) {
    const normalized = String(stepName || '').trim().toLowerCase();
    if (!normalized) return null;
    const matched = TRAINING_CYCLE_STEP_ORDER.find((one) => one.toLowerCase() === normalized);
    return matched || null;
}

function shouldReuseStepArtifacts(args, stepName) {
    if (!args || !args.reuseExistingArtifacts) return false;
    const restartFromStep = normalizeRestartFromStep(args.restartFromStep);
    if (!restartFromStep) return true;
    const stepIndex = TRAINING_CYCLE_STEP_ORDER.indexOf(stepName);
    const restartIndex = TRAINING_CYCLE_STEP_ORDER.indexOf(restartFromStep);
    if (stepIndex < 0 || restartIndex < 0) return true;
    return stepIndex < restartIndex;
}

function normalizeSelfplayCandidateAdmission(mode) {
    const normalized = String(mode || '').trim().toLowerCase();
    if (!normalized) return 'promoted-only';
    if (normalized === 'promoted-only' || normalized === 'quick-pass' || normalized === 'always') {
        return normalized;
    }
    throw new Error('--selfplay-candidate-admission must be promoted-only, quick-pass, or always');
}

function shouldIncludeCandidateFilesAtStartup(args) {
    return normalizeSelfplayCandidateAdmission(args && args.selfplayCandidateAdmission) === 'always';
}

function shouldAdmitCandidateGuide(args, result) {
    if (result && result.promoted) return true;
    const mode = normalizeSelfplayCandidateAdmission(args && args.selfplayCandidateAdmission);
    if (mode === 'always') return true;
    if (mode === 'promoted-only') return false;
    const quickDecision = result && result.quickDecision ? result.quickDecision : null;
    return !!(quickDecision && quickDecision.passed);
}

function describeSelfplayGuideUpdateMode(args) {
    const mode = normalizeSelfplayCandidateAdmission(args && args.selfplayCandidateAdmission);
    if (mode === 'always') return 'candidate-every-iteration';
    if (mode === 'quick-pass') return 'candidate-quick-pass';
    return 'promoted-only';
}

function getPrimaryResumeCheckpointPath(resumeCheckpointPaths) {
    return resumeCheckpointPaths && resumeCheckpointPaths.policy
        ? resumeCheckpointPaths.policy
        : null;
}

function resolveResumeCheckpointPathsFromArgs(args) {
    const resolved = createEmptyResumeCheckpointPaths();
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        if (args && args[spec.argKey]) {
            resolved[spec.head] = args[spec.argKey];
        }
    }
    if (args && args.resumeCheckpointPath) {
        const detectedHead = detectCheckpointHead(args.resumeCheckpointPath);
        if (!detectedHead) {
            if (resolved.policy && path.resolve(resolved.policy) === path.resolve(args.resumeCheckpointPath)) {
                return resolved;
            }
            throw new Error(
                `--resume-checkpoint must point to a policy-net/policy-card/policy-target/policy-value checkpoint: ${args.resumeCheckpointPath}`
            );
        }
        if (resolved[detectedHead] && path.resolve(resolved[detectedHead]) !== path.resolve(args.resumeCheckpointPath)) {
            const conflictingSpec = TRAINING_CHECKPOINT_HEAD_SPECS.find((spec) => spec.head === detectedHead);
            throw new Error(`--resume-checkpoint conflicts with ${conflictingSpec ? conflictingSpec.resumeFlag : detectedHead}`);
        }
        resolved[detectedHead] = args.resumeCheckpointPath;
    }
    return resolved;
}

function resolveCarryOverResumeCheckpointPaths(carryOver) {
    const resolved = cloneResumeCheckpointPaths(carryOver && carryOver.resumeCheckpointPaths);
    if (!resolved.policy && carryOver && carryOver.resumeCheckpointPath) {
        resolved.policy = carryOver.resumeCheckpointPath;
    }
    return resolved;
}

function parseSelfplayCardUsageRateScheduleSpec(value, flagName) {
    const label = flagName || '--selfplay-card-usage-rate-schedule';
    const raw = String(value || '').trim();
    if (!raw) return [];
    const entries = raw.split(',').map((one) => one.trim()).filter((one) => !!one);
    let lastIteration = 0;
    return entries.map((entry) => {
        const parts = entry.split('@');
        if (parts.length !== 2) {
            throw new Error(`${label} entries must use <rate>@<iteration>`);
        }
        const rate = Number(parts[0]);
        const iteration = Number(parts[1]);
        if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
            throw new Error(`${label} rates must be in [0,1]`);
        }
        if (!Number.isFinite(iteration) || iteration < 1 || Math.floor(iteration) !== iteration) {
            throw new Error(`${label} iterations must be integers >= 1`);
        }
        if (iteration <= lastIteration) {
            throw new Error(`${label} iterations must be strictly increasing`);
        }
        lastIteration = iteration;
        return {
            iteration,
            rate
        };
    });
}

function resolveSelfplayCardUsageRateForIteration(args, iterationIndex) {
    if (!args || args.allowCardUsage === false) return 0;
    const fallbackRate = Number.isFinite(args.cardUsageRate) ? Number(args.cardUsageRate) : 0;
    const schedule = Array.isArray(args.selfplayCardUsageRateSchedule)
        ? args.selfplayCardUsageRateSchedule
        : [];
    if (schedule.length <= 0) return fallbackRate;
    let resolvedRate = fallbackRate;
    for (const entry of schedule) {
        if (!entry || !Number.isFinite(entry.iteration) || !Number.isFinite(entry.rate)) continue;
        if (iterationIndex < entry.iteration) break;
        resolvedRate = Number(entry.rate);
    }
    return resolvedRate;
}

function createSelfplayTrainingCycleDefaults(env) {
    const runtimeEnv = (env && typeof env === 'object') ? env : {};
    const cwd = runtimeEnv.cwd || process.cwd();
    const defaultJobs = Number.isFinite(runtimeEnv.defaultJobs) ? Math.max(1, Math.floor(runtimeEnv.defaultJobs)) : defaultSelfplayJobs();
    return {
        iterations: 1,
        maxHours: 100,
        trainGames: 20000,
        evalGames: 2000,
        selfplayJobs: defaultJobs,
        selfplayResumeChunkSize: 1000,
        adoptionJobs: defaultJobs,
        onnxGateJobs: defaultJobs,
        seed: 1,
        seedStride: 1000,
        evalSeedOffset: 100000,
        maxPlies: 220,
        allowCardUsage: true,
        cardUsageRate: 0.2,
        selfplayBlackDeckCode: null,
        selfplayWhiteDeckCode: DEFAULT_SELFPLAY_WHITE_DECK_CODE,
        selfplayGenerateHardcases: true,
        selfplayPolicyMixRate: 1,
        selfplayPolicyModelPoolSize: 4,
        selfplayPolicyPoolSampling: 'recency',
        selfplayPolicyPoolRecencyDecay: 2.5,
        selfplayPolicyCurrentAnchorRate: 0.35,
        selfplayCardUsageRateJitter: 0,
        selfplayCardUsageRateScheduleSpec: null,
        selfplayCardUsageRateSchedule: [],
        selfplayTacticalWeightMin: 1,
        selfplayTacticalWeightMax: 1,
        selfplayTacticalDepthOpening: 4,
        selfplayTacticalDepthMid: 6,
        selfplayTacticalDepthEnd: 8,
        selfplayTacticalBeamWidth: 12,
        selfplayTeacherCommitteeWeightMin: 28,
        selfplayTeacherCommitteeWeightMax: 28,
        selfplayTeacherCommitteeConsensusBonusMin: 320,
        selfplayTeacherCommitteeConsensusBonusMax: 320,
        selfplayPolicyScoreWeightMin: 1,
        selfplayPolicyScoreWeightMax: 1,
        selfplayHeuristicWeightMin: 1,
        selfplayHeuristicWeightMax: 1,
        pythonPath: path.resolve(cwd, '.venv', 'Scripts', 'python.exe'),
        onnxEpochs: 9999,
        onnxBatchSize: 2048,
        onnxLr: 0.001,
        onnxValueLr: null,
        onnxHiddenSize: 256,
        onnxValueHiddenSize: null,
        onnxDevice: 'auto',
        onnxLogIntervalSteps: 0,
        onnxValSplit: 0.1,
        onnxValSplitMode: 'grouped-game',
        onnxEarlyStopPatience: 8,
        onnxEarlyStopMinDelta: 0.0005,
        onnxEarlyStopMinEpochs: 8,
        onnxEarlyStopMonitor: 'val_loss',
        onnxEarlyStopSmoothingWindow: 1,
        onnxLrPlateauPatience: 0,
        onnxLrPlateauFactor: 0.6,
        onnxLrPlateauMinLr: 1e-5,
        onnxResumeOptimizer: false,
        onnxCardNoActionWeight: 0.7,
        onnxCardClassBalancePower: 0.25,
        onnxWinnerSampleBoost: 0.35,
        onnxLoserSampleWeight: 0.8,
        onnxDrawSampleWeight: 1.0,
        onnxCornerEmergencySampleBoost: 0.0,
        onnxNegativeFutureDiscSampleBoost: 0.0,
        onnxNegativeFutureDiscThreshold: -1.0,
        onnxTacticalMissSampleBoost: 0.0,
        onnxTacticalMissThreshold: 0.08,
        onnxHandPressureSampleBoost: 0.0,
        onnxPendingTargetSampleBoost: 0.0,
        onnxCornerBalanceSampleBoost: 0.0,
        onnxEdgeBalanceSampleBoost: 0.0,
        onnxEconomyBalanceSampleBoost: 0.0,
        onnxValueTargetCornerWeight: 0.0,
        onnxValueTargetEdgeWeight: 0.0,
        onnxValueTargetEconomyWeight: 0.0,
        onnxValueTargetCornerEmergencyWeight: 0.0,
        trainTargetHeadEnabled: true,
        trainValueHeadEnabled: true,
        trainCardEvery: 1,
        trainTargetEvery: 1,
        trainValueEvery: 1,
        minVisits: 12,
        shapeImmediate: 0.4,
        quickGames: 500,
        finalGames: 2000,
        threshold: 0.05,
        adoptionSeedCount: 1,
        adoptionSeedStride: 1000,
        adoptionFinalSeedOffset: 500000,
        adoptionConfidenceLevel: 0.95,
        adoptionMinLowerBound: -1,
        adoptionMinSeedUplift: -1,
        adoptionMinSeedPassCount: 0,
        qualityGateEnabled: false,
        qualityGateGames: 1000,
        qualityGateSeedCount: 1,
        qualityGateSeedStride: 1000,
        qualityGateSeedOffset: 250000,
        qualityGateThreshold: 0,
        qualityGateConfidenceLevel: 0.95,
        qualityGateMinLowerBound: -1,
        qualityGateMinSeedUplift: -1,
        qualityGateMinSeedPassCount: 0,
        qualityGateStrengthFirst: false,
        quickAdoptionSeedOffset: 0,
        quickAdoptionThreshold: null,
        quickAdoptionSeedCount: null,
        quickAdoptionSeedStride: null,
        quickAdoptionConfidenceLevel: null,
        quickAdoptionMinLowerBound: null,
        quickAdoptionMinSeedUplift: null,
        quickAdoptionMinSeedPassCount: null,
        finalAdoptionThreshold: null,
        finalAdoptionSeedCount: null,
        finalAdoptionSeedStride: null,
        finalAdoptionConfidenceLevel: null,
        finalAdoptionMinLowerBound: null,
        finalAdoptionMinSeedUplift: null,
        finalAdoptionMinSeedPassCount: null,
        adoptionTacticalWeight: 0.25,
        adoptionTacticalDepthOpening: 4,
        adoptionTacticalDepthMid: 6,
        adoptionTacticalDepthEnd: 8,
        adoptionTacticalBeamWidth: 12,
        adoptionPolicyScoreWeight: 2.0,
        adoptionHeuristicWeight: 0.85,
        adoptionWhitePriority: 1.0,
        adoptionQualityWeightCorner: 0.22,
        adoptionQualityWeightEdge: 0.10,
        adoptionQualityWeightCornerRecovery: 0.18,
        adoptionQualityWeightCornerRecapture: 0.14,
        adoptionQualityWeightEdgeRecovery: 0.12,
        adoptionQualityWeightCornerHold: 0.16,
        adoptionQualityWeightCornerHoldTurns: 0.10,
        adoptionQualityWeightEdgeHold: 0.09,
        adoptionQualityWeightEdgeChain: 0.12,
        adoptionQualityWeightFinalCornerShare: 0.24,
        adoptionQualityWeightFinalEdgeShare: 0.06,
        adoptionQualityWeightFinalLongestEdgeRunShare: 0.08,
        adoptionQualityWeightBonus: 0.01,
        adoptionQualityWeightCardImmediate: 0.015,
        adoptionQualityWeightCardFuture: 0.02,
        adoptionQualityWeightPlaceDelta: 0.015,
        adoptionUseGuideBaseline: false,
        adoptionUseAnchorBaseline: false,
        onnxGateEnabled: false,
        onnxGateGames: 8,
        onnxGateSeedCount: 1,
        onnxGateSeedStride: 1000,
        onnxGateSeedOffset: 700000,
        onnxGateThreshold: 0.5,
        onnxGateMinSeedScore: 0,
        onnxGateMinSeedPassCount: 0,
        onnxGateMaxAverageLatencyMs: 0,
        onnxGateMaxP95LatencyMs: 0,
        onnxGateMaxMaxLatencyMs: 0,
        onnxGateTimeoutMs: 180000,
        onnxGateBlackLevel: 6,
        onnxGateWhiteLevel: 6,
        onnxGateCandidateColorMode: 'white',
        promotionMode: 'strict',
        onnxPrimaryMaxQuickRegression: 0.05,
        onnxPrimaryRequireQuickRegression: false,
        onnxPrimaryRequireQuickNonRegression: false,
        onnxPrimaryMinQuickCoreDelta: 0.0,
        onnxPrimaryMinQuickWhiteDelta: 0.0,
        onnxPrimaryMinQuickQualityDelta: -0.01,
        onnxPrimaryMinQuickUplift: 0.0,
        onnxPrimaryMinQuickLowerBound: -1.0,
        onnxPrimaryMinOnnxGateAvg: 0.0,
        onnxPrimaryMinOnnxGateMinSeed: 0.0,
        gateFinalIterationOnly: false,
        promoteOnPass: true,
        selfplayUsePromotedModelOnly: true,
        selfplayCandidateAdmission: 'promoted-only',
        bootstrapPolicyModelPath: null,
        resumeCheckpointPath: null,
        resumePolicyCheckpointPath: null,
        resumeCardCheckpointPath: null,
        resumeTargetCheckpointPath: null,
        resumeValueCheckpointPath: null,
        resumeCheckpointPaths: createEmptyResumeCheckpointPaths(),
        carryOverCheckpoint: true,
        carryOverCheckpointMode: 'always',
        seedBankPath: null,
        runTag: null,
        runsDir: path.resolve(cwd, 'data', 'runs'),
        modelsDir: path.resolve(cwd, 'data', 'models'),
        summaryOut: null,
        reuseExistingArtifacts: false,
        restartFromStep: null,
        verbose: false,
        help: false
    };
}

function parseSelfplayTrainingCycleArgs(argv) {
    const args = createSelfplayTrainingCycleDefaults();

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--iterations' || a === '-n') { args.iterations = Number(argv[++i]); continue; }
        if (a === '--max-hours') { args.maxHours = Number(argv[++i]); continue; }
        if (a === '--train-games') { args.trainGames = Number(argv[++i]); continue; }
        if (a === '--eval-games') { args.evalGames = Number(argv[++i]); continue; }
        if (a === '--selfplay-jobs') { args.selfplayJobs = Number(argv[++i]); continue; }
        if (a === '--selfplay-resume-chunk-size') { args.selfplayResumeChunkSize = Number(argv[++i]); continue; }
        if (a === '--adoption-jobs') { args.adoptionJobs = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-jobs') { args.onnxGateJobs = Number(argv[++i]); continue; }
        if (a === '--seed' || a === '-s') { args.seed = Number(argv[++i]); continue; }
        if (a === '--seed-stride') { args.seedStride = Number(argv[++i]); continue; }
        if (a === '--eval-seed-offset') { args.evalSeedOffset = Number(argv[++i]); continue; }
        if (a === '--max-plies') { args.maxPlies = Number(argv[++i]); continue; }
        if (a === '--with-cards') { args.allowCardUsage = true; continue; }
        if (a === '--no-cards') { args.allowCardUsage = false; continue; }
        if (a === '--selfplay-hardcases') { args.selfplayGenerateHardcases = true; continue; }
        if (a === '--no-selfplay-hardcases') { args.selfplayGenerateHardcases = false; continue; }
        if (a === '--card-usage-rate') { args.cardUsageRate = Number(argv[++i]); continue; }
        if (a === '--selfplay-black-deck-code') { args.selfplayBlackDeckCode = String(argv[++i] || '').trim() || null; continue; }
        if (a === '--selfplay-white-deck-code') { args.selfplayWhiteDeckCode = String(argv[++i] || '').trim() || null; continue; }
        if (a === '--no-selfplay-white-deck-code') { args.selfplayWhiteDeckCode = null; continue; }
        if (a === '--selfplay-policy-mix-rate') { args.selfplayPolicyMixRate = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-model-pool-size') { args.selfplayPolicyModelPoolSize = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-pool-sampling') { args.selfplayPolicyPoolSampling = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--selfplay-policy-pool-recency-decay') { args.selfplayPolicyPoolRecencyDecay = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-current-anchor-rate') { args.selfplayPolicyCurrentAnchorRate = Number(argv[++i]); continue; }
        if (a === '--selfplay-card-usage-rate-jitter') { args.selfplayCardUsageRateJitter = Number(argv[++i]); continue; }
        if (a === '--selfplay-card-usage-rate-schedule') {
            args.selfplayCardUsageRateScheduleSpec = String(argv[++i] || '').trim();
            continue;
        }
        if (a === '--selfplay-tactical-weight-min') { args.selfplayTacticalWeightMin = Number(argv[++i]); continue; }
        if (a === '--selfplay-tactical-weight-max') { args.selfplayTacticalWeightMax = Number(argv[++i]); continue; }
        if (a === '--selfplay-tactical-depth-opening') { args.selfplayTacticalDepthOpening = Number(argv[++i]); continue; }
        if (a === '--selfplay-tactical-depth-mid') { args.selfplayTacticalDepthMid = Number(argv[++i]); continue; }
        if (a === '--selfplay-tactical-depth-end') { args.selfplayTacticalDepthEnd = Number(argv[++i]); continue; }
        if (a === '--selfplay-tactical-beam-width') { args.selfplayTacticalBeamWidth = Number(argv[++i]); continue; }
        if (a === '--selfplay-teacher-committee-weight-min') { args.selfplayTeacherCommitteeWeightMin = Number(argv[++i]); continue; }
        if (a === '--selfplay-teacher-committee-weight-max') { args.selfplayTeacherCommitteeWeightMax = Number(argv[++i]); continue; }
        if (a === '--selfplay-teacher-committee-consensus-bonus-min') { args.selfplayTeacherCommitteeConsensusBonusMin = Number(argv[++i]); continue; }
        if (a === '--selfplay-teacher-committee-consensus-bonus-max') { args.selfplayTeacherCommitteeConsensusBonusMax = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-score-weight-min') { args.selfplayPolicyScoreWeightMin = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-score-weight-max') { args.selfplayPolicyScoreWeightMax = Number(argv[++i]); continue; }
        if (a === '--selfplay-heuristic-weight-min') { args.selfplayHeuristicWeightMin = Number(argv[++i]); continue; }
        if (a === '--selfplay-heuristic-weight-max') { args.selfplayHeuristicWeightMax = Number(argv[++i]); continue; }
        if (a === '--python') { args.pythonPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--onnx-epochs') { args.onnxEpochs = Number(argv[++i]); continue; }
        if (a === '--onnx-batch-size') { args.onnxBatchSize = Number(argv[++i]); continue; }
        if (a === '--onnx-lr') { args.onnxLr = Number(argv[++i]); continue; }
        if (a === '--onnx-value-lr') { args.onnxValueLr = Number(argv[++i]); continue; }
        if (a === '--onnx-hidden-size') { args.onnxHiddenSize = Number(argv[++i]); continue; }
        if (a === '--onnx-value-hidden-size') { args.onnxValueHiddenSize = Number(argv[++i]); continue; }
        if (a === '--onnx-device') { args.onnxDevice = String(argv[++i] || '').trim().toLowerCase() || 'auto'; continue; }
        if (a === '--onnx-log-interval-steps') { args.onnxLogIntervalSteps = Number(argv[++i]); continue; }
        if (a === '--onnx-val-split') { args.onnxValSplit = Number(argv[++i]); continue; }
        if (a === '--onnx-val-split-mode') { args.onnxValSplitMode = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--onnx-early-stop-patience') { args.onnxEarlyStopPatience = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-min-delta') { args.onnxEarlyStopMinDelta = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-min-epochs') { args.onnxEarlyStopMinEpochs = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-monitor') { args.onnxEarlyStopMonitor = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--onnx-early-stop-smoothing-window') { args.onnxEarlyStopSmoothingWindow = Number(argv[++i]); continue; }
        if (a === '--onnx-lr-plateau-patience') { args.onnxLrPlateauPatience = Number(argv[++i]); continue; }
        if (a === '--onnx-lr-plateau-factor') { args.onnxLrPlateauFactor = Number(argv[++i]); continue; }
        if (a === '--onnx-lr-plateau-min-lr') { args.onnxLrPlateauMinLr = Number(argv[++i]); continue; }
        if (a === '--onnx-resume-optimizer') { args.onnxResumeOptimizer = true; continue; }
        if (a === '--no-onnx-resume-optimizer') { args.onnxResumeOptimizer = false; continue; }
        if (a === '--onnx-card-no-action-weight') { args.onnxCardNoActionWeight = Number(argv[++i]); continue; }
        if (a === '--onnx-card-class-balance-power') { args.onnxCardClassBalancePower = Number(argv[++i]); continue; }
        if (a === '--onnx-winner-sample-boost') { args.onnxWinnerSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-loser-sample-weight') { args.onnxLoserSampleWeight = Number(argv[++i]); continue; }
        if (a === '--onnx-draw-sample-weight') { args.onnxDrawSampleWeight = Number(argv[++i]); continue; }
        if (a === '--onnx-corner-emergency-sample-boost') { args.onnxCornerEmergencySampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-negative-future-disc-sample-boost') { args.onnxNegativeFutureDiscSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-negative-future-disc-threshold') { args.onnxNegativeFutureDiscThreshold = Number(argv[++i]); continue; }
        if (a === '--onnx-tactical-miss-sample-boost') { args.onnxTacticalMissSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-tactical-miss-threshold') { args.onnxTacticalMissThreshold = Number(argv[++i]); continue; }
        if (a === '--onnx-hand-pressure-sample-boost') { args.onnxHandPressureSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-pending-target-sample-boost') { args.onnxPendingTargetSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-corner-balance-sample-boost') { args.onnxCornerBalanceSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-edge-balance-sample-boost') { args.onnxEdgeBalanceSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-economy-balance-sample-boost') { args.onnxEconomyBalanceSampleBoost = Number(argv[++i]); continue; }
        if (a === '--onnx-value-target-corner-weight') { args.onnxValueTargetCornerWeight = Number(argv[++i]); continue; }
        if (a === '--onnx-value-target-edge-weight') { args.onnxValueTargetEdgeWeight = Number(argv[++i]); continue; }
        if (a === '--onnx-value-target-economy-weight') { args.onnxValueTargetEconomyWeight = Number(argv[++i]); continue; }
        if (a === '--onnx-value-target-corner-emergency-weight') { args.onnxValueTargetCornerEmergencyWeight = Number(argv[++i]); continue; }
        if (a === '--train-target-head') { args.trainTargetHeadEnabled = true; continue; }
        if (a === '--no-train-target-head') { args.trainTargetHeadEnabled = false; continue; }
        if (a === '--train-value-head') { args.trainValueHeadEnabled = true; continue; }
        if (a === '--no-train-value-head') { args.trainValueHeadEnabled = false; continue; }
        if (a === '--train-card-every') { args.trainCardEvery = Number(argv[++i]); continue; }
        if (a === '--train-target-every') { args.trainTargetEvery = Number(argv[++i]); continue; }
        if (a === '--train-value-every') { args.trainValueEvery = Number(argv[++i]); continue; }
        if (a === '--min-visits') { args.minVisits = Number(argv[++i]); continue; }
        if (a === '--shape-immediate') { args.shapeImmediate = Number(argv[++i]); continue; }
        if (a === '--quick-games') { args.quickGames = Number(argv[++i]); continue; }
        if (a === '--final-games') { args.finalGames = Number(argv[++i]); continue; }
        if (a === '--threshold') { args.threshold = Number(argv[++i]); continue; }
        if (a === '--adoption-seed-count') { args.adoptionSeedCount = Number(argv[++i]); continue; }
        if (a === '--adoption-seed-stride') { args.adoptionSeedStride = Number(argv[++i]); continue; }
        if (a === '--adoption-final-seed-offset') { args.adoptionFinalSeedOffset = Number(argv[++i]); continue; }
        if (a === '--adoption-confidence-level') { args.adoptionConfidenceLevel = Number(argv[++i]); continue; }
        if (a === '--adoption-min-lower-bound') { args.adoptionMinLowerBound = Number(argv[++i]); continue; }
        if (a === '--adoption-min-seed-uplift') { args.adoptionMinSeedUplift = Number(argv[++i]); continue; }
        if (a === '--adoption-min-seed-pass-count') { args.adoptionMinSeedPassCount = Number(argv[++i]); continue; }
        if (a === '--quality-gate') { args.qualityGateEnabled = true; continue; }
        if (a === '--no-quality-gate') { args.qualityGateEnabled = false; continue; }
        if (a === '--quality-gate-games') { args.qualityGateGames = Number(argv[++i]); continue; }
        if (a === '--quality-gate-seed-count') { args.qualityGateSeedCount = Number(argv[++i]); continue; }
        if (a === '--quality-gate-seed-stride') { args.qualityGateSeedStride = Number(argv[++i]); continue; }
        if (a === '--quality-gate-seed-offset') { args.qualityGateSeedOffset = Number(argv[++i]); continue; }
        if (a === '--quality-gate-threshold') { args.qualityGateThreshold = Number(argv[++i]); continue; }
        if (a === '--quality-gate-confidence-level') { args.qualityGateConfidenceLevel = Number(argv[++i]); continue; }
        if (a === '--quality-gate-min-lower-bound') { args.qualityGateMinLowerBound = Number(argv[++i]); continue; }
        if (a === '--quality-gate-min-seed-uplift') { args.qualityGateMinSeedUplift = Number(argv[++i]); continue; }
        if (a === '--quality-gate-min-seed-pass-count') { args.qualityGateMinSeedPassCount = Number(argv[++i]); continue; }
        if (a === '--quality-gate-strength-first') { args.qualityGateStrengthFirst = true; continue; }
        if (a === '--no-quality-gate-strength-first') { args.qualityGateStrengthFirst = false; continue; }
        if (a === '--quick-adoption-seed-offset') { args.quickAdoptionSeedOffset = Number(argv[++i]); continue; }
        if (a === '--quick-adoption-threshold') { args.quickAdoptionThreshold = Number(argv[++i]); continue; }
        if (a === '--quick-adoption-seed-count') { args.quickAdoptionSeedCount = Number(argv[++i]); continue; }
        if (a === '--quick-adoption-seed-stride') { args.quickAdoptionSeedStride = Number(argv[++i]); continue; }
        if (a === '--quick-adoption-confidence-level') { args.quickAdoptionConfidenceLevel = Number(argv[++i]); continue; }
        if (a === '--quick-adoption-min-lower-bound') { args.quickAdoptionMinLowerBound = Number(argv[++i]); continue; }
        if (a === '--quick-adoption-min-seed-uplift') { args.quickAdoptionMinSeedUplift = Number(argv[++i]); continue; }
        if (a === '--quick-adoption-min-seed-pass-count') { args.quickAdoptionMinSeedPassCount = Number(argv[++i]); continue; }
        if (a === '--final-adoption-threshold') { args.finalAdoptionThreshold = Number(argv[++i]); continue; }
        if (a === '--final-adoption-seed-count') { args.finalAdoptionSeedCount = Number(argv[++i]); continue; }
        if (a === '--final-adoption-seed-stride') { args.finalAdoptionSeedStride = Number(argv[++i]); continue; }
        if (a === '--final-adoption-confidence-level') { args.finalAdoptionConfidenceLevel = Number(argv[++i]); continue; }
        if (a === '--final-adoption-min-lower-bound') { args.finalAdoptionMinLowerBound = Number(argv[++i]); continue; }
        if (a === '--final-adoption-min-seed-uplift') { args.finalAdoptionMinSeedUplift = Number(argv[++i]); continue; }
        if (a === '--final-adoption-min-seed-pass-count') { args.finalAdoptionMinSeedPassCount = Number(argv[++i]); continue; }
        if (a === '--adoption-tactical-weight') { args.adoptionTacticalWeight = Number(argv[++i]); continue; }
        if (a === '--adoption-tactical-depth-opening') { args.adoptionTacticalDepthOpening = Number(argv[++i]); continue; }
        if (a === '--adoption-tactical-depth-mid') { args.adoptionTacticalDepthMid = Number(argv[++i]); continue; }
        if (a === '--adoption-tactical-depth-end') { args.adoptionTacticalDepthEnd = Number(argv[++i]); continue; }
        if (a === '--adoption-tactical-beam-width') { args.adoptionTacticalBeamWidth = Number(argv[++i]); continue; }
        if (a === '--adoption-policy-score-weight') { args.adoptionPolicyScoreWeight = Number(argv[++i]); continue; }
        if (a === '--adoption-heuristic-weight') { args.adoptionHeuristicWeight = Number(argv[++i]); continue; }
        if (a === '--adoption-white-priority') { args.adoptionWhitePriority = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-corner') { args.adoptionQualityWeightCorner = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-edge') { args.adoptionQualityWeightEdge = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-corner-recovery') { args.adoptionQualityWeightCornerRecovery = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-corner-recapture') { args.adoptionQualityWeightCornerRecapture = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-edge-recovery') { args.adoptionQualityWeightEdgeRecovery = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-corner-hold') { args.adoptionQualityWeightCornerHold = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-corner-hold-turns') { args.adoptionQualityWeightCornerHoldTurns = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-edge-hold') { args.adoptionQualityWeightEdgeHold = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-edge-chain') { args.adoptionQualityWeightEdgeChain = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-final-corner-share') { args.adoptionQualityWeightFinalCornerShare = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-final-edge-share') { args.adoptionQualityWeightFinalEdgeShare = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-final-longest-edge-run-share') { args.adoptionQualityWeightFinalLongestEdgeRunShare = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-bonus') { args.adoptionQualityWeightBonus = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-card-immediate') { args.adoptionQualityWeightCardImmediate = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-card-future') { args.adoptionQualityWeightCardFuture = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-place-delta') { args.adoptionQualityWeightPlaceDelta = Number(argv[++i]); continue; }
        if (a === '--adoption-use-guide-baseline') { args.adoptionUseGuideBaseline = true; continue; }
        if (a === '--no-adoption-use-guide-baseline') { args.adoptionUseGuideBaseline = false; continue; }
        if (a === '--adoption-use-anchor-baseline') { args.adoptionUseAnchorBaseline = true; continue; }
        if (a === '--no-adoption-use-anchor-baseline') { args.adoptionUseAnchorBaseline = false; continue; }
        if (a === '--onnx-gate') { args.onnxGateEnabled = true; continue; }
        if (a === '--no-onnx-gate') { args.onnxGateEnabled = false; continue; }
        if (a === '--onnx-gate-games') { args.onnxGateGames = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-seed-count') { args.onnxGateSeedCount = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-seed-stride') { args.onnxGateSeedStride = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-seed-offset') { args.onnxGateSeedOffset = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-threshold') { args.onnxGateThreshold = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-min-seed-score') { args.onnxGateMinSeedScore = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-min-seed-pass-count') { args.onnxGateMinSeedPassCount = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-max-average-latency-ms') { args.onnxGateMaxAverageLatencyMs = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-max-p95-latency-ms') { args.onnxGateMaxP95LatencyMs = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-max-max-latency-ms') { args.onnxGateMaxMaxLatencyMs = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-timeout-ms') { args.onnxGateTimeoutMs = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-black-level') { args.onnxGateBlackLevel = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-white-level') { args.onnxGateWhiteLevel = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-candidate-color-mode') { args.onnxGateCandidateColorMode = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--promotion-mode') { args.promotionMode = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--onnx-primary-max-quick-regression') { args.onnxPrimaryMaxQuickRegression = Number(argv[++i]); continue; }
        if (a === '--onnx-primary-require-quick-regression') { args.onnxPrimaryRequireQuickRegression = true; continue; }
        if (a === '--no-onnx-primary-require-quick-regression') { args.onnxPrimaryRequireQuickRegression = false; continue; }
        if (a === '--onnx-primary-require-quick-non-regression') { args.onnxPrimaryRequireQuickNonRegression = true; continue; }
        if (a === '--no-onnx-primary-require-quick-non-regression') { args.onnxPrimaryRequireQuickNonRegression = false; continue; }
        if (a === '--onnx-primary-min-quick-core-delta') { args.onnxPrimaryMinQuickCoreDelta = Number(argv[++i]); continue; }
        if (a === '--onnx-primary-min-quick-white-delta') { args.onnxPrimaryMinQuickWhiteDelta = Number(argv[++i]); continue; }
        if (a === '--onnx-primary-min-quick-quality-delta') { args.onnxPrimaryMinQuickQualityDelta = Number(argv[++i]); continue; }
        if (a === '--onnx-primary-min-quick-uplift') { args.onnxPrimaryMinQuickUplift = Number(argv[++i]); continue; }
        if (a === '--onnx-primary-min-quick-lower-bound') { args.onnxPrimaryMinQuickLowerBound = Number(argv[++i]); continue; }
        if (a === '--onnx-primary-min-onnx-gate-avg') { args.onnxPrimaryMinOnnxGateAvg = Number(argv[++i]); continue; }
        if (a === '--onnx-primary-min-onnx-gate-min-seed') { args.onnxPrimaryMinOnnxGateMinSeed = Number(argv[++i]); continue; }
        if (a === '--gate-final-iteration-only') { args.gateFinalIterationOnly = true; continue; }
        if (a === '--no-gate-final-iteration-only') { args.gateFinalIterationOnly = false; continue; }
        if (a === '--promote') { args.promoteOnPass = true; continue; }
        if (a === '--no-promote') { args.promoteOnPass = false; continue; }
        if (a === '--selfplay-use-promoted-model-only') {
            args.selfplayUsePromotedModelOnly = true;
            args.selfplayCandidateAdmission = 'promoted-only';
            continue;
        }
        if (a === '--selfplay-use-candidate-every-iteration') {
            args.selfplayUsePromotedModelOnly = false;
            args.selfplayCandidateAdmission = 'always';
            continue;
        }
        if (a === '--selfplay-candidate-admission') {
            args.selfplayCandidateAdmission = normalizeSelfplayCandidateAdmission(argv[++i]);
            args.selfplayUsePromotedModelOnly = args.selfplayCandidateAdmission === 'promoted-only';
            continue;
        }
        if (a === '--bootstrap-policy-model') { args.bootstrapPolicyModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--resume-checkpoint') { args.resumeCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--resume-policy-checkpoint') { args.resumePolicyCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--resume-card-checkpoint') { args.resumeCardCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--resume-target-checkpoint') { args.resumeTargetCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--resume-value-checkpoint') { args.resumeValueCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--carry-over-checkpoint') {
            args.carryOverCheckpoint = true;
            args.carryOverCheckpointMode = 'always';
            continue;
        }
        if (a === '--carry-over-checkpoint-promoted-only') {
            args.carryOverCheckpoint = true;
            args.carryOverCheckpointMode = 'promoted-only';
            continue;
        }
        if (a === '--no-carry-over-checkpoint') {
            args.carryOverCheckpoint = false;
            args.carryOverCheckpointMode = 'always';
            continue;
        }
        if (a === '--seed-bank') { args.seedBankPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--run-tag') { args.runTag = String(argv[++i] || '').trim(); continue; }
        if (a === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--summary-out') { args.summaryOut = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--reuse-existing-artifacts') { args.reuseExistingArtifacts = true; continue; }
        if (a === '--restart-from-step') { args.restartFromStep = String(argv[++i] || '').trim(); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.help) return args;

    if (!Number.isFinite(args.iterations) || args.iterations < 1) throw new Error('--iterations must be >= 1');
    if (!Number.isFinite(args.maxHours) || args.maxHours < 0) throw new Error('--max-hours must be >= 0');
    if (!Number.isFinite(args.trainGames) || args.trainGames < 1) throw new Error('--train-games must be >= 1');
    if (!Number.isFinite(args.evalGames) || args.evalGames < 1) throw new Error('--eval-games must be >= 1');
    if (!Number.isFinite(args.selfplayJobs) || args.selfplayJobs < 1) throw new Error('--selfplay-jobs must be >= 1');
    args.selfplayJobs = Math.floor(args.selfplayJobs);
    if (!Number.isFinite(args.selfplayResumeChunkSize) || args.selfplayResumeChunkSize < 0) {
        throw new Error('--selfplay-resume-chunk-size must be >= 0');
    }
    args.selfplayResumeChunkSize = Math.floor(args.selfplayResumeChunkSize);
    if (!Number.isFinite(args.adoptionJobs) || args.adoptionJobs < 1) throw new Error('--adoption-jobs must be >= 1');
    args.adoptionJobs = Math.floor(args.adoptionJobs);
    if (!Number.isFinite(args.onnxGateJobs) || args.onnxGateJobs < 1) throw new Error('--onnx-gate-jobs must be >= 1');
    args.onnxGateJobs = Math.floor(args.onnxGateJobs);
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    if (!Number.isFinite(args.evalSeedOffset) || args.evalSeedOffset < 1) throw new Error('--eval-seed-offset must be >= 1');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.cardUsageRate) || args.cardUsageRate < 0 || args.cardUsageRate > 1) {
        throw new Error('--card-usage-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.selfplayPolicyMixRate) || args.selfplayPolicyMixRate < 0 || args.selfplayPolicyMixRate > 1) {
        throw new Error('--selfplay-policy-mix-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.selfplayPolicyModelPoolSize) || args.selfplayPolicyModelPoolSize < 1) {
        throw new Error('--selfplay-policy-model-pool-size must be >= 1');
    }
    args.selfplayPolicyModelPoolSize = Math.floor(args.selfplayPolicyModelPoolSize);
    if (args.selfplayPolicyPoolSampling !== 'uniform' && args.selfplayPolicyPoolSampling !== 'recency') {
        throw new Error('--selfplay-policy-pool-sampling must be uniform or recency');
    }
    if (!Number.isFinite(args.selfplayPolicyPoolRecencyDecay) || args.selfplayPolicyPoolRecencyDecay <= 0) {
        throw new Error('--selfplay-policy-pool-recency-decay must be > 0');
    }
    if (!Number.isFinite(args.selfplayPolicyCurrentAnchorRate) || args.selfplayPolicyCurrentAnchorRate < 0 || args.selfplayPolicyCurrentAnchorRate > 1) {
        throw new Error('--selfplay-policy-current-anchor-rate must be in [0,1]');
    }
    args.selfplayCandidateAdmission = normalizeSelfplayCandidateAdmission(args.selfplayCandidateAdmission);
    args.selfplayUsePromotedModelOnly = args.selfplayCandidateAdmission === 'promoted-only';
    if (!Number.isFinite(args.selfplayCardUsageRateJitter) || args.selfplayCardUsageRateJitter < 0 || args.selfplayCardUsageRateJitter > 1) {
        throw new Error('--selfplay-card-usage-rate-jitter must be in [0,1]');
    }
    args.selfplayCardUsageRateSchedule = parseSelfplayCardUsageRateScheduleSpec(
        args.selfplayCardUsageRateScheduleSpec,
        '--selfplay-card-usage-rate-schedule'
    );
    if (!Number.isFinite(args.selfplayTacticalWeightMin) || args.selfplayTacticalWeightMin < 0) {
        throw new Error('--selfplay-tactical-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.selfplayTacticalWeightMax) || args.selfplayTacticalWeightMax < 0) {
        throw new Error('--selfplay-tactical-weight-max must be >= 0');
    }
    if (args.selfplayTacticalWeightMax < args.selfplayTacticalWeightMin) {
        throw new Error('--selfplay-tactical-weight-max must be >= --selfplay-tactical-weight-min');
    }
    if (!Number.isFinite(args.selfplayTacticalDepthOpening) || args.selfplayTacticalDepthOpening < 0) {
        throw new Error('--selfplay-tactical-depth-opening must be >= 0');
    }
    if (!Number.isFinite(args.selfplayTacticalDepthMid) || args.selfplayTacticalDepthMid < 0) {
        throw new Error('--selfplay-tactical-depth-mid must be >= 0');
    }
    if (!Number.isFinite(args.selfplayTacticalDepthEnd) || args.selfplayTacticalDepthEnd < 0) {
        throw new Error('--selfplay-tactical-depth-end must be >= 0');
    }
    if (!Number.isFinite(args.selfplayTacticalBeamWidth) || args.selfplayTacticalBeamWidth < 0) {
        throw new Error('--selfplay-tactical-beam-width must be >= 0');
    }
    if (!Number.isFinite(args.selfplayTeacherCommitteeWeightMin) || args.selfplayTeacherCommitteeWeightMin < 0) {
        throw new Error('--selfplay-teacher-committee-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.selfplayTeacherCommitteeWeightMax) || args.selfplayTeacherCommitteeWeightMax < 0) {
        throw new Error('--selfplay-teacher-committee-weight-max must be >= 0');
    }
    if (args.selfplayTeacherCommitteeWeightMax < args.selfplayTeacherCommitteeWeightMin) {
        throw new Error('--selfplay-teacher-committee-weight-max must be >= --selfplay-teacher-committee-weight-min');
    }
    if (!Number.isFinite(args.selfplayTeacherCommitteeConsensusBonusMin) || args.selfplayTeacherCommitteeConsensusBonusMin < 0) {
        throw new Error('--selfplay-teacher-committee-consensus-bonus-min must be >= 0');
    }
    if (!Number.isFinite(args.selfplayTeacherCommitteeConsensusBonusMax) || args.selfplayTeacherCommitteeConsensusBonusMax < 0) {
        throw new Error('--selfplay-teacher-committee-consensus-bonus-max must be >= 0');
    }
    if (args.selfplayTeacherCommitteeConsensusBonusMax < args.selfplayTeacherCommitteeConsensusBonusMin) {
        throw new Error('--selfplay-teacher-committee-consensus-bonus-max must be >= --selfplay-teacher-committee-consensus-bonus-min');
    }
    if (!Number.isFinite(args.selfplayPolicyScoreWeightMin) || args.selfplayPolicyScoreWeightMin < 0) {
        throw new Error('--selfplay-policy-score-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.selfplayPolicyScoreWeightMax) || args.selfplayPolicyScoreWeightMax < 0) {
        throw new Error('--selfplay-policy-score-weight-max must be >= 0');
    }
    if (args.selfplayPolicyScoreWeightMax < args.selfplayPolicyScoreWeightMin) {
        throw new Error('--selfplay-policy-score-weight-max must be >= --selfplay-policy-score-weight-min');
    }
    if (!Number.isFinite(args.selfplayHeuristicWeightMin) || args.selfplayHeuristicWeightMin < 0) {
        throw new Error('--selfplay-heuristic-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.selfplayHeuristicWeightMax) || args.selfplayHeuristicWeightMax < 0) {
        throw new Error('--selfplay-heuristic-weight-max must be >= 0');
    }
    if (args.selfplayHeuristicWeightMax < args.selfplayHeuristicWeightMin) {
        throw new Error('--selfplay-heuristic-weight-max must be >= --selfplay-heuristic-weight-min');
    }
    args.selfplayTacticalDepthOpening = Math.floor(args.selfplayTacticalDepthOpening);
    args.selfplayTacticalDepthMid = Math.floor(args.selfplayTacticalDepthMid);
    args.selfplayTacticalDepthEnd = Math.floor(args.selfplayTacticalDepthEnd);
    args.selfplayTacticalBeamWidth = Math.floor(args.selfplayTacticalBeamWidth);
    if (!Number.isFinite(args.onnxEpochs) || args.onnxEpochs < 1) throw new Error('--onnx-epochs must be >= 1');
    if (!Number.isFinite(args.onnxBatchSize) || args.onnxBatchSize < 1) throw new Error('--onnx-batch-size must be >= 1');
    if (!Number.isFinite(args.onnxLr) || args.onnxLr <= 0) throw new Error('--onnx-lr must be > 0');
    if (args.onnxValueLr !== null && (!Number.isFinite(args.onnxValueLr) || args.onnxValueLr <= 0)) {
        throw new Error('--onnx-value-lr must be > 0');
    }
    if (!Number.isFinite(args.onnxHiddenSize) || args.onnxHiddenSize < 8) throw new Error('--onnx-hidden-size must be >= 8');
    if (args.onnxValueHiddenSize !== null && (!Number.isFinite(args.onnxValueHiddenSize) || args.onnxValueHiddenSize < 8)) {
        throw new Error('--onnx-value-hidden-size must be >= 8');
    }
    if (args.onnxDevice !== 'auto' && args.onnxDevice !== 'cpu' && args.onnxDevice !== 'cuda') {
        throw new Error('--onnx-device must be one of auto/cpu/cuda');
    }
    if (!Number.isFinite(args.onnxLogIntervalSteps) || args.onnxLogIntervalSteps < 0) {
        throw new Error('--onnx-log-interval-steps must be >= 0');
    }
    if (!Number.isFinite(args.onnxValSplit) || args.onnxValSplit < 0 || args.onnxValSplit >= 0.5) {
        throw new Error('--onnx-val-split must be in [0,0.5)');
    }
    if (args.onnxValSplitMode !== 'random' && args.onnxValSplitMode !== 'grouped-game') {
        throw new Error('--onnx-val-split-mode must be random or grouped-game');
    }
    if (!Number.isFinite(args.onnxEarlyStopPatience) || args.onnxEarlyStopPatience < 0) {
        throw new Error('--onnx-early-stop-patience must be >= 0');
    }
    if (!Number.isFinite(args.onnxEarlyStopMinDelta) || args.onnxEarlyStopMinDelta < 0) {
        throw new Error('--onnx-early-stop-min-delta must be >= 0');
    }
    if (!Number.isFinite(args.onnxEarlyStopMinEpochs) || args.onnxEarlyStopMinEpochs < 0) {
        throw new Error('--onnx-early-stop-min-epochs must be >= 0');
    }
    args.onnxEarlyStopMinEpochs = Math.floor(args.onnxEarlyStopMinEpochs);
    if (!Number.isFinite(args.onnxEarlyStopSmoothingWindow) || args.onnxEarlyStopSmoothingWindow < 1) {
        throw new Error('--onnx-early-stop-smoothing-window must be >= 1');
    }
    args.onnxEarlyStopSmoothingWindow = Math.floor(args.onnxEarlyStopSmoothingWindow);
    if (!Number.isFinite(args.onnxLrPlateauPatience) || args.onnxLrPlateauPatience < 0) {
        throw new Error('--onnx-lr-plateau-patience must be >= 0');
    }
    args.onnxLrPlateauPatience = Math.floor(args.onnxLrPlateauPatience);
    if (args.onnxLrPlateauPatience > 0) {
        if (!Number.isFinite(args.onnxLrPlateauFactor) || args.onnxLrPlateauFactor <= 0 || args.onnxLrPlateauFactor >= 1) {
            throw new Error('--onnx-lr-plateau-factor must be in (0,1) when plateau scheduling is enabled');
        }
        if (!Number.isFinite(args.onnxLrPlateauMinLr) || args.onnxLrPlateauMinLr <= 0) {
            throw new Error('--onnx-lr-plateau-min-lr must be > 0 when plateau scheduling is enabled');
        }
    }
    if (
        args.onnxEarlyStopMonitor !== 'val_loss' &&
        args.onnxEarlyStopMonitor !== 'train_loss' &&
        args.onnxEarlyStopMonitor !== 'val_place_loss' &&
        args.onnxEarlyStopMonitor !== 'train_place_loss'
    ) {
        throw new Error('--onnx-early-stop-monitor must be val_loss/train_loss/val_place_loss/train_place_loss');
    }
    if (!Number.isFinite(args.onnxCardNoActionWeight) || args.onnxCardNoActionWeight <= 0) {
        throw new Error('--onnx-card-no-action-weight must be > 0');
    }
    if (!Number.isFinite(args.onnxCardClassBalancePower) || args.onnxCardClassBalancePower < 0 || args.onnxCardClassBalancePower > 1) {
        throw new Error('--onnx-card-class-balance-power must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxWinnerSampleBoost) || args.onnxWinnerSampleBoost < 0) {
        throw new Error('--onnx-winner-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxLoserSampleWeight) || args.onnxLoserSampleWeight <= 0) {
        throw new Error('--onnx-loser-sample-weight must be > 0');
    }
    if (!Number.isFinite(args.onnxDrawSampleWeight) || args.onnxDrawSampleWeight <= 0) {
        throw new Error('--onnx-draw-sample-weight must be > 0');
    }
    if (!Number.isFinite(args.onnxCornerEmergencySampleBoost) || args.onnxCornerEmergencySampleBoost < 0) {
        throw new Error('--onnx-corner-emergency-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxNegativeFutureDiscSampleBoost) || args.onnxNegativeFutureDiscSampleBoost < 0) {
        throw new Error('--onnx-negative-future-disc-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxNegativeFutureDiscThreshold)) {
        throw new Error('--onnx-negative-future-disc-threshold must be a number');
    }
    if (!Number.isFinite(args.onnxTacticalMissSampleBoost) || args.onnxTacticalMissSampleBoost < 0) {
        throw new Error('--onnx-tactical-miss-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxTacticalMissThreshold) || args.onnxTacticalMissThreshold < 0) {
        throw new Error('--onnx-tactical-miss-threshold must be >= 0');
    }
    if (!Number.isFinite(args.onnxHandPressureSampleBoost) || args.onnxHandPressureSampleBoost < 0) {
        throw new Error('--onnx-hand-pressure-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxPendingTargetSampleBoost) || args.onnxPendingTargetSampleBoost < 0) {
        throw new Error('--onnx-pending-target-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxCornerBalanceSampleBoost) || args.onnxCornerBalanceSampleBoost < 0) {
        throw new Error('--onnx-corner-balance-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxEdgeBalanceSampleBoost) || args.onnxEdgeBalanceSampleBoost < 0) {
        throw new Error('--onnx-edge-balance-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxEconomyBalanceSampleBoost) || args.onnxEconomyBalanceSampleBoost < 0) {
        throw new Error('--onnx-economy-balance-sample-boost must be >= 0');
    }
    if (!Number.isFinite(args.onnxValueTargetCornerWeight) || args.onnxValueTargetCornerWeight < 0 || args.onnxValueTargetCornerWeight > 1) {
        throw new Error('--onnx-value-target-corner-weight must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxValueTargetEdgeWeight) || args.onnxValueTargetEdgeWeight < 0 || args.onnxValueTargetEdgeWeight > 1) {
        throw new Error('--onnx-value-target-edge-weight must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxValueTargetEconomyWeight) || args.onnxValueTargetEconomyWeight < 0 || args.onnxValueTargetEconomyWeight > 1) {
        throw new Error('--onnx-value-target-economy-weight must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxValueTargetCornerEmergencyWeight) || args.onnxValueTargetCornerEmergencyWeight < 0 || args.onnxValueTargetCornerEmergencyWeight > 1) {
        throw new Error('--onnx-value-target-corner-emergency-weight must be in [0,1]');
    }
    if (
        args.onnxValueTargetCornerWeight +
        args.onnxValueTargetEdgeWeight +
        args.onnxValueTargetEconomyWeight +
        args.onnxValueTargetCornerEmergencyWeight > 0.5
    ) {
        throw new Error('onnx value-target auxiliary weights must sum to <= 0.5');
    }
    if (!Number.isFinite(args.trainCardEvery) || args.trainCardEvery < 1) throw new Error('--train-card-every must be >= 1');
    args.trainCardEvery = Math.floor(args.trainCardEvery);
    if (!Number.isFinite(args.trainTargetEvery) || args.trainTargetEvery < 1) throw new Error('--train-target-every must be >= 1');
    args.trainTargetEvery = Math.floor(args.trainTargetEvery);
    if (!Number.isFinite(args.trainValueEvery) || args.trainValueEvery < 1) throw new Error('--train-value-every must be >= 1');
    args.trainValueEvery = Math.floor(args.trainValueEvery);
    if (!Number.isFinite(args.minVisits) || args.minVisits < 1) throw new Error('--min-visits must be >= 1');
    if (!Number.isFinite(args.shapeImmediate) || args.shapeImmediate < 0 || args.shapeImmediate > 1) {
        throw new Error('--shape-immediate must be in [0,1]');
    }
    if (!Number.isFinite(args.quickGames) || args.quickGames < 1) throw new Error('--quick-games must be >= 1');
    if (!Number.isFinite(args.finalGames) || args.finalGames < 1) throw new Error('--final-games must be >= 1');
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) {
        throw new Error('--threshold must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionSeedCount) || args.adoptionSeedCount < 1) {
        throw new Error('--adoption-seed-count must be >= 1');
    }
    if (!Number.isFinite(args.adoptionSeedStride) || args.adoptionSeedStride < 1) {
        throw new Error('--adoption-seed-stride must be >= 1');
    }
    if (!Number.isFinite(args.adoptionFinalSeedOffset) || args.adoptionFinalSeedOffset < 1) {
        throw new Error('--adoption-final-seed-offset must be >= 1');
    }
    if (!Number.isFinite(args.adoptionConfidenceLevel) || args.adoptionConfidenceLevel < 0.5 || args.adoptionConfidenceLevel >= 1) {
        throw new Error('--adoption-confidence-level must be in [0.5,1)');
    }
    if (!Number.isFinite(args.adoptionMinLowerBound) || args.adoptionMinLowerBound < -1 || args.adoptionMinLowerBound > 1) {
        throw new Error('--adoption-min-lower-bound must be in [-1,1]');
    }
    if (!Number.isFinite(args.adoptionMinSeedUplift) || args.adoptionMinSeedUplift < -1 || args.adoptionMinSeedUplift > 1) {
        throw new Error('--adoption-min-seed-uplift must be in [-1,1]');
    }
    if (!Number.isFinite(args.adoptionMinSeedPassCount) || args.adoptionMinSeedPassCount < 0) {
        throw new Error('--adoption-min-seed-pass-count must be >= 0');
    }
    args.adoptionMinSeedPassCount = Math.floor(args.adoptionMinSeedPassCount);
    if (args.adoptionMinSeedPassCount > args.adoptionSeedCount) {
        throw new Error('--adoption-min-seed-pass-count must be <= --adoption-seed-count');
    }
    if (!Number.isFinite(args.qualityGateGames) || args.qualityGateGames < 1) {
        throw new Error('--quality-gate-games must be >= 1');
    }
    if (!Number.isFinite(args.qualityGateSeedCount) || args.qualityGateSeedCount < 1) {
        throw new Error('--quality-gate-seed-count must be >= 1');
    }
    args.qualityGateSeedCount = Math.floor(args.qualityGateSeedCount);
    if (!Number.isFinite(args.qualityGateSeedStride) || args.qualityGateSeedStride < 1) {
        throw new Error('--quality-gate-seed-stride must be >= 1');
    }
    args.qualityGateSeedStride = Math.floor(args.qualityGateSeedStride);
    if (!Number.isFinite(args.qualityGateSeedOffset) || args.qualityGateSeedOffset < 1) {
        throw new Error('--quality-gate-seed-offset must be >= 1');
    }
    if (!Number.isFinite(args.qualityGateThreshold) || args.qualityGateThreshold < -1 || args.qualityGateThreshold > 1) {
        throw new Error('--quality-gate-threshold must be in [-1,1]');
    }
    if (!Number.isFinite(args.qualityGateConfidenceLevel) || args.qualityGateConfidenceLevel < 0.5 || args.qualityGateConfidenceLevel >= 1) {
        throw new Error('--quality-gate-confidence-level must be in [0.5,1)');
    }
    if (!Number.isFinite(args.qualityGateMinLowerBound) || args.qualityGateMinLowerBound < -1 || args.qualityGateMinLowerBound > 1) {
        throw new Error('--quality-gate-min-lower-bound must be in [-1,1]');
    }
    if (!Number.isFinite(args.qualityGateMinSeedUplift) || args.qualityGateMinSeedUplift < -1 || args.qualityGateMinSeedUplift > 1) {
        throw new Error('--quality-gate-min-seed-uplift must be in [-1,1]');
    }
    if (!Number.isFinite(args.qualityGateMinSeedPassCount) || args.qualityGateMinSeedPassCount < 0) {
        throw new Error('--quality-gate-min-seed-pass-count must be >= 0');
    }
    args.qualityGateMinSeedPassCount = Math.floor(args.qualityGateMinSeedPassCount);
    if (args.qualityGateMinSeedPassCount > args.qualityGateSeedCount) {
        throw new Error('--quality-gate-min-seed-pass-count must be <= --quality-gate-seed-count');
    }
    if (args.quickAdoptionThreshold !== null && (!Number.isFinite(args.quickAdoptionThreshold) || args.quickAdoptionThreshold < 0 || args.quickAdoptionThreshold > 1)) {
        throw new Error('--quick-adoption-threshold must be in [0,1]');
    }
    if (args.quickAdoptionSeedCount !== null && (!Number.isFinite(args.quickAdoptionSeedCount) || args.quickAdoptionSeedCount < 1)) {
        throw new Error('--quick-adoption-seed-count must be >= 1');
    }
    if (args.quickAdoptionSeedCount !== null) args.quickAdoptionSeedCount = Math.floor(args.quickAdoptionSeedCount);
    if (args.quickAdoptionSeedStride !== null && (!Number.isFinite(args.quickAdoptionSeedStride) || args.quickAdoptionSeedStride < 1)) {
        throw new Error('--quick-adoption-seed-stride must be >= 1');
    }
    if (args.quickAdoptionSeedStride !== null) args.quickAdoptionSeedStride = Math.floor(args.quickAdoptionSeedStride);
    if (!Number.isFinite(args.quickAdoptionSeedOffset) || args.quickAdoptionSeedOffset < 0) {
        throw new Error('--quick-adoption-seed-offset must be >= 0');
    }
    args.quickAdoptionSeedOffset = Math.floor(args.quickAdoptionSeedOffset);
    if (args.quickAdoptionConfidenceLevel !== null && (!Number.isFinite(args.quickAdoptionConfidenceLevel) || args.quickAdoptionConfidenceLevel < 0.5 || args.quickAdoptionConfidenceLevel >= 1)) {
        throw new Error('--quick-adoption-confidence-level must be in [0.5,1)');
    }
    if (args.quickAdoptionMinLowerBound !== null && (!Number.isFinite(args.quickAdoptionMinLowerBound) || args.quickAdoptionMinLowerBound < -1 || args.quickAdoptionMinLowerBound > 1)) {
        throw new Error('--quick-adoption-min-lower-bound must be in [-1,1]');
    }
    if (args.quickAdoptionMinSeedUplift !== null && (!Number.isFinite(args.quickAdoptionMinSeedUplift) || args.quickAdoptionMinSeedUplift < -1 || args.quickAdoptionMinSeedUplift > 1)) {
        throw new Error('--quick-adoption-min-seed-uplift must be in [-1,1]');
    }
    if (args.quickAdoptionMinSeedPassCount !== null && (!Number.isFinite(args.quickAdoptionMinSeedPassCount) || args.quickAdoptionMinSeedPassCount < 0)) {
        throw new Error('--quick-adoption-min-seed-pass-count must be >= 0');
    }
    if (args.quickAdoptionMinSeedPassCount !== null) args.quickAdoptionMinSeedPassCount = Math.floor(args.quickAdoptionMinSeedPassCount);
    const quickSeedCountForValidation = args.quickAdoptionSeedCount !== null ? args.quickAdoptionSeedCount : args.adoptionSeedCount;
    if (args.quickAdoptionMinSeedPassCount !== null && args.quickAdoptionMinSeedPassCount > quickSeedCountForValidation) {
        throw new Error('--quick-adoption-min-seed-pass-count must be <= quick adoption seed count');
    }
    if (args.finalAdoptionThreshold !== null && (!Number.isFinite(args.finalAdoptionThreshold) || args.finalAdoptionThreshold < 0 || args.finalAdoptionThreshold > 1)) {
        throw new Error('--final-adoption-threshold must be in [0,1]');
    }
    if (args.finalAdoptionSeedCount !== null && (!Number.isFinite(args.finalAdoptionSeedCount) || args.finalAdoptionSeedCount < 1)) {
        throw new Error('--final-adoption-seed-count must be >= 1');
    }
    if (args.finalAdoptionSeedCount !== null) args.finalAdoptionSeedCount = Math.floor(args.finalAdoptionSeedCount);
    if (args.finalAdoptionSeedStride !== null && (!Number.isFinite(args.finalAdoptionSeedStride) || args.finalAdoptionSeedStride < 1)) {
        throw new Error('--final-adoption-seed-stride must be >= 1');
    }
    if (args.finalAdoptionSeedStride !== null) args.finalAdoptionSeedStride = Math.floor(args.finalAdoptionSeedStride);
    if (args.finalAdoptionConfidenceLevel !== null && (!Number.isFinite(args.finalAdoptionConfidenceLevel) || args.finalAdoptionConfidenceLevel < 0.5 || args.finalAdoptionConfidenceLevel >= 1)) {
        throw new Error('--final-adoption-confidence-level must be in [0.5,1)');
    }
    if (args.finalAdoptionMinLowerBound !== null && (!Number.isFinite(args.finalAdoptionMinLowerBound) || args.finalAdoptionMinLowerBound < -1 || args.finalAdoptionMinLowerBound > 1)) {
        throw new Error('--final-adoption-min-lower-bound must be in [-1,1]');
    }
    if (args.finalAdoptionMinSeedUplift !== null && (!Number.isFinite(args.finalAdoptionMinSeedUplift) || args.finalAdoptionMinSeedUplift < -1 || args.finalAdoptionMinSeedUplift > 1)) {
        throw new Error('--final-adoption-min-seed-uplift must be in [-1,1]');
    }
    if (args.finalAdoptionMinSeedPassCount !== null && (!Number.isFinite(args.finalAdoptionMinSeedPassCount) || args.finalAdoptionMinSeedPassCount < 0)) {
        throw new Error('--final-adoption-min-seed-pass-count must be >= 0');
    }
    if (args.finalAdoptionMinSeedPassCount !== null) args.finalAdoptionMinSeedPassCount = Math.floor(args.finalAdoptionMinSeedPassCount);
    const finalSeedCountForValidation = args.finalAdoptionSeedCount !== null ? args.finalAdoptionSeedCount : args.adoptionSeedCount;
    if (args.finalAdoptionMinSeedPassCount !== null && args.finalAdoptionMinSeedPassCount > finalSeedCountForValidation) {
        throw new Error('--final-adoption-min-seed-pass-count must be <= final adoption seed count');
    }
    if (!Number.isFinite(args.adoptionTacticalWeight) || args.adoptionTacticalWeight < 0) {
        throw new Error('--adoption-tactical-weight must be >= 0');
    }
    if (!Number.isFinite(args.adoptionTacticalDepthOpening) || args.adoptionTacticalDepthOpening < 0) {
        throw new Error('--adoption-tactical-depth-opening must be >= 0');
    }
    if (!Number.isFinite(args.adoptionTacticalDepthMid) || args.adoptionTacticalDepthMid < 0) {
        throw new Error('--adoption-tactical-depth-mid must be >= 0');
    }
    if (!Number.isFinite(args.adoptionTacticalDepthEnd) || args.adoptionTacticalDepthEnd < 0) {
        throw new Error('--adoption-tactical-depth-end must be >= 0');
    }
    if (!Number.isFinite(args.adoptionTacticalBeamWidth) || args.adoptionTacticalBeamWidth < 0) {
        throw new Error('--adoption-tactical-beam-width must be >= 0');
    }
    args.adoptionTacticalDepthOpening = Math.floor(args.adoptionTacticalDepthOpening);
    args.adoptionTacticalDepthMid = Math.floor(args.adoptionTacticalDepthMid);
    args.adoptionTacticalDepthEnd = Math.floor(args.adoptionTacticalDepthEnd);
    args.adoptionTacticalBeamWidth = Math.floor(args.adoptionTacticalBeamWidth);
    if (!Number.isFinite(args.adoptionPolicyScoreWeight) || args.adoptionPolicyScoreWeight < 0) {
        throw new Error('--adoption-policy-score-weight must be >= 0');
    }
    if (!Number.isFinite(args.adoptionHeuristicWeight) || args.adoptionHeuristicWeight < 0) {
        throw new Error('--adoption-heuristic-weight must be >= 0');
    }
    if (!Number.isFinite(args.adoptionWhitePriority) || args.adoptionWhitePriority < 0 || args.adoptionWhitePriority > 1) {
        throw new Error('--adoption-white-priority must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightCorner) || args.adoptionQualityWeightCorner < 0 || args.adoptionQualityWeightCorner > 1) {
        throw new Error('--adoption-quality-weight-corner must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightEdge) || args.adoptionQualityWeightEdge < 0 || args.adoptionQualityWeightEdge > 1) {
        throw new Error('--adoption-quality-weight-edge must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightCornerRecovery) || args.adoptionQualityWeightCornerRecovery < 0 || args.adoptionQualityWeightCornerRecovery > 1) {
        throw new Error('--adoption-quality-weight-corner-recovery must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightCornerRecapture) || args.adoptionQualityWeightCornerRecapture < 0 || args.adoptionQualityWeightCornerRecapture > 1) {
        throw new Error('--adoption-quality-weight-corner-recapture must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightEdgeRecovery) || args.adoptionQualityWeightEdgeRecovery < 0 || args.adoptionQualityWeightEdgeRecovery > 1) {
        throw new Error('--adoption-quality-weight-edge-recovery must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightCornerHold) || args.adoptionQualityWeightCornerHold < 0 || args.adoptionQualityWeightCornerHold > 1) {
        throw new Error('--adoption-quality-weight-corner-hold must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightCornerHoldTurns) || args.adoptionQualityWeightCornerHoldTurns < 0 || args.adoptionQualityWeightCornerHoldTurns > 1) {
        throw new Error('--adoption-quality-weight-corner-hold-turns must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightEdgeHold) || args.adoptionQualityWeightEdgeHold < 0 || args.adoptionQualityWeightEdgeHold > 1) {
        throw new Error('--adoption-quality-weight-edge-hold must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightEdgeChain) || args.adoptionQualityWeightEdgeChain < 0 || args.adoptionQualityWeightEdgeChain > 1) {
        throw new Error('--adoption-quality-weight-edge-chain must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightFinalCornerShare) || args.adoptionQualityWeightFinalCornerShare < 0 || args.adoptionQualityWeightFinalCornerShare > 1) {
        throw new Error('--adoption-quality-weight-final-corner-share must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightFinalEdgeShare) || args.adoptionQualityWeightFinalEdgeShare < 0 || args.adoptionQualityWeightFinalEdgeShare > 1) {
        throw new Error('--adoption-quality-weight-final-edge-share must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightFinalLongestEdgeRunShare) || args.adoptionQualityWeightFinalLongestEdgeRunShare < 0 || args.adoptionQualityWeightFinalLongestEdgeRunShare > 1) {
        throw new Error('--adoption-quality-weight-final-longest-edge-run-share must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightBonus) || args.adoptionQualityWeightBonus < 0 || args.adoptionQualityWeightBonus > 1) {
        throw new Error('--adoption-quality-weight-bonus must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightCardImmediate) || args.adoptionQualityWeightCardImmediate < 0 || args.adoptionQualityWeightCardImmediate > 1) {
        throw new Error('--adoption-quality-weight-card-immediate must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightCardFuture) || args.adoptionQualityWeightCardFuture < 0 || args.adoptionQualityWeightCardFuture > 1) {
        throw new Error('--adoption-quality-weight-card-future must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightPlaceDelta) || args.adoptionQualityWeightPlaceDelta < 0 || args.adoptionQualityWeightPlaceDelta > 1) {
        throw new Error('--adoption-quality-weight-place-delta must be in [0,1]');
    }
    if (args.adoptionUseGuideBaseline && args.adoptionUseAnchorBaseline) {
        throw new Error('--adoption-use-guide-baseline and --adoption-use-anchor-baseline cannot be combined');
    }
    if (!Number.isFinite(args.onnxGateGames) || args.onnxGateGames < 1) {
        throw new Error('--onnx-gate-games must be >= 1');
    }
    if (!Number.isFinite(args.onnxGateSeedCount) || args.onnxGateSeedCount < 1) {
        throw new Error('--onnx-gate-seed-count must be >= 1');
    }
    if (!Number.isFinite(args.onnxGateSeedStride) || args.onnxGateSeedStride < 1) {
        throw new Error('--onnx-gate-seed-stride must be >= 1');
    }
    if (!Number.isFinite(args.onnxGateSeedOffset) || args.onnxGateSeedOffset < 1) {
        throw new Error('--onnx-gate-seed-offset must be >= 1');
    }
    if (!Number.isFinite(args.onnxGateThreshold) || args.onnxGateThreshold < 0 || args.onnxGateThreshold > 1) {
        throw new Error('--onnx-gate-threshold must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxGateMinSeedScore) || args.onnxGateMinSeedScore < 0 || args.onnxGateMinSeedScore > 1) {
        throw new Error('--onnx-gate-min-seed-score must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxGateMinSeedPassCount) || args.onnxGateMinSeedPassCount < 0) {
        throw new Error('--onnx-gate-min-seed-pass-count must be >= 0');
    }
    args.onnxGateMinSeedPassCount = Math.floor(args.onnxGateMinSeedPassCount);
    if (args.onnxGateMinSeedPassCount > args.onnxGateSeedCount) {
        throw new Error('--onnx-gate-min-seed-pass-count must be <= --onnx-gate-seed-count');
    }
    if (!Number.isFinite(args.onnxGateMaxAverageLatencyMs) || args.onnxGateMaxAverageLatencyMs < 0) {
        throw new Error('--onnx-gate-max-average-latency-ms must be >= 0');
    }
    if (!Number.isFinite(args.onnxGateMaxP95LatencyMs) || args.onnxGateMaxP95LatencyMs < 0) {
        throw new Error('--onnx-gate-max-p95-latency-ms must be >= 0');
    }
    if (!Number.isFinite(args.onnxGateMaxMaxLatencyMs) || args.onnxGateMaxMaxLatencyMs < 0) {
        throw new Error('--onnx-gate-max-max-latency-ms must be >= 0');
    }
    if (!Number.isFinite(args.onnxGateTimeoutMs) || args.onnxGateTimeoutMs < 1000) {
        throw new Error('--onnx-gate-timeout-ms must be >= 1000');
    }
    if (!Number.isFinite(args.onnxGateBlackLevel) || args.onnxGateBlackLevel < 1 || args.onnxGateBlackLevel > 6) {
        throw new Error('--onnx-gate-black-level must be in [1,6]');
    }
    if (!Number.isFinite(args.onnxGateWhiteLevel) || args.onnxGateWhiteLevel < 1 || args.onnxGateWhiteLevel > 6) {
        throw new Error('--onnx-gate-white-level must be in [1,6]');
    }
    if (args.onnxGateCandidateColorMode !== 'both' && args.onnxGateCandidateColorMode !== 'white') {
        throw new Error('--onnx-gate-candidate-color-mode must be one of: both, white');
    }
    if (args.promotionMode !== 'strict' && args.promotionMode !== 'onnx-primary' && args.promotionMode !== 'quick-only') {
        throw new Error('--promotion-mode must be strict, onnx-primary, or quick-only');
    }
    // Warn when permissive gate configuration may allow weak models through
    if (args.promotionMode === 'quick-only' && !args.qualityGateEnabled) {
        console.warn(
            '[training-cycle] WARNING: --promotion-mode quick-only with --no-quality-gate ' +
            'allows promotion with only a quick gate pass. This may promote weaker models. ' +
            'Consider using --promotion-mode strict for production runs.'
        );
    }
    if (args.quickSeedCount < 3) {
        console.warn(
            `[training-cycle] WARNING: quick seed count is ${args.quickSeedCount}. ` +
            'With fewer than 3 seeds, confidence intervals are unreliable. ' +
            'Consider using at least 3 seeds (5+ recommended).'
        );
    }
    if (!Number.isFinite(args.onnxPrimaryMaxQuickRegression) || args.onnxPrimaryMaxQuickRegression < 0 || args.onnxPrimaryMaxQuickRegression > 1) {
        throw new Error('--onnx-primary-max-quick-regression must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxPrimaryMinQuickCoreDelta) || args.onnxPrimaryMinQuickCoreDelta < -1 || args.onnxPrimaryMinQuickCoreDelta > 1) {
        throw new Error('--onnx-primary-min-quick-core-delta must be in [-1,1]');
    }
    if (!Number.isFinite(args.onnxPrimaryMinQuickWhiteDelta) || args.onnxPrimaryMinQuickWhiteDelta < -1 || args.onnxPrimaryMinQuickWhiteDelta > 1) {
        throw new Error('--onnx-primary-min-quick-white-delta must be in [-1,1]');
    }
    if (!Number.isFinite(args.onnxPrimaryMinQuickQualityDelta) || args.onnxPrimaryMinQuickQualityDelta < -1 || args.onnxPrimaryMinQuickQualityDelta > 1) {
        throw new Error('--onnx-primary-min-quick-quality-delta must be in [-1,1]');
    }
    if (!Number.isFinite(args.onnxPrimaryMinQuickUplift) || args.onnxPrimaryMinQuickUplift < -1 || args.onnxPrimaryMinQuickUplift > 1) {
        throw new Error('--onnx-primary-min-quick-uplift must be in [-1,1]');
    }
    if (!Number.isFinite(args.onnxPrimaryMinQuickLowerBound) || args.onnxPrimaryMinQuickLowerBound < -1 || args.onnxPrimaryMinQuickLowerBound > 1) {
        throw new Error('--onnx-primary-min-quick-lower-bound must be in [-1,1]');
    }
    if (!Number.isFinite(args.onnxPrimaryMinOnnxGateAvg) || args.onnxPrimaryMinOnnxGateAvg < 0 || args.onnxPrimaryMinOnnxGateAvg > 1) {
        throw new Error('--onnx-primary-min-onnx-gate-avg must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxPrimaryMinOnnxGateMinSeed) || args.onnxPrimaryMinOnnxGateMinSeed < 0 || args.onnxPrimaryMinOnnxGateMinSeed > 1) {
        throw new Error('--onnx-primary-min-onnx-gate-min-seed must be in [0,1]');
    }
    if (args.promotionMode === 'onnx-primary' && !args.onnxGateEnabled) {
        throw new Error('--promotion-mode onnx-primary requires --onnx-gate');
    }
    if (args.bootstrapPolicyModelPath && !fs.existsSync(args.bootstrapPolicyModelPath)) {
        throw new Error(`--bootstrap-policy-model not found: ${args.bootstrapPolicyModelPath}`);
    }
    if (args.resumeCheckpointPath && !fs.existsSync(args.resumeCheckpointPath)) {
        throw new Error(`--resume-checkpoint not found: ${args.resumeCheckpointPath}`);
    }
    for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
        if (args[spec.argKey] && !fs.existsSync(args[spec.argKey])) {
            throw new Error(`${spec.resumeFlag} not found: ${args[spec.argKey]}`);
        }
        if (args[spec.argKey] && !isCheckpointNameCompatibleWithHead(args[spec.argKey], spec.head)) {
            throw new Error(`${spec.resumeFlag} expects a ${spec.prefix} checkpoint: ${args[spec.argKey]}`);
        }
    }
    args.resumeCheckpointPaths = resolveResumeCheckpointPathsFromArgs(args);
    if (args.trainTargetHeadEnabled === false) {
        args.resumeTargetCheckpointPath = null;
        args.resumeCheckpointPaths.target = null;
    }
    if (args.trainValueHeadEnabled === false) {
        args.resumeValueCheckpointPath = null;
        args.resumeCheckpointPaths.value = null;
    }
    args.resumeCheckpointPath = getPrimaryResumeCheckpointPath(args.resumeCheckpointPaths);
    if (args.seedBankPath && !fs.existsSync(args.seedBankPath)) {
        throw new Error(`--seed-bank not found: ${args.seedBankPath}`);
    }
    if (!args.runTag) args.runTag = makeRunTag();
    if (!args.summaryOut) args.summaryOut = path.resolve(args.runsDir, `training-cycle.${args.runTag}.json`);
    if (args.restartFromStep) {
        const normalizedRestartFromStep = normalizeRestartFromStep(args.restartFromStep);
        if (!normalizedRestartFromStep) {
            throw new Error(`--restart-from-step must be one of: ${TRAINING_CYCLE_STEP_ORDER.join(', ')}`);
        }
        args.restartFromStep = normalizedRestartFromStep;
    }

    return args;
}

function makeRunTag() {
    return new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
}

export = {
    createSelfplayTrainingCycleDefaults,
    parseSelfplayTrainingCycleArgs,
    defaultSelfplayJobs,
    normalizeRestartFromStep,
    normalizeSelfplayCandidateAdmission,
    shouldAdmitCandidateGuide,
    shouldIncludeCandidateFilesAtStartup,
    describeSelfplayGuideUpdateMode,
    shouldReuseStepArtifacts,
    getPrimaryResumeCheckpointPath,
    resolveCarryOverResumeCheckpointPaths,
    resolveResumeCheckpointPathsFromArgs,
    parseSelfplayCardUsageRateScheduleSpec,
    resolveSelfplayCardUsageRateForIteration,
    makeRunTag
};
