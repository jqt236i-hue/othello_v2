#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { StringDecoder } = require('string_decoder');
const {
    TRAINING_CHECKPOINT_HEAD_SPECS,
    createEmptyResumeCheckpointPaths,
    cloneResumeCheckpointPaths,
    detectCheckpointHead,
    isCheckpointNameCompatibleWithHead
} = require('./training-checkpoint-utils');
const {
    TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION,
    buildIterationWarehouseManifest,
    writeTrainingWarehouseManifest,
    cleanupWarehouseSelfplayArtifacts
} = require('./training-warehouse-manifest-utils');
const { buildSeedList } = require('./policy-seed-utils');
const {
    loadSeedBank,
    resolveSeedScheduleFromBank,
    commitSeedBankUsage
} = require('./seed-bank-manager');
const {
    buildGenerateSelfplayDataArgs,
    buildPolicyTrainingCommandArgs,
    buildCardTrainingCommandArgs,
    buildTargetTrainingCommandArgs,
    buildValueTrainingCommandArgs,
    buildQuickAdoptionCommandArgs,
    buildQualityGateCommandArgs,
    buildFinalAdoptionCommandArgs,
    buildCandidateOnnxBundleArgs,
    buildTargetOnnxBundleArgs,
    buildOnnxGateCommandArgs,
    buildPromotionTargetBundleArgs,
    buildPromotionCommandArgs
} = require('./training-cycle-command-builders');
const {
    extractTrainingCycleFailureDetail,
    annotateTrainingCycleError,
    writeSummarySnapshot
} = require('./training-cycle-reporting');

function defaultSelfplayJobs() {
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    return Math.max(1, Math.min(10, cpuCount));
}

const TRAINING_CYCLE_STEP_ORDER = Object.freeze([
    'generate-train',
    'generate-eval',
    'train-policy',
    'evaluate-policy',
    'train-card-policy',
    'train-target-policy',
    'train-value-policy',
    'adoption-quick',
    'adoption-quality-gate',
    'adoption-final',
    'adoption-onnx-gate',
    'promote-model'
]);

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

function parseArgs(argv) {
    const args = {
        iterations: 1,
        maxHours: 100,
        trainGames: 20000,
        evalGames: 2000,
        selfplayJobs: defaultSelfplayJobs(),
        selfplayResumeChunkSize: 1000,
        adoptionJobs: defaultSelfplayJobs(),
        onnxGateJobs: defaultSelfplayJobs(),
        seed: 1,
        seedStride: 1000,
        evalSeedOffset: 100000,
        maxPlies: 220,
        allowCardUsage: true,
        cardUsageRate: 0.2,
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
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
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
        adoptionWhitePriority: 0.5,
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
        onnxGateCandidateColorMode: 'both',
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
        runsDir: path.resolve(process.cwd(), 'data', 'runs'),
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        summaryOut: null,
        reuseExistingArtifacts: false,
        restartFromStep: null,
        verbose: false,
        help: false
    };

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
        if (a === '--selfplay-use-promoted-model-only') { args.selfplayUsePromotedModelOnly = true; continue; }
        if (a === '--selfplay-use-candidate-every-iteration') { args.selfplayUsePromotedModelOnly = false; continue; }
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

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-selfplay-training-cycle.js [options]',
        '',
        'Options:',
        '  -n, --iterations <n>        Number of full training cycles (default: 1)',
        '      --max-hours <h>         Time budget in hours (default: 100, 0=off)',
        '      --train-games <n>       Self-play games for train data (default: 20000)',
        '      --eval-games <n>        Self-play games for eval data (default: 2000)',
        '      --selfplay-jobs <n>     Parallel workers for self-play generation (default: auto, up to 10)',
        '      --selfplay-resume-chunk-size <n>  Chunk checkpoint size for resumable self-play generation (default: 1000, 0=off)',
        '      --adoption-jobs <n>     Parallel workers for adoption benchmark (default: auto, up to 10)',
        '      --onnx-gate-jobs <n>    Parallel workers for ONNX gate matches (default: auto, up to 10)',
        '  -s, --seed <n>              Base seed (default: 1)',
        '      --seed-stride <n>       Seed step per iteration (default: 1000)',
        '      --eval-seed-offset <n>  Eval seed offset from train seed (default: 100000)',
        '      --max-plies <n>         Max plies per game (default: 220)',
        '      --with-cards            Enable cards in self-play (default: on)',
        '      --no-cards              Disable cards in self-play',
        '      --selfplay-hardcases    Write hardcase-only NDJSON alongside self-play data (default: on)',
        '      --no-selfplay-hardcases Disable hardcase-only NDJSON generation for self-play',
        '      --card-usage-rate <r>   Card usage rate [0..1] (default: 0.2)',
        '      --selfplay-policy-mix-rate <r> Probability to use guide model per player/game [0..1] (default: 1)',
        '      --selfplay-policy-model-pool-size <n> Recent promoted/candidate models kept in self-play pool (default: 4)',
        '      --selfplay-policy-pool-sampling <mode> Model-pool sampling mode uniform|recency (default: recency)',
        '      --selfplay-policy-pool-recency-decay <r> Recency decay (>0) for recency sampling (default: 2.5)',
        '      --selfplay-policy-current-anchor-rate <r> Probability to anchor one side to current guide model [0..1] (default: 0.35)',
        '      --selfplay-card-usage-rate-jitter <r> Per-game card usage jitter (+/-r) [0..1] (default: 0)',
        '      --selfplay-card-usage-rate-schedule <spec> Step schedule for self-play card usage only (<rate>@<iteration>,...)',
        '      --selfplay-tactical-weight-min <r> Min tactical lookahead weight during self-play (default: 1)',
        '      --selfplay-tactical-weight-max <r> Max tactical lookahead weight during self-play (default: 1)',
        '      --selfplay-tactical-depth-opening <n> Tactical search depth in opening phase for self-play (default: 4)',
        '      --selfplay-tactical-depth-mid <n> Tactical search depth in mid phase for self-play (default: 6)',
        '      --selfplay-tactical-depth-end <n> Tactical search depth in end phase for self-play (default: 8)',
        '      --selfplay-tactical-beam-width <n> Tactical search beam width for self-play (default: 12)',
        '      --selfplay-teacher-committee-weight-min <r> Min committee voting weight in teacher self-play (default: 28)',
        '      --selfplay-teacher-committee-weight-max <r> Max committee voting weight in teacher self-play (default: 28)',
        '      --selfplay-teacher-committee-consensus-bonus-min <r> Min committee consensus bonus in teacher self-play (default: 320)',
        '      --selfplay-teacher-committee-consensus-bonus-max <r> Max committee consensus bonus in teacher self-play (default: 320)',
        '      --selfplay-policy-score-weight-min <r> Min model score weight in teacher hybrid scoring (default: 1)',
        '      --selfplay-policy-score-weight-max <r> Max model score weight in teacher hybrid scoring (default: 1)',
        '      --selfplay-heuristic-weight-min <r> Min heuristic score weight in teacher hybrid scoring (default: 1)',
        '      --selfplay-heuristic-weight-max <r> Max heuristic score weight in teacher hybrid scoring (default: 1)',
        '      --python <path>         Python executable path (default: .venv/Scripts/python.exe)',
        '      --onnx-epochs <n>       train_policy_onnx --epochs (default: 9999)',
        '      --onnx-batch-size <n>   train_policy_onnx --batch-size (default: 2048)',
        '      --onnx-lr <r>           train_policy_onnx --lr (default: 0.001)',
        '      --onnx-value-lr <r>     train_value_onnx --lr override (>0, default: reuse --onnx-lr)',
        '      --onnx-hidden-size <n>  train_policy_onnx --hidden-size (default: 256)',
        '      --onnx-value-hidden-size <n>  train_value_onnx --hidden-size override (>=8, default: reuse --onnx-hidden-size)',
        '      --onnx-device <mode>    train_policy_onnx --device auto/cpu/cuda (default: auto)',
        '      --onnx-log-interval-steps <n>  train_policy_onnx step log interval (default: 0=off)',
        '      --onnx-val-split <r>    train_policy_onnx --val-split [0..0.5) (default: 0.1)',
        '      --onnx-val-split-mode <m> train_policy_onnx --val-split-mode random|grouped-game (default: grouped-game)',
        '      --onnx-early-stop-patience <n> train_policy_onnx early stop patience (default: 8)',
        '      --onnx-early-stop-min-delta <r> train_policy_onnx early stop min delta (default: 0.0005)',
        '      --onnx-early-stop-min-epochs <n> train_policy_onnx minimum epochs before early-stop (default: 8)',
        '      --onnx-early-stop-monitor <m> train_policy_onnx monitor val_loss/train_loss/val_place_loss/train_place_loss (default: val_loss)',
        '      --onnx-early-stop-smoothing-window <n> train_policy_onnx early-stop moving-average window (default: 1=off)',
        '      --onnx-resume-optimizer   Restore optimizer state when resuming checkpoint (default: off)',
        '      --no-onnx-resume-optimizer Disable optimizer-state resume',
        '      --onnx-card-no-action-weight <r> train_policy_onnx NO_CARD class weight (>0, default: 0.7)',
        '      --onnx-card-class-balance-power <r> train_policy_onnx card class balancing power [0..1] (default: 0.25)',
        '      --onnx-winner-sample-boost <r> train_policy_onnx winner-side sample boost (>=0, default: 0.35)',
        '      --onnx-loser-sample-weight <r> train_policy_onnx loser-side sample weight (>0, default: 0.8)',
        '      --onnx-draw-sample-weight <r> train_policy_onnx draw sample weight (>0, default: 1.0)',
        '      --onnx-corner-emergency-sample-boost <r> Extra sample boost on corner-emergency records (>=0, default: 0.0)',
        '      --onnx-negative-future-disc-sample-boost <r> Extra sample boost when futureDiscDelta3Ply is below threshold (>=0, default: 0.0)',
        '      --onnx-negative-future-disc-threshold <r> Threshold for futureDiscDelta3Ply danger boost (default: -1.0)',
        '      --onnx-tactical-miss-sample-boost <r> Extra sample boost when tacticalScoreMissRatio exceeds threshold (>=0, default: 0.0)',
        '      --onnx-tactical-miss-threshold <r> Threshold for tacticalScoreMissRatio boost (>=0, default: 0.08)',
        '      --onnx-hand-pressure-sample-boost <r> Extra sample boost when handCards length is >= 4 (>=0, default: 0.0)',
        '      --onnx-pending-target-sample-boost <r> Extra sample boost when pendingType is active (>=0, default: 0.0)',
        '      --onnx-corner-balance-sample-boost <r> Extra policy/value sample boost scaled by corner pressure (>=0, default: 0.0)',
        '      --onnx-edge-balance-sample-boost <r> Extra policy/value sample boost scaled by edge pressure (>=0, default: 0.0)',
        '      --onnx-economy-balance-sample-boost <r> Extra policy/value sample boost scaled by charge/bonus pressure (>=0, default: 0.0)',
        '      --onnx-value-target-corner-weight <r> Value-target corner blend weight [0..1] (default: 0.0)',
        '      --onnx-value-target-edge-weight <r> Value-target edge blend weight [0..1] (default: 0.0)',
        '      --onnx-value-target-economy-weight <r> Value-target economy blend weight [0..1] (default: 0.0)',
        '      --onnx-value-target-corner-emergency-weight <r> Value-target corner-emergency penalty weight [0..1] (default: 0.0)',
        '      --train-target-head     Enable pending-target specialist training and packaging (default: on)',
        '      --no-train-target-head  Disable pending-target specialist training and promotion packaging for this lane',
        '      --train-value-head      Enable value specialist training and packaging (default: on)',
        '      --no-train-value-head   Disable value specialist training, ONNX gate wiring, and promotion packaging for this lane',
        '      --train-card-every <n>  Train card specialist every N iterations, starting from iteration 1 (default: 1)',
        '      --train-target-every <n> Train pending-target specialist every N iterations, starting from iteration 1 (default: 1)',
        '      --train-value-every <n> Train value specialist every N iterations, starting from iteration 1 (default: 1)',
        '      --min-visits <n>        compatibility policy-table --min-visits (default: 12)',
        '      --shape-immediate <r>   compatibility policy-table --shape-immediate (default: 0.4)',
        '      --quick-games <n>       Adoption quick check games (default: 500)',
        '      --final-games <n>       Adoption final check games (default: 2000)',
        '      --threshold <r>         Required average uplift threshold [0..1] (default: 0.05)',
        '      --adoption-seed-count <n>  Number of seeds for adoption averaging (default: 1)',
        '      --adoption-seed-stride <n> Seed step for adoption averaging (default: 1000)',
        '      --adoption-final-seed-offset <n> Seed offset for final adoption run (default: 500000)',
        '      --adoption-confidence-level <r> One-sided confidence level for uplift lower bound [0.5..1) (default: 0.95)',
        '      --adoption-min-lower-bound <r> Required uplift lower confidence bound [-1..1] (default: -1=off)',
        '      --adoption-min-seed-uplift <r> Required minimum per-seed uplift [-1..1] (default: -1)',
        '      --adoption-min-seed-pass-count <n> Required per-seed threshold pass count (default: 0)',
        '      --quality-gate          Enable quality-only gate between quick and final adoption (default: off)',
        '      --no-quality-gate       Disable quality-only gate',
        '      --quality-gate-games <n> Quality gate games (default: 1000)',
        '      --quality-gate-seed-count <n> Quality gate seed count (default: 1)',
        '      --quality-gate-seed-stride <n> Quality gate seed stride (default: 1000)',
        '      --quality-gate-seed-offset <n> Quality gate base seed offset (default: 250000)',
        '      --quality-gate-threshold <r> Quality gate average uplift threshold [-1..1] (default: 0)',
        '      --quality-gate-confidence-level <r> Quality gate confidence level [0.5..1) (default: 0.95)',
        '      --quality-gate-min-lower-bound <r> Quality gate uplift lower confidence bound [-1..1] (default: -1)',
        '      --quality-gate-min-seed-uplift <r> Quality gate minimum per-seed uplift [-1..1] (default: -1)',
        '      --quality-gate-min-seed-pass-count <n> Quality gate minimum passing seeds (default: 0)',
        '      --quality-gate-strength-first Require non-negative raw/source strength on quality-gate samples before passing',
        '      --quick-adoption-seed-offset <n> Seed offset for quick adoption run (default: 0 = reuse iteration base seed family)',
        '      --quick-adoption-threshold <r> Override quick adoption threshold [0..1] (default: fallback to --threshold)',
        '      --quick-adoption-seed-count <n> Override quick adoption seed count (default: fallback to --adoption-seed-count)',
        '      --quick-adoption-seed-stride <n> Override quick adoption seed stride (default: fallback to --adoption-seed-stride)',
        '      --quick-adoption-confidence-level <r> Override quick adoption confidence level [0.5..1) (default: fallback to --adoption-confidence-level)',
        '      --quick-adoption-min-lower-bound <r> Override quick adoption lower confidence bound [-1..1] (default: fallback to --adoption-min-lower-bound)',
        '      --quick-adoption-min-seed-uplift <r> Override quick adoption minimum per-seed uplift [-1..1] (default: fallback to --adoption-min-seed-uplift)',
        '      --quick-adoption-min-seed-pass-count <n> Override quick adoption minimum seed pass count (default: fallback to --adoption-min-seed-pass-count)',
        '      --final-adoption-threshold <r> Override final adoption threshold [0..1] (default: fallback to --threshold)',
        '      --final-adoption-seed-count <n> Override final adoption seed count (default: fallback to --adoption-seed-count)',
        '      --final-adoption-seed-stride <n> Override final adoption seed stride (default: fallback to --adoption-seed-stride)',
        '      --final-adoption-confidence-level <r> Override final adoption confidence level [0.5..1) (default: fallback to --adoption-confidence-level)',
        '      --final-adoption-min-lower-bound <r> Override final adoption lower confidence bound [-1..1] (default: fallback to --adoption-min-lower-bound)',
        '      --final-adoption-min-seed-uplift <r> Override final adoption minimum per-seed uplift [-1..1] (default: fallback to --adoption-min-seed-uplift)',
        '      --final-adoption-min-seed-pass-count <n> Override final adoption minimum seed pass count (default: fallback to --adoption-min-seed-pass-count)',
        '      --adoption-tactical-weight <r> Shared tactical weight in adoption benchmark (default: 0.25)',
        '      --adoption-tactical-depth-opening <n> Tactical search depth in opening phase for adoption benchmark (default: 4)',
        '      --adoption-tactical-depth-mid <n> Tactical search depth in mid phase for adoption benchmark (default: 6)',
        '      --adoption-tactical-depth-end <n> Tactical search depth in end phase for adoption benchmark (default: 8)',
        '      --adoption-tactical-beam-width <n> Tactical search beam width for adoption benchmark (default: 12)',
        '      --adoption-policy-score-weight <r> Shared model score weight in adoption benchmark (default: 2.0)',
        '      --adoption-heuristic-weight <r> Shared heuristic score weight in adoption benchmark (default: 0.85)',
        '      --adoption-white-priority <r> White-side score blend in adoption benchmark [0..1] (default: 0.5)',
        '      --adoption-quality-weight-corner <r> Adoption quality corner-take weight [0..1] (default: 0.22)',
        '      --adoption-quality-weight-edge <r> Adoption quality edge-take weight [0..1] (default: 0.10)',
        '      --adoption-quality-weight-corner-recovery <r> Adoption quality corner-recovery weight [0..1] (default: 0.18)',
        '      --adoption-quality-weight-corner-recapture <r> Adoption quality corner-recapture weight [0..1] (default: 0.14)',
        '      --adoption-quality-weight-edge-recovery <r> Adoption quality edge-recovery weight [0..1] (default: 0.12)',
        '      --adoption-quality-weight-corner-hold <r> Adoption quality corner-hold weight [0..1] (default: 0.16)',
        '      --adoption-quality-weight-corner-hold-turns <r> Adoption quality corner-hold-turns weight [0..1] (default: 0.10)',
        '      --adoption-quality-weight-edge-hold <r> Adoption quality edge-hold weight [0..1] (default: 0.09)',
        '      --adoption-quality-weight-edge-chain <r> Adoption quality contiguous-edge weight [0..1] (default: 0.12)',
        '      --adoption-quality-weight-final-corner-share <r> Adoption quality final corner share weight [0..1] (default: 0.24)',
        '      --adoption-quality-weight-final-edge-share <r> Adoption quality final edge share weight [0..1] (default: 0.06)',
        '      --adoption-quality-weight-final-longest-edge-run-share <r> Adoption quality final longest-edge-run share weight [0..1] (default: 0.08)',
        '      --adoption-quality-weight-bonus <r> Adoption quality bonus weight [0..1] (default: 0.01)',
        '      --adoption-quality-weight-card-immediate <r> Adoption quality card-immediate weight [0..1] (default: 0.015)',
        '      --adoption-quality-weight-card-future <r> Adoption quality card-future(3ply) weight [0..1] (default: 0.02)',
        '      --adoption-quality-weight-place-delta <r> Adoption quality place-delta weight [0..1] (default: 0.015)',
        '      --adoption-use-guide-baseline  Compare candidate against current guide model in adoption benchmark',
        '      --no-adoption-use-guide-baseline Disable guide-model baseline compare (default)',
        '      --adoption-use-anchor-baseline Compare candidate against a fixed loop-start anchor model in adoption benchmark',
        '      --no-adoption-use-anchor-baseline Disable fixed-anchor baseline compare (default)',
        '      --onnx-gate             Enable browser ONNX gate before promotion (default: off)',
        '      --no-onnx-gate          Disable browser ONNX gate',
        '      --onnx-gate-games <n>   ONNX gate games per side/seed (default: 8)',
        '      --onnx-gate-seed-count <n> ONNX gate seed count (default: 1)',
        '      --onnx-gate-seed-stride <n> ONNX gate seed stride (default: 1000)',
        '      --onnx-gate-seed-offset <n> ONNX gate base seed offset (default: 700000)',
        '      --onnx-gate-threshold <r> ONNX gate average score threshold [0..1] (default: 0.5)',
        '      --onnx-gate-min-seed-score <r> ONNX gate minimum seed score [0..1] (default: 0)',
        '      --onnx-gate-min-seed-pass-count <n> ONNX gate minimum passing seeds (default: 0)',
        '      --onnx-gate-max-average-latency-ms <n> ONNX gate max average inference latency in ms (default: 0=off)',
        '      --onnx-gate-max-p95-latency-ms <n> ONNX gate max worst-match p95 inference latency in ms (default: 0=off)',
        '      --onnx-gate-max-max-latency-ms <n> ONNX gate max peak inference latency in ms (default: 0=off)',
        '      --onnx-gate-timeout-ms <n> ONNX gate per-match timeout in ms (default: 180000)',
        '      --onnx-gate-black-level <n> ONNX gate black CPU level [1..6] (default: 6)',
        '      --onnx-gate-white-level <n> ONNX gate white CPU level [1..6] (default: 6)',
        '      --onnx-gate-candidate-color-mode <m> ONNX gate candidate side mode both|white (default: both)',
        '      --promotion-mode <mode> Promotion gate strategy: strict | onnx-primary | quick-only (default: strict)',
        '      --onnx-primary-max-quick-regression <r> Max allowed quick uplift regression in onnx-primary [0..1] (default: 0.05)',
        '      --onnx-primary-require-quick-regression    Require quick uplift regression guard in onnx-primary (default: off)',
        '      --no-onnx-primary-require-quick-regression Disable quick uplift regression guard in onnx-primary',
        '      --onnx-primary-require-quick-non-regression    Require quick core/white/quality non-regression guard (default: off)',
        '      --no-onnx-primary-require-quick-non-regression Disable quick core/white/quality non-regression guard',
        '      --onnx-primary-min-quick-core-delta <r> Min allowed (candidate-baseline) quick core score delta [-1..1] (default: 0)',
        '      --onnx-primary-min-quick-white-delta <r> Min allowed (candidate-baseline) quick white-side score delta [-1..1] (default: 0)',
        '      --onnx-primary-min-quick-quality-delta <r> Min allowed (candidate-baseline) quick quality score delta [-1..1] (default: -0.01)',
        '      --onnx-primary-min-quick-uplift <r> Min quick uplift required in onnx-primary [-1..1] (default: 0)',
        '      --onnx-primary-min-quick-lower-bound <r> Min quick uplift lower-bound required in onnx-primary [-1..1] (default: -1)',
        '      --onnx-primary-min-onnx-gate-avg <r> Min ONNX gate average score required in onnx-primary [0..1] (default: 0)',
        '      --onnx-primary-min-onnx-gate-min-seed <r> Min ONNX gate min-seed score required in onnx-primary [0..1] (default: 0)',
        '      --gate-final-iteration-only  Run quick/quality/final/onnx/promotion only on the last iteration',
        '      --no-gate-final-iteration-only Disable last-iteration-only gate mode (default)',
        '      --promote               Promote model when selected promotion mode passes (default: on)',
        '      --no-promote            Skip promotion even when final check passes',
        '      --selfplay-use-promoted-model-only        Update next self-play guide only when promotion succeeds (default: on)',
        '      --selfplay-use-candidate-every-iteration  Update next self-play guide to latest candidate every iteration',
        '      --bootstrap-policy-model <path>  Seed self-play with an existing policy-table JSON',
        '      --resume-checkpoint <path>       Legacy single resume checkpoint; head is inferred from filename',
        '      --resume-policy-checkpoint <path> Resume policy ONNX training from checkpoint (.pt)',
        '      --resume-card-checkpoint <path>   Resume card ONNX training from checkpoint (.pt)',
        '      --resume-target-checkpoint <path> Resume target ONNX training from checkpoint (.pt)',
        '      --resume-value-checkpoint <path>  Resume value ONNX training from checkpoint (.pt)',
        '      --carry-over-checkpoint          Carry candidate checkpoint to next iteration (default: on)',
        '      --carry-over-checkpoint-promoted-only  Carry candidate checkpoint only after promotion succeeds',
        '      --no-carry-over-checkpoint       Do not carry checkpoint to next iteration',
        '      --seed-bank <path>     Optional seed_bank.v1 file for quick/quality/final/onnx gate seeds',
        '      --run-tag <tag>         Tag appended to output filenames',
        '      --runs-dir <path>       Output directory for records/results (default: data/runs)',
        '      --models-dir <path>     Output directory for candidate models (default: data/models)',
        '      --summary-out <path>    Output summary JSON path',
        '      --reuse-existing-artifacts  Reuse completed iteration artifacts and continue from the first missing step',
        `      --restart-from-step <name>  When reusing artifacts, rerun this step and later steps (${TRAINING_CYCLE_STEP_ORDER.join(', ')})`,
        '      --verbose               Keep verbose logs in underlying scripts',
        '  -h, --help                  Show this help'
    ].join('\n'));
}

function makeRunTag() {
    return new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
}

function runCommand(cmd, args, options) {
    const allowExitCodes = options && Array.isArray(options.allowExitCodes) ? options.allowExitCodes : [0];
    const timeoutMs = options && Number.isFinite(options.timeoutMs)
        ? Math.max(1, Math.floor(options.timeoutMs))
        : null;
    const shown = [cmd].concat(args).join(' ');
    console.log(`[training-cycle] run: ${shown}`);
    const startedAt = Date.now();
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
        timeout: timeoutMs || undefined
    });
    const elapsedMs = Date.now() - startedAt;
    if (result.error) {
        if (result.error.code === 'ETIMEDOUT') {
            const err = new Error(`command timed out after ${timeoutMs}ms: ${shown}`);
            err.code = 'COMMAND_TIMEOUT';
            err.command = shown;
            throw err;
        }
        result.error.command = shown;
        throw result.error;
    }
    if (!allowExitCodes.includes(result.status)) {
        const err = new Error(`command failed (exit=${result.status}): ${shown}`);
        err.code = 'COMMAND_FAILED';
        err.exitCode = result.status;
        err.command = shown;
        throw err;
    }
    return { status: result.status, elapsedMs };
}

function iterationTag(runTag, iterationIndex) {
    return `${runTag}.it${String(iterationIndex).padStart(2, '0')}`;
}

function buildIterationPaths(args, iterationIndex) {
    const tag = iterationTag(args.runTag, iterationIndex);
    const targetHeadEnabled = args.trainTargetHeadEnabled !== false;
    const valueHeadEnabled = args.trainValueHeadEnabled !== false;
    return {
        tag,
        trainDataPath: path.resolve(args.runsDir, `selfplay.train.${tag}.ndjson`),
        trainHardcaseDataPath: args.selfplayGenerateHardcases === false
            ? null
            : path.resolve(args.runsDir, `selfplay.train.hardcase.${tag}.ndjson`),
        trainDataSummaryPath: path.resolve(args.runsDir, `selfplay.train.${tag}.ndjson.summary.json`),
        evalDataPath: path.resolve(args.runsDir, `selfplay.eval.${tag}.ndjson`),
        evalHardcaseDataPath: args.selfplayGenerateHardcases === false
            ? null
            : path.resolve(args.runsDir, `selfplay.eval.hardcase.${tag}.ndjson`),
        evalDataSummaryPath: path.resolve(args.runsDir, `selfplay.eval.${tag}.ndjson.summary.json`),
        onnxModelPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx`),
        onnxMetaPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx.meta.json`),
        checkpointPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.checkpoint.pt`),
        cardOnnxModelPath: path.resolve(args.modelsDir, `policy-card.candidate.${tag}.onnx`),
        cardOnnxMetaPath: path.resolve(args.modelsDir, `policy-card.candidate.${tag}.onnx.meta.json`),
        cardCheckpointPath: path.resolve(args.modelsDir, `policy-card.candidate.${tag}.checkpoint.pt`),
        targetOnnxModelPath: targetHeadEnabled
            ? path.resolve(args.modelsDir, `policy-target.candidate.${tag}.onnx`)
            : null,
        targetOnnxMetaPath: targetHeadEnabled
            ? path.resolve(args.modelsDir, `policy-target.candidate.${tag}.onnx.meta.json`)
            : null,
        targetCheckpointPath: targetHeadEnabled
            ? path.resolve(args.modelsDir, `policy-target.candidate.${tag}.checkpoint.pt`)
            : null,
        valueOnnxModelPath: valueHeadEnabled
            ? path.resolve(args.modelsDir, `policy-value.candidate.${tag}.onnx`)
            : null,
        valueOnnxMetaPath: valueHeadEnabled
            ? path.resolve(args.modelsDir, `policy-value.candidate.${tag}.onnx.meta.json`)
            : null,
        valueCheckpointPath: valueHeadEnabled
            ? path.resolve(args.modelsDir, `policy-value.candidate.${tag}.checkpoint.pt`)
            : null,
        onnxMetricsPath: path.resolve(args.runsDir, `train.metrics.${tag}.jsonl`),
        cardMetricsPath: path.resolve(args.runsDir, `train.card.metrics.${tag}.jsonl`),
        targetMetricsPath: targetHeadEnabled
            ? path.resolve(args.runsDir, `train.target.metrics.${tag}.jsonl`)
            : null,
        valueMetricsPath: valueHeadEnabled
            ? path.resolve(args.runsDir, `train.value.metrics.${tag}.jsonl`)
            : null,
        candidateModelPath: path.resolve(args.modelsDir, `policy-table.candidate.${tag}.json`),
        quickAdoptionPath: path.resolve(args.runsDir, `adoption.quick.${tag}.json`),
        finalAdoptionPath: path.resolve(args.runsDir, `adoption.final.${tag}.json`),
        qualityGatePath: path.resolve(args.runsDir, `adoption.quality.${tag}.json`),
        onnxGatePath: path.resolve(args.runsDir, `adoption.onnx.${tag}.json`),
        warehouseManifestPath: path.resolve(args.runsDir, `training-warehouse.${tag}.json`)
    };
}

function fileExists(filePath) {
    return !!filePath && fs.existsSync(filePath);
}

function buildResumeChunkArtifactDir(dataPath) {
    return path.resolve(`${String(dataPath || '')}.resume-chunks`);
}

function buildMergeArtifactPaths(dataPath) {
    if (!dataPath) return [];
    const resolvedPath = path.resolve(String(dataPath || ''));
    return [
        `${resolvedPath}.partial`,
        `${resolvedPath}.merge-state.json`
    ];
}

function removePathIfExists(targetPath) {
    if (!targetPath || !fs.existsSync(targetPath)) return false;
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
        fs.rmSync(targetPath, { force: true });
    }
    return true;
}

function collectTransientSelfplayArtifactPaths(iterationPaths) {
    if (!iterationPaths || typeof iterationPaths !== 'object') return [];
    const out = [
        iterationPaths.trainDataPath,
        iterationPaths.trainHardcaseDataPath,
        iterationPaths.evalDataPath,
        iterationPaths.evalHardcaseDataPath,
        buildResumeChunkArtifactDir(iterationPaths.trainDataPath),
        buildResumeChunkArtifactDir(iterationPaths.evalDataPath)
    ];
    for (const basePath of [
        iterationPaths.trainDataPath,
        iterationPaths.trainHardcaseDataPath,
        iterationPaths.evalDataPath,
        iterationPaths.evalHardcaseDataPath
    ]) {
        out.push(...buildMergeArtifactPaths(basePath));
    }
    return out.filter(Boolean);
}

function cleanupTransientSelfplayArtifacts(iterationPaths) {
    const removed = [];
    const failed = [];
    const seen = new Set();
    for (const onePath of collectTransientSelfplayArtifactPaths(iterationPaths)) {
        const resolvedPath = path.resolve(onePath);
        if (seen.has(resolvedPath)) continue;
        seen.add(resolvedPath);
        try {
            if (removePathIfExists(resolvedPath)) {
                removed.push(resolvedPath);
            }
        } catch (err) {
            failed.push({
                path: resolvedPath,
                error: err && err.message ? err.message : String(err)
            });
        }
    }
    return {
        removed,
        failed
    };
}

function lineHasCoordinatePendingSelection(line) {
    if (!line) return false;
    let record = null;
    try {
        record = JSON.parse(line);
    } catch (err) {
        return false;
    }
    const pendingSelection = record && typeof record === 'object' ? record.pendingSelection : null;
    return !!(
        pendingSelection &&
        pendingSelection.kind === 'board_cell' &&
        Number.isInteger(pendingSelection.row) &&
        Number.isInteger(pendingSelection.col)
    );
}

function scanTextFileLines(filePath, onLine, options) {
    const chunkSizeBytes = options && Number.isFinite(options.chunkSizeBytes) && options.chunkSizeBytes > 0
        ? Math.max(1024, Math.floor(options.chunkSizeBytes))
        : (1024 * 1024);
    const decoder = new StringDecoder('utf8');
    const buffer = Buffer.allocUnsafe(chunkSizeBytes);
    const handleLine = (line) => !!(line && onLine(line));
    let carry = '';
    const fd = fs.openSync(filePath, 'r');

    try {
        while (true) {
            const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
            if (!bytesRead) break;
            const chunk = decoder.write(buffer.subarray(0, bytesRead));
            const combined = carry + chunk;
            const lines = combined.split(/\r?\n/);
            carry = lines.pop() || '';
            for (const line of lines) {
                if (handleLine(line)) return true;
            }
        }
        const tail = carry + decoder.end();
        return handleLine(tail);
    } finally {
        fs.closeSync(fd);
    }
}

function hasCoordinatePendingSelectionRecords(filePath, options) {
    if (!fileExists(filePath)) return false;
    return scanTextFileLines(filePath, lineHasCoordinatePendingSelection, options);
}

function readJsonSafe(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function resolveQuickComponentDelta(quickPayload, quickDecision, baselineKey, candidateKey) {
    if (
        quickDecision &&
        Number.isFinite(quickDecision[baselineKey]) &&
        Number.isFinite(quickDecision[candidateKey])
    ) {
        return Number(quickDecision[candidateKey]) - Number(quickDecision[baselineKey]);
    }
    const perSeed = quickPayload && Array.isArray(quickPayload.perSeed) ? quickPayload.perSeed : [];
    let sum = 0;
    let count = 0;
    for (const seedRow of perSeed) {
        const seedDecision = seedRow && seedRow.decision ? seedRow.decision : null;
        if (!seedDecision) continue;
        if (!Number.isFinite(seedDecision[baselineKey]) || !Number.isFinite(seedDecision[candidateKey])) continue;
        sum += Number(seedDecision[candidateKey]) - Number(seedDecision[baselineKey]);
        count += 1;
    }
    return count > 0 ? (sum / count) : -Infinity;
}

function resolvePromotionEligibility(args, gateState) {
    const quickPassed = !!(gateState && gateState.quickPassed);
    const qualityGatePassed = !!(gateState && gateState.qualityGatePassed);
    const finalPassed = !!(gateState && gateState.finalPassed);
    const onnxGatePassed = !!(gateState && gateState.onnxGatePassed);
    const quickRegressionWithinOnnxPrimaryLimit = !!(gateState && gateState.quickRegressionWithinOnnxPrimaryLimit);
    const quickNonRegressionWithinOnnxPrimaryLimit = !!(gateState && gateState.quickNonRegressionWithinOnnxPrimaryLimit);
    const quickUplift = gateState && Number.isFinite(gateState.quickUplift)
        ? Number(gateState.quickUplift)
        : Number.NEGATIVE_INFINITY;
    const quickUpliftLowerBound = gateState && Number.isFinite(gateState.quickUpliftLowerBound)
        ? Number(gateState.quickUpliftLowerBound)
        : Number.NEGATIVE_INFINITY;
    const onnxGateDecision = gateState && gateState.onnxGateDecision ? gateState.onnxGateDecision : null;

    const strictPromoteEligible = finalPassed && qualityGatePassed && onnxGatePassed;
    const onnxPrimaryQuickGuardPassed = !args.onnxPrimaryRequireQuickRegression || quickRegressionWithinOnnxPrimaryLimit;
    const onnxPrimaryQuickNonRegressionGuardPassed = !args.onnxPrimaryRequireQuickNonRegression || quickNonRegressionWithinOnnxPrimaryLimit;
    const onnxGateAverageScore = onnxGateDecision && Number.isFinite(onnxGateDecision.averageScore)
        ? Number(onnxGateDecision.averageScore)
        : -Infinity;
    const onnxGateMinSeedScore = onnxGateDecision && Number.isFinite(onnxGateDecision.minSeedScore)
        ? Number(onnxGateDecision.minSeedScore)
        : -Infinity;
    const onnxPrimaryQuickUpliftGuardPassed = quickUplift >= args.onnxPrimaryMinQuickUplift;
    const onnxPrimaryQuickLowerBoundGuardPassed = quickUpliftLowerBound >= args.onnxPrimaryMinQuickLowerBound;
    const onnxPrimaryOnnxGateAvgGuardPassed = onnxGateAverageScore >= args.onnxPrimaryMinOnnxGateAvg;
    const onnxPrimaryOnnxGateMinSeedGuardPassed = onnxGateMinSeedScore >= args.onnxPrimaryMinOnnxGateMinSeed;
    const onnxPrimaryPromoteEligible =
        qualityGatePassed &&
        onnxGatePassed &&
        onnxPrimaryQuickGuardPassed &&
        onnxPrimaryQuickNonRegressionGuardPassed &&
        onnxPrimaryQuickUpliftGuardPassed &&
        onnxPrimaryQuickLowerBoundGuardPassed &&
        onnxPrimaryOnnxGateAvgGuardPassed &&
        onnxPrimaryOnnxGateMinSeedGuardPassed;
    const quickOnlyPromoteEligible = quickPassed && qualityGatePassed;

    let promoteEligible = strictPromoteEligible;
    if (args.promotionMode === 'onnx-primary') {
        promoteEligible = onnxPrimaryPromoteEligible;
    } else if (args.promotionMode === 'quick-only') {
        promoteEligible = quickOnlyPromoteEligible;
    }

    return {
        promoteEligible,
        strictPromoteEligible,
        onnxPrimaryPromoteEligible,
        quickOnlyPromoteEligible,
        onnxPrimaryQuickGuardPassed,
        onnxPrimaryQuickNonRegressionGuardPassed,
        onnxPrimaryQuickUpliftGuardPassed,
        onnxPrimaryQuickLowerBoundGuardPassed,
        onnxPrimaryOnnxGateAvgGuardPassed,
        onnxPrimaryOnnxGateMinSeedGuardPassed,
        onnxGateAverageScore,
        onnxGateMinSeedScore
    };
}

function resolveGateSeedConfig(seedBank, gateType, fallback) {
    const normalizedFallback = {
        seed: Number.isFinite(Number(fallback && fallback.seed)) ? Number(fallback.seed) : null,
        seedCount: Number.isFinite(Number(fallback && fallback.seedCount)) ? Number(fallback.seedCount) : null,
        seedStride: Number.isFinite(Number(fallback && fallback.seedStride)) ? Number(fallback.seedStride) : null,
        seedList: Array.isArray(fallback && fallback.seedList) ? fallback.seedList.slice() : []
    };
    if (!seedBank) {
        return Object.assign({}, normalizedFallback, {
            source: 'config',
            bankId: null,
            bankPath: null,
            purpose: null
        });
    }
    const schedule = resolveSeedScheduleFromBank(seedBank, gateType);
    return {
        seed: schedule.baseSeed,
        seedCount: schedule.seedCount,
        seedStride: schedule.seedStride,
        seedList: Array.isArray(schedule.scheduledSeeds) ? schedule.scheduledSeeds.slice() : [],
        source: 'seed-bank',
        bankId: seedBank.bankId || null,
        bankPath: seedBank.__filePath || null,
        purpose: schedule.purpose || null
    };
}

function recordSeedBankGateUsage(seedBank, gateType, gatePayloadPath, iterationIndex, runTag, reused) {
    if (!seedBank || !seedBank.__filePath || !gatePayloadPath) return null;
    return commitSeedBankUsage(seedBank.__filePath, {
        gateType,
        runTag,
        iteration: iterationIndex,
        gatePayloadPath,
        note: reused ? 'reused-artifact' : 'fresh-run'
    });
}

function buildInitialGuideModelPoolPaths(modelsDir, guideModelPath, maxSize, options) {
    const limit = Number.isFinite(maxSize) ? Math.max(1, Math.floor(maxSize)) : 1;
    const includeCandidateFiles = !options || options.includeCandidateFiles !== false;
    const includeArchiveFiles = !!(options && options.includeArchiveFiles);
    const dedup = new Set();
    const out = [];

    const addPath = (onePath) => {
        if (!onePath) return;
        const resolved = path.resolve(onePath);
        if (!fs.existsSync(resolved)) return;
        if (dedup.has(resolved)) return;
        dedup.add(resolved);
        out.push(resolved);
    };

    addPath(guideModelPath);
    if (includeArchiveFiles && modelsDir && fs.existsSync(modelsDir)) {
        let archiveEntries = [];
        try {
            archiveEntries = fs.readdirSync(path.resolve(modelsDir, 'archive'), { withFileTypes: true });
        } catch (e) {
            archiveEntries = [];
        }
        const archivedGuideFiles = archiveEntries
            .filter((entry) => entry && entry.isDirectory())
            .map((entry) => {
                const fullPath = path.resolve(modelsDir, 'archive', entry.name, 'policy-table.json');
                let mtimeMs = 0;
                try {
                    mtimeMs = Number(fs.statSync(fullPath).mtimeMs) || 0;
                } catch (e) {
                    return null;
                }
                return { fullPath, mtimeMs };
            })
            .filter((one) => !!one)
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
        for (const one of archivedGuideFiles) {
            if (out.length >= limit) break;
            addPath(one.fullPath);
        }
    }
    if (!includeCandidateFiles || !modelsDir || !fs.existsSync(modelsDir)) {
        return out.slice(0, limit);
    }

    let entries = [];
    try {
        entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    } catch (e) {
        return out.slice(0, limit);
    }

    const candidateFiles = entries
        .filter((entry) => entry && entry.isFile() && entry.name.startsWith('policy-table.candidate.') && entry.name.endsWith('.json'))
        .map((entry) => {
            const fullPath = path.resolve(modelsDir, entry.name);
            let mtimeMs = 0;
            try {
                mtimeMs = Number(fs.statSync(fullPath).mtimeMs) || 0;
            } catch (e) {
                mtimeMs = 0;
            }
            return { fullPath, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

    for (const one of candidateFiles) {
        if (out.length >= limit) break;
        addPath(one.fullPath);
    }
    return out.slice(0, limit);
}

function resolveAdoptionBaselineMode(args) {
    if (args && args.adoptionUseAnchorBaseline === true) return 'anchor';
    if (args && args.adoptionUseGuideBaseline === true) return 'guide';
    return 'none';
}

function shouldRunGateForIteration(args, iterationIndex) {
    if (!args || args.gateFinalIterationOnly !== true) return true;
    const totalIterations = Number.isFinite(Number(args.iterations))
        ? Math.max(1, Math.floor(Number(args.iterations)))
        : 1;
    return iterationIndex >= totalIterations;
}

function shouldRunPeriodicTraining(iterationIndex, every) {
    const safeIteration = Number.isFinite(Number(iterationIndex))
        ? Math.max(1, Math.floor(Number(iterationIndex)))
        : 1;
    const safeEvery = Number.isFinite(Number(every))
        ? Math.max(1, Math.floor(Number(every)))
        : 1;
    return ((safeIteration - 1) % safeEvery) === 0;
}

function resolveIterationGateControl(args, iterationIndex, guideModelPath, anchorModelPath) {
    const baselineMode = resolveAdoptionBaselineMode(args);
    let baselineModelPath = null;
    if (baselineMode === 'anchor' && anchorModelPath) {
        baselineModelPath = path.resolve(anchorModelPath);
    } else if (baselineMode === 'guide' && guideModelPath) {
        baselineModelPath = path.resolve(guideModelPath);
    }
    return {
        gateIterationAllowed: shouldRunGateForIteration(args, iterationIndex),
        baselineMode,
        baselineModelPath
    };
}

function getRemainingMs(deadlineMs) {
    if (!Number.isFinite(deadlineMs)) return null;
    return Math.max(0, deadlineMs - Date.now());
}

function resolveNextCarryOverState(args, carryOver, result) {
    const nextState = {
        guideModelPath: carryOver && carryOver.guideModelPath ? carryOver.guideModelPath : null,
        guideModelPoolPaths: carryOver && Array.isArray(carryOver.guideModelPoolPaths)
            ? carryOver.guideModelPoolPaths.slice()
            : [],
        resumeCheckpointPaths: resolveCarryOverResumeCheckpointPaths(carryOver),
        resumeCheckpointPath: carryOver && carryOver.resumeCheckpointPath
            ? carryOver.resumeCheckpointPath
            : getPrimaryResumeCheckpointPath(resolveCarryOverResumeCheckpointPaths(carryOver)),
        checkpointCarryOverSkipped: false
    };
    if (args.trainTargetHeadEnabled === false) {
        nextState.resumeCheckpointPaths.target = null;
    }
    if (args.trainValueHeadEnabled === false) {
        nextState.resumeCheckpointPaths.value = null;
    }
    if (!result || !result.paths) return nextState;

    const shouldAdvanceGuide = !args.selfplayUsePromotedModelOnly || !!result.promoted;
    if (result.paths.candidateModelPath && fs.existsSync(result.paths.candidateModelPath) && shouldAdvanceGuide) {
        const promotedModelPath = path.resolve(args.modelsDir, 'policy-table.json');
        nextState.guideModelPath = (result.promoted && fs.existsSync(promotedModelPath))
            ? promotedModelPath
            : result.paths.candidateModelPath;
        if (nextState.guideModelPath) {
            if (args.selfplayUsePromotedModelOnly && result.promoted) {
                nextState.guideModelPoolPaths = buildInitialGuideModelPoolPaths(
                    args.modelsDir,
                    nextState.guideModelPath,
                    args.selfplayPolicyModelPoolSize,
                    { includeCandidateFiles: false, includeArchiveFiles: true }
                );
            } else {
                const deduped = [nextState.guideModelPath]
                    .concat(nextState.guideModelPoolPaths.filter((one) => path.resolve(one) !== path.resolve(nextState.guideModelPath)));
                nextState.guideModelPoolPaths = deduped.slice(0, args.selfplayPolicyModelPoolSize);
            }
        }
    }

    // Guide advancement and checkpoint carry-over are intentionally decoupled:
    // some promoted-only lanes still accumulate candidate state, while others
    // keep both guide and resume checkpoint fixed until a promotion succeeds.
    const carryOverCheckpointMode = args.carryOverCheckpointMode === 'promoted-only'
        ? 'promoted-only'
        : 'always';
    const shouldCarryOverCheckpoint = !!args.carryOverCheckpoint
        && (carryOverCheckpointMode !== 'promoted-only' || !!result.promoted);
    if (!!args.carryOverCheckpoint && carryOverCheckpointMode === 'promoted-only' && !result.promoted) {
        nextState.checkpointCarryOverSkipped = true;
    }
    if (shouldCarryOverCheckpoint) {
        for (const spec of TRAINING_CHECKPOINT_HEAD_SPECS) {
            const checkpointPath = result.paths[spec.resultPathKey];
            if (checkpointPath && fs.existsSync(checkpointPath)) {
                nextState.resumeCheckpointPaths[spec.head] = checkpointPath;
            }
        }
        nextState.resumeCheckpointPath = getPrimaryResumeCheckpointPath(nextState.resumeCheckpointPaths);
    }

    return nextState;
}

function runIteration(args, iterationIndex, deadlineMs, carryOver) {
    const seedBank = args.seedBankPath
        ? Object.assign(loadSeedBank(args.seedBankPath), { __filePath: args.seedBankPath })
        : null;
    const seed = args.seed + ((iterationIndex - 1) * args.seedStride);
    const evalSeed = seed + args.evalSeedOffset;
    const selfplayCardUsageRate = resolveSelfplayCardUsageRateForIteration(args, iterationIndex);
    const p = buildIterationPaths(args, iterationIndex);
    const steps = [];
    const guideModelPath = carryOver && carryOver.guideModelPath ? carryOver.guideModelPath : null;
    const guideModelPoolPaths = carryOver && Array.isArray(carryOver.guideModelPoolPaths)
        ? carryOver.guideModelPoolPaths.filter((one) => !!one)
        : [];
    const resumeCheckpointPaths = resolveCarryOverResumeCheckpointPaths(carryOver);
    const policyResumeCheckpointPath = resumeCheckpointPaths.policy;
    const cardResumeCheckpointPath = resumeCheckpointPaths.card;
    const targetResumeCheckpointPath = resumeCheckpointPaths.target;
    const valueResumeCheckpointPath = resumeCheckpointPaths.value;
    const anchorModelPath = carryOver && carryOver.anchorModelPath ? carryOver.anchorModelPath : null;
    const gateControl = resolveIterationGateControl(args, iterationIndex, guideModelPath, anchorModelPath);
    const generateCardArgs = args.allowCardUsage
        ? ['--with-cards', '--card-usage-rate', String(selfplayCardUsageRate)]
        : ['--no-cards', '--card-usage-rate', '0'];
    const selfplayDiversityArgs = [
        '--policy-mix-rate', String(args.selfplayPolicyMixRate),
        '--policy-pool-sampling', String(args.selfplayPolicyPoolSampling),
        '--policy-pool-recency-decay', String(args.selfplayPolicyPoolRecencyDecay),
        '--policy-current-anchor-rate', String(args.selfplayPolicyCurrentAnchorRate),
        '--card-usage-rate-jitter', String(args.selfplayCardUsageRateJitter),
        '--tactical-weight-min', String(args.selfplayTacticalWeightMin),
        '--tactical-weight-max', String(args.selfplayTacticalWeightMax),
        '--tactical-depth-opening', String(args.selfplayTacticalDepthOpening),
        '--tactical-depth-mid', String(args.selfplayTacticalDepthMid),
        '--tactical-depth-end', String(args.selfplayTacticalDepthEnd),
        '--tactical-beam-width', String(args.selfplayTacticalBeamWidth),
        '--teacher-committee-weight-min', String(args.selfplayTeacherCommitteeWeightMin),
        '--teacher-committee-weight-max', String(args.selfplayTeacherCommitteeWeightMax),
        '--teacher-committee-consensus-bonus-min', String(args.selfplayTeacherCommitteeConsensusBonusMin),
        '--teacher-committee-consensus-bonus-max', String(args.selfplayTeacherCommitteeConsensusBonusMax),
        '--policy-score-weight-min', String(args.selfplayPolicyScoreWeightMin),
        '--policy-score-weight-max', String(args.selfplayPolicyScoreWeightMax),
        '--heuristic-weight-min', String(args.selfplayHeuristicWeightMin),
        '--heuristic-weight-max', String(args.selfplayHeuristicWeightMax)
    ];
    const guideModelArgs = [];
    if (guideModelPath) {
        guideModelArgs.push('--policy-model', guideModelPath);
    }
    if (guideModelPoolPaths.length > 0) {
        guideModelArgs.push('--policy-model-pool', guideModelPoolPaths.join(','));
    }
    const adoptionBaselineArgs = gateControl.baselineModelPath
        ? ['--baseline-model', gateControl.baselineModelPath]
        : [];
    const verboseArgs = args.verbose ? ['--verbose'] : [];
    const selfplayResumeArgs = args.selfplayResumeChunkSize > 0
        ? ['--resume-chunk-size', String(args.selfplayResumeChunkSize)]
        : [];
    const adoptionCardRate = selfplayCardUsageRate;
    const quickAdoptionThreshold = Number.isFinite(args.quickAdoptionThreshold) ? args.quickAdoptionThreshold : args.threshold;
    const quickAdoptionSeedCount = Number.isFinite(args.quickAdoptionSeedCount) ? args.quickAdoptionSeedCount : args.adoptionSeedCount;
    const quickAdoptionSeedStride = Number.isFinite(args.quickAdoptionSeedStride) ? args.quickAdoptionSeedStride : args.adoptionSeedStride;
    const quickAdoptionConfidenceLevel = Number.isFinite(args.quickAdoptionConfidenceLevel) ? args.quickAdoptionConfidenceLevel : args.adoptionConfidenceLevel;
    const quickAdoptionMinLowerBound = Number.isFinite(args.quickAdoptionMinLowerBound) ? args.quickAdoptionMinLowerBound : args.adoptionMinLowerBound;
    const quickAdoptionMinSeedUplift = Number.isFinite(args.quickAdoptionMinSeedUplift) ? args.quickAdoptionMinSeedUplift : args.adoptionMinSeedUplift;
    const quickAdoptionMinSeedPassCount = Number.isFinite(args.quickAdoptionMinSeedPassCount) ? args.quickAdoptionMinSeedPassCount : args.adoptionMinSeedPassCount;
    const finalAdoptionThreshold = Number.isFinite(args.finalAdoptionThreshold) ? args.finalAdoptionThreshold : args.threshold;
    const finalAdoptionSeedCount = Number.isFinite(args.finalAdoptionSeedCount) ? args.finalAdoptionSeedCount : args.adoptionSeedCount;
    const finalAdoptionSeedStride = Number.isFinite(args.finalAdoptionSeedStride) ? args.finalAdoptionSeedStride : args.adoptionSeedStride;
    const finalAdoptionConfidenceLevel = Number.isFinite(args.finalAdoptionConfidenceLevel) ? args.finalAdoptionConfidenceLevel : args.adoptionConfidenceLevel;
    const finalAdoptionMinLowerBound = Number.isFinite(args.finalAdoptionMinLowerBound) ? args.finalAdoptionMinLowerBound : args.adoptionMinLowerBound;
    const finalAdoptionMinSeedUplift = Number.isFinite(args.finalAdoptionMinSeedUplift) ? args.finalAdoptionMinSeedUplift : args.adoptionMinSeedUplift;
    const finalAdoptionMinSeedPassCount = Number.isFinite(args.finalAdoptionMinSeedPassCount) ? args.finalAdoptionMinSeedPassCount : args.adoptionMinSeedPassCount;
    const quickGateSeedConfig = resolveGateSeedConfig(seedBank, 'quick', {
        seed: seed + args.quickAdoptionSeedOffset,
        seedCount: quickAdoptionSeedCount,
        seedStride: quickAdoptionSeedStride,
        seedList: buildSeedList(seed + args.quickAdoptionSeedOffset, quickAdoptionSeedCount, quickAdoptionSeedStride)
    });
    const qualityGateSeedConfig = resolveGateSeedConfig(seedBank, 'quality', {
        seed: seed + args.qualityGateSeedOffset,
        seedCount: args.qualityGateSeedCount,
        seedStride: args.qualityGateSeedStride,
        seedList: buildSeedList(seed + args.qualityGateSeedOffset, args.qualityGateSeedCount, args.qualityGateSeedStride)
    });
    const finalGateSeedConfig = resolveGateSeedConfig(seedBank, 'final', {
        seed: seed + args.adoptionFinalSeedOffset,
        seedCount: finalAdoptionSeedCount,
        seedStride: finalAdoptionSeedStride,
        seedList: buildSeedList(seed + args.adoptionFinalSeedOffset, finalAdoptionSeedCount, finalAdoptionSeedStride)
    });
    const onnxGateSeedConfig = resolveGateSeedConfig(seedBank, 'onnx', {
        seed: seed + args.onnxGateSeedOffset,
        seedCount: args.onnxGateSeedCount,
        seedStride: args.onnxGateSeedStride,
        seedList: buildSeedList(seed + args.onnxGateSeedOffset, args.onnxGateSeedCount, args.onnxGateSeedStride)
    });
    const quickAdoptionSeed = quickGateSeedConfig.seed;
    const quickAdoptionSeeds = quickGateSeedConfig.seedList;
    const qualityGateSeed = qualityGateSeedConfig.seed;
    const qualityGateSeeds = qualityGateSeedConfig.seedList;
    const finalAdoptionSeed = finalGateSeedConfig.seed;
    const finalAdoptionSeeds = finalGateSeedConfig.seedList;
    const onnxGateSeed = onnxGateSeedConfig.seed;
    const onnxGateSeeds = onnxGateSeedConfig.seedList;

    fs.mkdirSync(args.runsDir, { recursive: true });
    fs.mkdirSync(args.modelsDir, { recursive: true });

    const runStep = (name, cmd, stepArgs, options) => {
        const remainingMs = getRemainingMs(deadlineMs);
        if (Number.isFinite(remainingMs) && remainingMs <= 0) {
            const err = new Error(`time budget exceeded before ${name}`);
            err.code = 'TIME_BUDGET_EXCEEDED';
            throw err;
        }
        try {
            const result = runCommand(cmd, stepArgs, Object.assign({}, options || {}, {
                timeoutMs: Number.isFinite(remainingMs) ? remainingMs : undefined
            }));
            steps.push({ name, ...result });
            return result;
        } catch (error) {
            throw annotateTrainingCycleError(error, {
                iteration: iterationIndex,
                step: name,
                runTag: args.runTag,
                iterationTag: p.tag,
                summaryOut: args.summaryOut,
                stepOutputs: options && Array.isArray(options.reuseOutputs) ? options.reuseOutputs : []
            });
        }
    };

    const runManagedStep = (name, cmd, stepArgs, options) => {
        const reuseOutputs = options && Array.isArray(options.reuseOutputs)
            ? options.reuseOutputs.filter((one) => !!one)
            : [];
        if (shouldReuseStepArtifacts(args, name) && reuseOutputs.length > 0 && reuseOutputs.every(fileExists)) {
            console.log(`[training-cycle] reuse ${name}: ${reuseOutputs.map((one) => path.basename(one)).join(', ')}`);
            const reusedResult = { status: 0, elapsedMs: 0, reused: true };
            steps.push({ name, ...reusedResult });
            return reusedResult;
        }
        return runStep(name, cmd, stepArgs, options);
    };
    const recordSkippedStep = (name, reason, extra) => {
        const result = Object.assign({
            name,
            status: 0,
            elapsedMs: 0,
            skipped: true,
            reason
        }, extra || {});
        steps.push(result);
        return result;
    };

    runManagedStep('generate-train', process.execPath, buildGenerateSelfplayDataArgs({
        games: args.trainGames,
        seed,
        maxPlies: args.maxPlies,
        outPath: p.trainDataPath,
        hardcaseOutPath: p.trainHardcaseDataPath,
        seedFamily: 'train',
        dataLane: 'train-main',
        selfplayJobs: args.selfplayJobs,
        generateCardArgs,
        selfplayDiversityArgs,
        guideModelArgs,
        selfplayResumeArgs,
        reuseCompletedChunks: shouldReuseStepArtifacts(args, 'generate-train'),
        verboseArgs
    }), {
        reuseOutputs: [p.trainDataPath, p.trainHardcaseDataPath, p.trainDataSummaryPath]
    });

    runManagedStep('generate-eval', process.execPath, buildGenerateSelfplayDataArgs({
        games: args.evalGames,
        seed: evalSeed,
        maxPlies: args.maxPlies,
        outPath: p.evalDataPath,
        hardcaseOutPath: p.evalHardcaseDataPath,
        seedFamily: 'eval',
        dataLane: 'eval-suite',
        selfplayJobs: args.selfplayJobs,
        generateCardArgs,
        selfplayDiversityArgs,
        guideModelArgs,
        selfplayResumeArgs,
        reuseCompletedChunks: shouldReuseStepArtifacts(args, 'generate-eval'),
        verboseArgs
    }), {
        reuseOutputs: [p.evalDataPath, p.evalHardcaseDataPath, p.evalDataSummaryPath]
    });

    runManagedStep('train-policy', args.pythonPath, buildPolicyTrainingCommandArgs({
        args,
        iterationPaths: p,
        resumeCheckpointPath: policyResumeCheckpointPath
    }), {
        reuseOutputs: [p.onnxModelPath, p.onnxMetaPath, p.candidateModelPath]
    });

    runManagedStep('evaluate-policy', args.pythonPath, [
        path.resolve('ai', 'train', 'evaluate_policy_table.py'),
        '--input', p.evalDataPath,
        '--model', p.candidateModelPath
    ], {
        reuseOutputs: [p.candidateModelPath]
    });

    const trainCardThisIteration = args.allowCardUsage && shouldRunPeriodicTraining(iterationIndex, args.trainCardEvery);
    if (args.allowCardUsage) {
        if (trainCardThisIteration) {
            runManagedStep('train-card-policy', args.pythonPath, buildCardTrainingCommandArgs({
                args,
                iterationPaths: p,
                resumeCheckpointPath: cardResumeCheckpointPath
            }), {
                reuseOutputs: [p.cardOnnxModelPath, p.cardOnnxMetaPath]
            });
        } else {
            console.log(`[training-cycle] skip train-card-policy iteration=${iterationIndex} cadence_every=${args.trainCardEvery}`);
            recordSkippedStep('train-card-policy', 'cadence', { every: args.trainCardEvery });
        }
    }

    const hasTargetTrainingData = args.trainTargetHeadEnabled !== false
        && args.allowCardUsage
        && hasCoordinatePendingSelectionRecords(p.trainDataPath);
    const trainTargetThisIteration = hasTargetTrainingData && shouldRunPeriodicTraining(iterationIndex, args.trainTargetEvery);
    if (args.trainTargetHeadEnabled === false) {
        console.log(`[training-cycle] skip train-target-policy iteration=${iterationIndex} reason=disabled`);
        recordSkippedStep('train-target-policy', 'disabled', { trainTargetHeadEnabled: false });
    } else if (hasTargetTrainingData) {
        if (trainTargetThisIteration) {
            runManagedStep('train-target-policy', args.pythonPath, buildTargetTrainingCommandArgs({
                args,
                iterationPaths: p,
                resumeCheckpointPath: targetResumeCheckpointPath
            }), {
                reuseOutputs: [p.targetOnnxModelPath, p.targetOnnxMetaPath]
            });
        } else {
            console.log(`[training-cycle] skip train-target-policy iteration=${iterationIndex} cadence_every=${args.trainTargetEvery}`);
            recordSkippedStep('train-target-policy', 'cadence', { every: args.trainTargetEvery });
        }
    }

    const trainValueThisIteration = shouldRunPeriodicTraining(iterationIndex, args.trainValueEvery);
    if (args.trainValueHeadEnabled === false) {
        console.log(`[training-cycle] skip train-value-policy iteration=${iterationIndex} reason=disabled`);
        recordSkippedStep('train-value-policy', 'disabled', { trainValueHeadEnabled: false });
    } else if (trainValueThisIteration) {
        runManagedStep('train-value-policy', args.pythonPath, buildValueTrainingCommandArgs({
            args,
            iterationPaths: p,
            resumeCheckpointPath: valueResumeCheckpointPath
        }), {
            reuseOutputs: [p.valueOnnxModelPath, p.valueOnnxMetaPath]
        });
    } else {
        console.log(`[training-cycle] skip train-value-policy iteration=${iterationIndex} cadence_every=${args.trainValueEvery}`);
        recordSkippedStep('train-value-policy', 'cadence', { every: args.trainValueEvery });
    }

    let quickPayload = null;
    let quickPassed = false;
    let quickDecision = null;
    let quickUplift = Number.NEGATIVE_INFINITY;
    let quickUpliftLowerBound = Number.NEGATIVE_INFINITY;
    let quickRegressionWithinOnnxPrimaryLimit = false;
    let quickCoreDelta = Number.NEGATIVE_INFINITY;
    let quickWhiteDelta = Number.NEGATIVE_INFINITY;
    let quickQualityDelta = Number.NEGATIVE_INFINITY;
    let quickNonRegressionWithinOnnxPrimaryLimit = false;
    let qualityGatePayload = null;
    let qualityGatePassed = !args.qualityGateEnabled;
    let finalPayload = null;
    let finalPassed = false;
    let onnxGatePayload = null;
    let onnxGatePassed = !args.onnxGateEnabled;

    if (gateControl.gateIterationAllowed) {
        const quickStep = runManagedStep('adoption-quick', process.execPath, buildQuickAdoptionCommandArgs({
            args,
            iterationPaths: p,
            quickConfig: {
                seed: quickAdoptionSeed,
                seedCount: quickGateSeedConfig.seedCount,
                seedStride: quickGateSeedConfig.seedStride,
                threshold: quickAdoptionThreshold,
                confidenceLevel: quickAdoptionConfidenceLevel,
                minLowerBound: quickAdoptionMinLowerBound,
                minSeedUplift: quickAdoptionMinSeedUplift,
                minSeedPassCount: quickAdoptionMinSeedPassCount
            },
            adoptionCardRate,
            adoptionBaselineArgs,
            verboseArgs
        }), {
            allowExitCodes: [0, 2],
            reuseOutputs: [p.quickAdoptionPath]
        });
        recordSeedBankGateUsage(seedBank, 'quick', p.quickAdoptionPath, iterationIndex, args.runTag, !!quickStep.reused);
        quickPayload = readJsonSafe(p.quickAdoptionPath);
        quickPassed = !!(quickPayload && quickPayload.decision && quickPayload.decision.passed);
        quickDecision = quickPayload && quickPayload.decision ? quickPayload.decision : null;
        quickUplift = quickDecision && Number.isFinite(quickDecision.uplift)
            ? Number(quickDecision.uplift)
            : Number.NEGATIVE_INFINITY;
        quickUpliftLowerBound = quickDecision && Number.isFinite(quickDecision.upliftLowerBound)
            ? Number(quickDecision.upliftLowerBound)
            : Number.NEGATIVE_INFINITY;
        quickRegressionWithinOnnxPrimaryLimit = quickUplift >= (-args.onnxPrimaryMaxQuickRegression);
        quickCoreDelta = resolveQuickComponentDelta(
            quickPayload,
            quickDecision,
            'baselineCoreScore',
            'candidateCoreScore'
        );
        quickWhiteDelta = resolveQuickComponentDelta(
            quickPayload,
            quickDecision,
            'baselineWhiteScore',
            'candidateWhiteScore'
        );
        quickQualityDelta = resolveQuickComponentDelta(
            quickPayload,
            quickDecision,
            'baselineQualityScore',
            'candidateQualityScore'
        );
        quickNonRegressionWithinOnnxPrimaryLimit =
            quickCoreDelta >= args.onnxPrimaryMinQuickCoreDelta &&
            quickWhiteDelta >= args.onnxPrimaryMinQuickWhiteDelta &&
            quickQualityDelta >= args.onnxPrimaryMinQuickQualityDelta;

        qualityGatePassed = !args.qualityGateEnabled;
        if (quickPassed && args.qualityGateEnabled) {
            const qualityStep = runManagedStep('adoption-quality-gate', process.execPath, buildQualityGateCommandArgs({
                args,
                iterationPaths: p,
                qualityConfig: {
                    seed: qualityGateSeed,
                    seedCount: qualityGateSeedConfig.seedCount,
                    seedStride: qualityGateSeedConfig.seedStride
                },
                adoptionCardRate,
                adoptionBaselineArgs,
                verboseArgs
            }), {
                allowExitCodes: [0, 2],
                reuseOutputs: [p.qualityGatePath]
            });
            recordSeedBankGateUsage(seedBank, 'quality', p.qualityGatePath, iterationIndex, args.runTag, !!qualityStep.reused);
            qualityGatePayload = readJsonSafe(p.qualityGatePath);
            qualityGatePassed = !!(qualityGatePayload && qualityGatePayload.decision && qualityGatePayload.decision.passed);
        }

        const shouldRunFinalAdoption = quickPassed && qualityGatePassed && args.promotionMode === 'strict';
        if (shouldRunFinalAdoption) {
            const finalStep = runManagedStep('adoption-final', process.execPath, buildFinalAdoptionCommandArgs({
                args,
                iterationPaths: p,
                finalConfig: {
                    seed: finalAdoptionSeed,
                    seedCount: finalGateSeedConfig.seedCount,
                    seedStride: finalGateSeedConfig.seedStride,
                    threshold: finalAdoptionThreshold,
                    confidenceLevel: finalAdoptionConfidenceLevel,
                    minLowerBound: finalAdoptionMinLowerBound,
                    minSeedUplift: finalAdoptionMinSeedUplift,
                    minSeedPassCount: finalAdoptionMinSeedPassCount
                },
                adoptionCardRate,
                adoptionBaselineArgs,
                verboseArgs
            }), {
                allowExitCodes: [0, 2],
                reuseOutputs: [p.finalAdoptionPath]
            });
            recordSeedBankGateUsage(seedBank, 'final', p.finalAdoptionPath, iterationIndex, args.runTag, !!finalStep.reused);
            finalPayload = readJsonSafe(p.finalAdoptionPath);
            finalPassed = !!(finalPayload && finalPayload.decision && finalPayload.decision.passed);
        }

        onnxGatePassed = !args.onnxGateEnabled;
        const shouldRunOnnxGate = args.onnxGateEnabled && qualityGatePassed && (finalPassed || args.promotionMode === 'onnx-primary');
        if (shouldRunOnnxGate) {
            const onnxStep = runManagedStep('adoption-onnx-gate', process.execPath, buildOnnxGateCommandArgs({
                args,
                iterationPaths: p,
                hasTargetTrainingData,
                onnxConfig: {
                    seed: onnxGateSeed,
                    seedCount: onnxGateSeedConfig.seedCount,
                    seedStride: onnxGateSeedConfig.seedStride
                }
            }), {
                allowExitCodes: [0, 2],
                reuseOutputs: [p.onnxGatePath]
            });
            recordSeedBankGateUsage(seedBank, 'onnx', p.onnxGatePath, iterationIndex, args.runTag, !!onnxStep.reused);
            onnxGatePayload = readJsonSafe(p.onnxGatePath);
            onnxGatePassed = !!(onnxGatePayload && onnxGatePayload.decision && onnxGatePayload.decision.passed);
        }
    }

    const onnxGateDecision = onnxGatePayload && onnxGatePayload.decision ? onnxGatePayload.decision : null;
    const promotionEligibility = resolvePromotionEligibility(args, {
        quickPassed,
        qualityGatePassed,
        finalPassed,
        onnxGatePassed,
        quickRegressionWithinOnnxPrimaryLimit,
        quickNonRegressionWithinOnnxPrimaryLimit,
        quickUplift,
        quickUpliftLowerBound,
        onnxGateDecision
    });
    const promoteEligible = promotionEligibility.promoteEligible;
    const strictPromoteEligible = promotionEligibility.strictPromoteEligible;
    const onnxPrimaryPromoteEligible = promotionEligibility.onnxPrimaryPromoteEligible;
    const quickOnlyPromoteEligible = promotionEligibility.quickOnlyPromoteEligible;
    const onnxPrimaryQuickGuardPassed = promotionEligibility.onnxPrimaryQuickGuardPassed;
    const onnxPrimaryQuickNonRegressionGuardPassed = promotionEligibility.onnxPrimaryQuickNonRegressionGuardPassed;
    const onnxPrimaryQuickUpliftGuardPassed = promotionEligibility.onnxPrimaryQuickUpliftGuardPassed;
    const onnxPrimaryQuickLowerBoundGuardPassed = promotionEligibility.onnxPrimaryQuickLowerBoundGuardPassed;
    const onnxPrimaryOnnxGateAvgGuardPassed = promotionEligibility.onnxPrimaryOnnxGateAvgGuardPassed;
    const onnxPrimaryOnnxGateMinSeedGuardPassed = promotionEligibility.onnxPrimaryOnnxGateMinSeedGuardPassed;
    const onnxGateAverageScore = promotionEligibility.onnxGateAverageScore;
    const onnxGateMinSeedScore = promotionEligibility.onnxGateMinSeedScore;

    let promoted = false;
    if (promoteEligible && args.promoteOnPass) {
        const adoptionResultPath = (args.promotionMode !== 'strict' && !finalPassed)
            ? p.quickAdoptionPath
            : p.finalAdoptionPath;
        const promoteArgs = buildPromotionCommandArgs(args, p, adoptionResultPath, hasTargetTrainingData);
        if (args.promotionMode === 'onnx-primary' && !finalPassed) {
            promoteArgs.push('--force');
        }
        runStep('promote-model', process.execPath, promoteArgs);
        promoted = true;
    }

    const iterationResult = {
        iteration: iterationIndex,
        seed,
        quickAdoptionSeed,
        qualityGateSeed,
        finalAdoptionSeed,
        onnxGateSeed,
        evalSeed,
        usedGuideModelPath: guideModelPath,
        usedGuideModelPoolPaths: guideModelPoolPaths,
        usedResumeCheckpointPath: policyResumeCheckpointPath,
        usedResumeCheckpointPaths: cloneResumeCheckpointPaths(resumeCheckpointPaths),
        usedAnchorModelPath: anchorModelPath,
        seedBankPath: args.seedBankPath,
        seedBankId: seedBank && seedBank.bankId ? seedBank.bankId : null,
        usedSelfplayCardUsageRate: selfplayCardUsageRate,
        gateControl,
        paths: p,
        quickAdoptionConfig: {
            seed: quickAdoptionSeed,
            seedOffset: args.quickAdoptionSeedOffset,
            seedList: quickAdoptionSeeds,
            seedSource: quickGateSeedConfig.source,
            seedBankId: quickGateSeedConfig.bankId,
            seedBankPath: quickGateSeedConfig.bankPath,
            seedPurpose: quickGateSeedConfig.purpose,
            cardUsageRate: adoptionCardRate,
            threshold: quickAdoptionThreshold,
            tacticalWeight: args.adoptionTacticalWeight,
            seedCount: quickAdoptionSeedCount,
            seedStride: quickAdoptionSeedStride,
            confidenceLevel: quickAdoptionConfidenceLevel,
            minLowerBound: quickAdoptionMinLowerBound,
            minSeedUplift: quickAdoptionMinSeedUplift,
            minSeedPassCount: quickAdoptionMinSeedPassCount
        },
        qualityGateConfig: {
            enabled: args.qualityGateEnabled,
            games: args.qualityGateGames,
            seed: qualityGateSeed,
            seedOffset: args.qualityGateSeedOffset,
            seedCount: args.qualityGateSeedCount,
            seedStride: args.qualityGateSeedStride,
            seedList: qualityGateSeeds,
            seedSource: qualityGateSeedConfig.source,
            seedBankId: qualityGateSeedConfig.bankId,
            seedBankPath: qualityGateSeedConfig.bankPath,
            seedPurpose: qualityGateSeedConfig.purpose,
            cardUsageRate: adoptionCardRate,
            threshold: args.qualityGateThreshold,
            tacticalWeight: args.adoptionTacticalWeight,
            confidenceLevel: args.qualityGateConfidenceLevel,
            minLowerBound: args.qualityGateMinLowerBound,
            minSeedUplift: args.qualityGateMinSeedUplift,
            minSeedPassCount: args.qualityGateMinSeedPassCount,
            strengthFirst: args.qualityGateStrengthFirst
        },
        finalAdoptionConfig: {
            seed: finalAdoptionSeed,
            seedOffset: args.adoptionFinalSeedOffset,
            seedList: finalAdoptionSeeds,
            seedSource: finalGateSeedConfig.source,
            seedBankId: finalGateSeedConfig.bankId,
            seedBankPath: finalGateSeedConfig.bankPath,
            seedPurpose: finalGateSeedConfig.purpose,
            cardUsageRate: adoptionCardRate,
            threshold: finalAdoptionThreshold,
            tacticalWeight: args.adoptionTacticalWeight,
            seedCount: finalAdoptionSeedCount,
            seedStride: finalAdoptionSeedStride,
            confidenceLevel: finalAdoptionConfidenceLevel,
            minLowerBound: finalAdoptionMinLowerBound,
            minSeedUplift: finalAdoptionMinSeedUplift,
            minSeedPassCount: finalAdoptionMinSeedPassCount
        },
        onnxGateConfig: {
            enabled: args.onnxGateEnabled,
            games: args.onnxGateGames,
            seed: onnxGateSeed,
            seedOffset: args.onnxGateSeedOffset,
            seedCount: args.onnxGateSeedCount,
            seedStride: args.onnxGateSeedStride,
            seedList: onnxGateSeeds,
            seedSource: onnxGateSeedConfig.source,
            seedBankId: onnxGateSeedConfig.bankId,
            seedBankPath: onnxGateSeedConfig.bankPath,
            seedPurpose: onnxGateSeedConfig.purpose,
            threshold: args.onnxGateThreshold,
            minSeedScore: args.onnxGateMinSeedScore,
            minSeedPassCount: args.onnxGateMinSeedPassCount,
            maxAverageLatencyMs: args.onnxGateMaxAverageLatencyMs,
            maxP95LatencyMs: args.onnxGateMaxP95LatencyMs,
            maxMaxLatencyMs: args.onnxGateMaxMaxLatencyMs,
            blackLevel: args.onnxGateBlackLevel,
            whiteLevel: args.onnxGateWhiteLevel,
            candidateColorMode: args.onnxGateCandidateColorMode
        },
        quickDecision,
        qualityGateDecision: qualityGatePayload && qualityGatePayload.decision ? qualityGatePayload.decision : null,
        finalDecision: finalPayload && finalPayload.decision ? finalPayload.decision : null,
        onnxGateDecision: onnxGatePayload && onnxGatePayload.decision ? onnxGatePayload.decision : null,
        hasTargetTrainingData,
        specialistTraining: {
            card: {
                enabled: args.allowCardUsage,
                every: args.trainCardEvery,
                executed: trainCardThisIteration
            },
            target: {
                enabled: args.trainTargetHeadEnabled !== false,
                dataAvailable: hasTargetTrainingData,
                every: args.trainTargetEvery,
                executed: args.trainTargetHeadEnabled !== false && trainTargetThisIteration
            },
            value: {
                enabled: args.trainValueHeadEnabled !== false,
                every: args.trainValueEvery,
                executed: args.trainValueHeadEnabled !== false && trainValueThisIteration
            }
        },
        promotionDetail: {
            mode: args.promotionMode,
            promoteEligible,
            strictPromoteEligible,
            onnxPrimaryPromoteEligible,
            quickOnlyPromoteEligible,
            gateIterationAllowed: gateControl.gateIterationAllowed,
            qualityGateEnabled: args.qualityGateEnabled,
            qualityGatePassed,
            quickUplift,
            onnxPrimaryMaxQuickRegression: args.onnxPrimaryMaxQuickRegression,
            onnxPrimaryRequireQuickRegression: args.onnxPrimaryRequireQuickRegression,
            onnxPrimaryRequireQuickNonRegression: args.onnxPrimaryRequireQuickNonRegression,
            onnxPrimaryMinQuickCoreDelta: args.onnxPrimaryMinQuickCoreDelta,
            onnxPrimaryMinQuickWhiteDelta: args.onnxPrimaryMinQuickWhiteDelta,
            onnxPrimaryMinQuickQualityDelta: args.onnxPrimaryMinQuickQualityDelta,
            onnxPrimaryMinQuickUplift: args.onnxPrimaryMinQuickUplift,
            onnxPrimaryMinQuickLowerBound: args.onnxPrimaryMinQuickLowerBound,
            onnxPrimaryMinOnnxGateAvg: args.onnxPrimaryMinOnnxGateAvg,
            onnxPrimaryMinOnnxGateMinSeed: args.onnxPrimaryMinOnnxGateMinSeed,
            onnxPrimaryQuickGuardPassed,
            quickRegressionWithinOnnxPrimaryLimit,
            onnxPrimaryQuickNonRegressionGuardPassed,
            onnxPrimaryQuickUpliftGuardPassed,
            onnxPrimaryQuickLowerBoundGuardPassed,
            onnxPrimaryOnnxGateAvgGuardPassed,
            onnxPrimaryOnnxGateMinSeedGuardPassed,
            quickCoreDelta,
            quickWhiteDelta,
            quickQualityDelta,
            quickNonRegressionWithinOnnxPrimaryLimit,
            quickUpliftLowerBound,
            onnxGateAverageScore,
            onnxGateMinSeedScore
        },
        promoted,
        warehouseManifest: {
            schemaVersion: TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION,
            path: p.warehouseManifestPath
        },
        steps
    };
    const warehouseManifest = buildIterationWarehouseManifest(args, iterationResult);
    writeTrainingWarehouseManifest(p.warehouseManifestPath, warehouseManifest);
    return iterationResult;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    console.log(`[training-cycle] selfplay guide update mode=${args.selfplayUsePromotedModelOnly ? 'promoted-only' : 'candidate-every-iteration'}`);
    console.log(`[training-cycle] adoption baseline mode=${resolveAdoptionBaselineMode(args)} gate_final_iteration_only=${args.gateFinalIterationOnly ? 'on' : 'off'}`);
    console.log(`[training-cycle] reuse existing artifacts=${args.reuseExistingArtifacts ? 'on' : 'off'}`);
    console.log(`[training-cycle] target head=${args.trainTargetHeadEnabled ? 'on' : 'off'} cadence_every=${args.trainTargetEvery}`);
    console.log(`[training-cycle] value head=${args.trainValueHeadEnabled ? 'on' : 'off'} cadence_every=${args.trainValueEvery}`);
    if (args.restartFromStep) {
        console.log(`[training-cycle] restart from step=${args.restartFromStep}`);
    }
    console.log(
        `[training-cycle] promotion mode=${args.promotionMode} ` +
        `onnx_primary_max_quick_regression=${args.onnxPrimaryMaxQuickRegression} ` +
        `onnx_primary_require_quick_regression=${args.onnxPrimaryRequireQuickRegression} ` +
        `onnx_primary_require_quick_non_regression=${args.onnxPrimaryRequireQuickNonRegression} ` +
        `onnx_primary_min_quick_core_delta=${args.onnxPrimaryMinQuickCoreDelta} ` +
        `onnx_primary_min_quick_white_delta=${args.onnxPrimaryMinQuickWhiteDelta} ` +
        `onnx_primary_min_quick_quality_delta=${args.onnxPrimaryMinQuickQualityDelta} ` +
        `onnx_primary_min_quick_uplift=${args.onnxPrimaryMinQuickUplift} ` +
        `onnx_primary_min_quick_lower_bound=${args.onnxPrimaryMinQuickLowerBound} ` +
        `onnx_primary_min_onnx_gate_avg=${args.onnxPrimaryMinOnnxGateAvg} ` +
        `onnx_primary_min_onnx_gate_min_seed=${args.onnxPrimaryMinOnnxGateMinSeed}`
    );
    const warehouseCleanup = cleanupWarehouseSelfplayArtifacts(args.runsDir);
    if (warehouseCleanup.removed.length > 0) {
        console.log(
            `[training-cycle] cleaned historical selfplay artifacts=${warehouseCleanup.removed.length} ` +
            `reclaimed=${warehouseCleanup.totalBytesRemovedHuman}`
        );
    }
    if (warehouseCleanup.failed.length > 0) {
        for (const failure of warehouseCleanup.failed) {
            console.warn(`[training-cycle] cleanup warning path=${failure.path} error=${failure.error}`);
        }
    }

    const startedAt = Date.now();
    const deadlineMs = args.maxHours > 0
        ? startedAt + Math.floor(args.maxHours * 60 * 60 * 1000)
        : null;
    const iterations = [];
    let guideModelPath = args.bootstrapPolicyModelPath || null;
    let guideModelPoolPaths = buildInitialGuideModelPoolPaths(
        args.modelsDir,
        guideModelPath,
        args.selfplayPolicyModelPoolSize,
        {
            includeCandidateFiles: !args.selfplayUsePromotedModelOnly,
            includeArchiveFiles: !!args.selfplayUsePromotedModelOnly
        }
    );
    let resumeCheckpointPaths = cloneResumeCheckpointPaths(args.resumeCheckpointPaths);
    let anchorModelPath = guideModelPath || null;
    if (resolveAdoptionBaselineMode(args) === 'anchor' && !anchorModelPath) {
        throw new Error('--adoption-use-anchor-baseline requires an initial bootstrap policy model');
    }
    let stoppedByTimeBudget = false;
    let stopReason = null;
    let failureDetail = null;
    for (let i = 1; i <= args.iterations; i++) {
        const remainingMs = getRemainingMs(deadlineMs);
        if (remainingMs !== null && remainingMs <= 0) {
            stoppedByTimeBudget = true;
            stopReason = `time budget reached before iteration ${i}`;
            break;
        }
        console.log(`[training-cycle] iteration ${i}/${args.iterations} start`);
        let result = null;
        try {
            result = runIteration(args, i, deadlineMs, {
                guideModelPath,
                guideModelPoolPaths,
                resumeCheckpointPaths,
                anchorModelPath
            });
        } catch (err) {
            if (err && (err.code === 'TIME_BUDGET_EXCEEDED' || err.code === 'COMMAND_TIMEOUT')) {
                stoppedByTimeBudget = true;
                stopReason = err.message || 'time budget reached';
                break;
            }
            failureDetail = extractTrainingCycleFailureDetail(err, {
                iteration: i,
                runTag: args.runTag,
                summaryOut: args.summaryOut
            });
            writeSummarySnapshot(
                args,
                startedAt,
                iterations,
                guideModelPath,
                guideModelPoolPaths,
                resumeCheckpointPaths,
                anchorModelPath,
                stoppedByTimeBudget,
                stopReason,
                failureDetail
            );
            throw err;
        }
        iterations.push(result);
        const finalPassed = !!(result.finalDecision && result.finalDecision.passed);
        const qualityGatePassed = result.qualityGateDecision ? !!result.qualityGateDecision.passed : !args.qualityGateEnabled;
        const onnxGatePassed = result.onnxGateDecision ? !!result.onnxGateDecision.passed : !args.onnxGateEnabled;
        const promoteEligible = !!(result.promotionDetail && result.promotionDetail.promoteEligible);
        const quickUplift = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickUplift))
            ? result.promotionDetail.quickUplift
            : Number.NaN;
        const quickCoreDelta = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickCoreDelta))
            ? result.promotionDetail.quickCoreDelta
            : Number.NaN;
        const quickWhiteDelta = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickWhiteDelta))
            ? result.promotionDetail.quickWhiteDelta
            : Number.NaN;
        const quickQualityDelta = (result.promotionDetail && Number.isFinite(result.promotionDetail.quickQualityDelta))
            ? result.promotionDetail.quickQualityDelta
            : Number.NaN;
        const quickNonRegressionGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryQuickNonRegressionGuardPassed
        );
        const quickUpliftGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryQuickUpliftGuardPassed
        );
        const quickLowerBoundGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryQuickLowerBoundGuardPassed
        );
        const gateAvgGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryOnnxGateAvgGuardPassed
        );
        const gateMinSeedGuard = !!(
            result.promotionDetail &&
            result.promotionDetail.onnxPrimaryOnnxGateMinSeedGuardPassed
        );
        if (result && result.paths) {
            const nextCarryOverState = resolveNextCarryOverState(args, {
                guideModelPath,
                guideModelPoolPaths,
                resumeCheckpointPaths
            }, result);
            guideModelPath = nextCarryOverState.guideModelPath;
            guideModelPoolPaths = nextCarryOverState.guideModelPoolPaths;
            resumeCheckpointPaths = cloneResumeCheckpointPaths(nextCarryOverState.resumeCheckpointPaths);
            if (nextCarryOverState.checkpointCarryOverSkipped) {
                console.log(`[training-cycle] iteration ${i} checkpoint carry-over skipped (promoted-only mode, promoted=false)`);
            }
        }
        if (result && result.paths) {
            const artifactCleanup = cleanupTransientSelfplayArtifacts(result.paths);
            result.artifactCleanup = artifactCleanup;
            if (artifactCleanup.removed.length > 0) {
                console.log(`[training-cycle] iteration ${i} cleaned transient selfplay artifacts=${artifactCleanup.removed.length}`);
            }
            if (artifactCleanup.failed.length > 0) {
                for (const failure of artifactCleanup.failed) {
                    console.warn(`[training-cycle] cleanup failed path=${failure.path} error=${failure.error}`);
                }
            }
        }
        const quickUpliftLabel = Number.isFinite(quickUplift) ? quickUplift.toFixed(3) : 'n/a';
        const quickCoreDeltaLabel = Number.isFinite(quickCoreDelta) ? quickCoreDelta.toFixed(3) : 'n/a';
        const quickWhiteDeltaLabel = Number.isFinite(quickWhiteDelta) ? quickWhiteDelta.toFixed(3) : 'n/a';
        const quickQualityDeltaLabel = Number.isFinite(quickQualityDelta) ? quickQualityDelta.toFixed(3) : 'n/a';
        console.log(`[training-cycle] iteration ${i} done gate_run=${!!(result.gateControl && result.gateControl.gateIterationAllowed)} quick_pass=${!!(result.quickDecision && result.quickDecision.passed)} quality_pass=${qualityGatePassed} final_pass=${finalPassed} onnx_gate_pass=${onnxGatePassed} promote_eligible=${promoteEligible} quick_uplift=${quickUpliftLabel} quick_core_delta=${quickCoreDeltaLabel} quick_white_delta=${quickWhiteDeltaLabel} quick_quality_delta=${quickQualityDeltaLabel} quick_non_regression_guard=${quickNonRegressionGuard} quick_uplift_guard=${quickUpliftGuard} quick_lb_guard=${quickLowerBoundGuard} gate_avg_guard=${gateAvgGuard} gate_min_seed_guard=${gateMinSeedGuard} promoted=${result.promoted}`);
        writeSummarySnapshot(
            args,
            startedAt,
            iterations,
            guideModelPath,
            guideModelPoolPaths,
            resumeCheckpointPaths,
            anchorModelPath,
            stoppedByTimeBudget,
            stopReason,
            failureDetail
        );
    }
    if (stoppedByTimeBudget) {
        console.warn(`[training-cycle] stopped by time budget: ${stopReason}`);
    }
    writeSummarySnapshot(
        args,
        startedAt,
        iterations,
        guideModelPath,
        guideModelPoolPaths,
        resumeCheckpointPaths,
        anchorModelPath,
        stoppedByTimeBudget,
        stopReason,
        failureDetail
    );
    console.log(`[training-cycle] summary: ${args.summaryOut}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[training-cycle] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    TRAINING_CYCLE_STEP_ORDER,
    normalizeRestartFromStep,
    shouldReuseStepArtifacts,
    buildInitialGuideModelPoolPaths,
    buildIterationPaths,
    collectTransientSelfplayArtifactPaths,
    cleanupTransientSelfplayArtifacts,
    hasCoordinatePendingSelectionRecords,
    iterationTag,
    makeRunTag,
    resolveAdoptionBaselineMode,
    shouldRunGateForIteration,
    resolveIterationGateControl,
    resolveSelfplayCardUsageRateForIteration,
    getPrimaryResumeCheckpointPath,
    resolveResumeCheckpointPathsFromArgs,
    resolveNextCarryOverState,
    buildCandidateOnnxBundleArgs,
    buildTargetOnnxBundleArgs,
    buildPromotionTargetBundleArgs,
    buildPromotionCommandArgs,
    resolveGateSeedConfig,
    resolveQuickComponentDelta,
    resolvePromotionEligibility,
    extractTrainingCycleFailureDetail,
    annotateTrainingCycleError
};
