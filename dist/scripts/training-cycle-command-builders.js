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
const path = __importStar(require("path"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function normalizeSpecialistEarlyStopMonitor(monitor) {
    if (monitor === 'val_place_loss')
        return 'val_loss';
    if (monitor === 'train_place_loss')
        return 'train_loss';
    return monitor;
}
function appendResumeArgs(args, resumeCheckpointPath, resumeOptimizer) {
    if (resumeCheckpointPath) {
        args.push('--resume-checkpoint', resumeCheckpointPath);
    }
    if (resumeOptimizer) {
        args.push('--resume-optimizer');
    }
    return args;
}
function isValueHeadEnabled(args) {
    return !(args && args.trainValueHeadEnabled === false);
}
function isTargetHeadEnabled(args) {
    return !(args && args.trainTargetHeadEnabled === false);
}
function buildAdoptionWeightArgs(args, adoptionCardRate) {
    return [
        '--a-rate', String(adoptionCardRate),
        '--b-rate', String(adoptionCardRate),
        '--tactical-weight', String(args.adoptionTacticalWeight),
        '--tactical-depth-opening', String(args.adoptionTacticalDepthOpening),
        '--tactical-depth-mid', String(args.adoptionTacticalDepthMid),
        '--tactical-depth-end', String(args.adoptionTacticalDepthEnd),
        '--tactical-beam-width', String(args.adoptionTacticalBeamWidth),
        '--policy-score-weight', String(args.adoptionPolicyScoreWeight),
        '--heuristic-weight', String(args.adoptionHeuristicWeight),
        '--white-priority', String(args.adoptionWhitePriority),
        '--quality-weight-corner', String(args.adoptionQualityWeightCorner),
        '--quality-weight-edge', String(args.adoptionQualityWeightEdge),
        '--quality-weight-corner-recovery', String(args.adoptionQualityWeightCornerRecovery),
        '--quality-weight-corner-recapture', String(args.adoptionQualityWeightCornerRecapture),
        '--quality-weight-edge-recovery', String(args.adoptionQualityWeightEdgeRecovery),
        '--quality-weight-corner-hold', String(args.adoptionQualityWeightCornerHold),
        '--quality-weight-corner-hold-turns', String(args.adoptionQualityWeightCornerHoldTurns),
        '--quality-weight-edge-hold', String(args.adoptionQualityWeightEdgeHold),
        '--quality-weight-edge-chain', String(args.adoptionQualityWeightEdgeChain),
        '--quality-weight-final-corner-share', String(args.adoptionQualityWeightFinalCornerShare),
        '--quality-weight-final-edge-share', String(args.adoptionQualityWeightFinalEdgeShare),
        '--quality-weight-final-longest-edge-run-share', String(args.adoptionQualityWeightFinalLongestEdgeRunShare),
        '--quality-weight-bonus', String(args.adoptionQualityWeightBonus),
        '--quality-weight-card-immediate', String(args.adoptionQualityWeightCardImmediate),
        '--quality-weight-card-future', String(args.adoptionQualityWeightCardFuture),
        '--quality-weight-place-delta', String(args.adoptionQualityWeightPlaceDelta)
    ];
}
function buildGenerateSelfplayDataArgs(options) {
    return [
        path.resolve('scripts', 'generate-selfplay-data.js'),
        '--games', String(options.games),
        '--seed', String(options.seed),
        '--max-plies', String(options.maxPlies),
        '--out', options.outPath,
        '--seed-family', options.seedFamily,
        '--data-lane', options.dataLane,
        '--jobs', String(options.selfplayJobs)
    ].concat(options.hardcaseOutPath ? ['--hardcase-out', options.hardcaseOutPath] : [], options.generateCardArgs || [], options.selfplayDiversityArgs || [], options.guideModelArgs || [], options.selfplayResumeArgs || [], options.reuseCompletedChunks ? ['--reuse-completed-chunks'] : [], options.verboseArgs || []);
}
function buildPolicyTrainingCommandArgs(options) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    const trainerScript = args.policyTrainerScript || path.resolve('ai', 'train', 'train_policy_onnx.py');
    const trainerName = path.basename(trainerScript).toLowerCase();
    const cnnTrainerArgs = trainerName === 'train_policy_onnx_v2.py' || trainerName === 'train_policy_onnx_v3.py'
        ? [
            '--hidden-channels', String(args.onnxHiddenChannels),
            '--num-res-blocks', String(args.onnxNumResBlocks),
            '--nonvalidity-penalty', String(args.onnxNonvalidityPenalty)
        ].concat(trainerName === 'train_policy_onnx_v2.py' ? ['--history-length', String(args.onnxHistoryLength)] : [])
        : [];
    const baseArgs = [
        trainerScript,
        '--input', iterationPaths.trainDataPath,
        '--onnx-out', iterationPaths.onnxModelPath,
        '--meta-out', iterationPaths.onnxMetaPath,
        '--policy-table-out', iterationPaths.candidateModelPath,
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(args.onnxLr),
        '--hidden-size', String(args.onnxHiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--val-split-mode', String(args.onnxValSplitMode),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-min-epochs', String(args.onnxEarlyStopMinEpochs),
        '--early-stop-monitor', args.onnxEarlyStopMonitor,
        '--early-stop-smoothing-window', String(args.onnxEarlyStopSmoothingWindow),
        '--lr-plateau-patience', String(args.onnxLrPlateauPatience),
        '--lr-plateau-factor', String(args.onnxLrPlateauFactor),
        '--lr-plateau-min-lr', String(args.onnxLrPlateauMinLr),
        '--card-no-action-weight', String(args.onnxCardNoActionWeight),
        '--card-class-balance-power', String(args.onnxCardClassBalancePower),
        '--winner-sample-boost', String(args.onnxWinnerSampleBoost),
        '--loser-sample-weight', String(args.onnxLoserSampleWeight),
        '--draw-sample-weight', String(args.onnxDrawSampleWeight),
        '--corner-emergency-sample-boost', String(args.onnxCornerEmergencySampleBoost),
        '--negative-future-disc-sample-boost', String(args.onnxNegativeFutureDiscSampleBoost),
        '--negative-future-disc-threshold', String(args.onnxNegativeFutureDiscThreshold),
        '--tactical-miss-sample-boost', String(args.onnxTacticalMissSampleBoost),
        '--tactical-miss-threshold', String(args.onnxTacticalMissThreshold),
        '--hand-pressure-sample-boost', String(args.onnxHandPressureSampleBoost),
        '--pending-target-sample-boost', String(args.onnxPendingTargetSampleBoost),
        '--corner-balance-sample-boost', String(args.onnxCornerBalanceSampleBoost),
        '--edge-balance-sample-boost', String(args.onnxEdgeBalanceSampleBoost),
        '--economy-balance-sample-boost', String(args.onnxEconomyBalanceSampleBoost),
        '--metrics-out', iterationPaths.onnxMetricsPath,
        '--min-visits', String(args.minVisits),
        '--shape-immediate', String(args.shapeImmediate),
        '--checkpoint-out', iterationPaths.checkpointPath
    ].concat(cnnTrainerArgs);
    return appendResumeArgs(baseArgs, resumeCheckpointPath, args.onnxResumeOptimizer);
}
function buildCardTrainingCommandArgs(options) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    return appendResumeArgs([
        path.resolve('ai', 'train', 'train_card_onnx.py'),
        '--input', iterationPaths.trainDataPath,
        '--onnx-out', iterationPaths.cardOnnxModelPath,
        '--meta-out', iterationPaths.cardOnnxMetaPath,
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(args.onnxLr),
        '--hidden-size', String(args.onnxHiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--val-split-mode', String(args.onnxValSplitMode),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-min-epochs', String(args.onnxEarlyStopMinEpochs),
        '--early-stop-monitor', normalizeSpecialistEarlyStopMonitor(args.onnxEarlyStopMonitor),
        '--early-stop-smoothing-window', String(args.onnxEarlyStopSmoothingWindow),
        '--lr-plateau-patience', String(args.onnxLrPlateauPatience),
        '--lr-plateau-factor', String(args.onnxLrPlateauFactor),
        '--lr-plateau-min-lr', String(args.onnxLrPlateauMinLr),
        '--card-no-action-weight', String(args.onnxCardNoActionWeight),
        '--card-class-balance-power', String(args.onnxCardClassBalancePower),
        '--winner-sample-boost', String(args.onnxWinnerSampleBoost),
        '--loser-sample-weight', String(args.onnxLoserSampleWeight),
        '--draw-sample-weight', String(args.onnxDrawSampleWeight),
        '--corner-emergency-sample-boost', String(args.onnxCornerEmergencySampleBoost),
        '--negative-future-disc-sample-boost', String(args.onnxNegativeFutureDiscSampleBoost),
        '--negative-future-disc-threshold', String(args.onnxNegativeFutureDiscThreshold),
        '--tactical-miss-sample-boost', String(args.onnxTacticalMissSampleBoost),
        '--tactical-miss-threshold', String(args.onnxTacticalMissThreshold),
        '--hand-pressure-sample-boost', String(args.onnxHandPressureSampleBoost),
        '--pending-target-sample-boost', String(args.onnxPendingTargetSampleBoost),
        '--metrics-out', iterationPaths.cardMetricsPath,
        '--checkpoint-out', iterationPaths.cardCheckpointPath
    ], resumeCheckpointPath, args.onnxResumeOptimizer);
}
function buildTargetTrainingCommandArgs(options) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    return appendResumeArgs([
        path.resolve('ai', 'train', 'train_target_onnx.py'),
        '--input', iterationPaths.trainDataPath,
        '--onnx-out', iterationPaths.targetOnnxModelPath,
        '--meta-out', iterationPaths.targetOnnxMetaPath,
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(args.onnxLr),
        '--hidden-size', String(args.onnxHiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--val-split-mode', String(args.onnxValSplitMode),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-min-epochs', String(args.onnxEarlyStopMinEpochs),
        '--early-stop-monitor', normalizeSpecialistEarlyStopMonitor(args.onnxEarlyStopMonitor),
        '--early-stop-smoothing-window', String(args.onnxEarlyStopSmoothingWindow),
        '--lr-plateau-patience', String(args.onnxLrPlateauPatience),
        '--lr-plateau-factor', String(args.onnxLrPlateauFactor),
        '--lr-plateau-min-lr', String(args.onnxLrPlateauMinLr),
        '--winner-sample-boost', String(args.onnxWinnerSampleBoost),
        '--loser-sample-weight', String(args.onnxLoserSampleWeight),
        '--draw-sample-weight', String(args.onnxDrawSampleWeight),
        '--corner-emergency-sample-boost', String(args.onnxCornerEmergencySampleBoost),
        '--negative-future-disc-sample-boost', String(args.onnxNegativeFutureDiscSampleBoost),
        '--negative-future-disc-threshold', String(args.onnxNegativeFutureDiscThreshold),
        '--tactical-miss-sample-boost', String(args.onnxTacticalMissSampleBoost),
        '--tactical-miss-threshold', String(args.onnxTacticalMissThreshold),
        '--hand-pressure-sample-boost', String(args.onnxHandPressureSampleBoost),
        '--pending-target-sample-boost', String(args.onnxPendingTargetSampleBoost),
        '--metrics-out', iterationPaths.targetMetricsPath,
        '--checkpoint-out', iterationPaths.targetCheckpointPath
    ], resumeCheckpointPath, args.onnxResumeOptimizer);
}
function buildValueTrainingCommandArgs(options) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    const valueLr = Number.isFinite(args.onnxValueLr) ? args.onnxValueLr : args.onnxLr;
    const valueHiddenSize = Number.isFinite(args.onnxValueHiddenSize) ? args.onnxValueHiddenSize : args.onnxHiddenSize;
    return appendResumeArgs([
        path.resolve('ai', 'train', 'train_value_onnx.py'),
        '--input', iterationPaths.trainDataPath,
        '--onnx-out', iterationPaths.valueOnnxModelPath,
        '--meta-out', iterationPaths.valueOnnxMetaPath,
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(valueLr),
        '--hidden-size', String(valueHiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--val-split-mode', String(args.onnxValSplitMode),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-min-epochs', String(args.onnxEarlyStopMinEpochs),
        '--early-stop-monitor', normalizeSpecialistEarlyStopMonitor(args.onnxEarlyStopMonitor),
        '--early-stop-smoothing-window', String(args.onnxEarlyStopSmoothingWindow),
        '--lr-plateau-patience', String(args.onnxLrPlateauPatience),
        '--lr-plateau-factor', String(args.onnxLrPlateauFactor),
        '--lr-plateau-min-lr', String(args.onnxLrPlateauMinLr),
        '--winner-sample-boost', String(args.onnxWinnerSampleBoost),
        '--loser-sample-weight', String(args.onnxLoserSampleWeight),
        '--draw-sample-weight', String(args.onnxDrawSampleWeight),
        '--corner-emergency-sample-boost', String(args.onnxCornerEmergencySampleBoost),
        '--negative-future-disc-sample-boost', String(args.onnxNegativeFutureDiscSampleBoost),
        '--negative-future-disc-threshold', String(args.onnxNegativeFutureDiscThreshold),
        '--tactical-miss-sample-boost', String(args.onnxTacticalMissSampleBoost),
        '--tactical-miss-threshold', String(args.onnxTacticalMissThreshold),
        '--hand-pressure-sample-boost', String(args.onnxHandPressureSampleBoost),
        '--pending-target-sample-boost', String(args.onnxPendingTargetSampleBoost),
        '--corner-balance-sample-boost', String(args.onnxCornerBalanceSampleBoost),
        '--edge-balance-sample-boost', String(args.onnxEdgeBalanceSampleBoost),
        '--economy-balance-sample-boost', String(args.onnxEconomyBalanceSampleBoost),
        '--metrics-out', iterationPaths.valueMetricsPath,
        '--value-target-corner-weight', String(args.onnxValueTargetCornerWeight),
        '--value-target-edge-weight', String(args.onnxValueTargetEdgeWeight),
        '--value-target-economy-weight', String(args.onnxValueTargetEconomyWeight),
        '--value-target-corner-emergency-weight', String(args.onnxValueTargetCornerEmergencyWeight),
        '--checkpoint-out', iterationPaths.valueCheckpointPath
    ], resumeCheckpointPath, args.onnxResumeOptimizer);
}
function buildQuickAdoptionCommandArgs(options) {
    const { args, iterationPaths, quickConfig, adoptionCardRate, adoptionBaselineArgs, verboseArgs } = options;
    return [
        path.resolve('scripts', 'benchmark-policy-adoption.js'),
        '--gate-phase', 'quick',
        '--games', String(args.quickGames),
        '--seed', String(quickConfig.seed),
        '--seed-count', String(quickConfig.seedCount),
        '--seed-stride', String(quickConfig.seedStride),
        '--jobs', String(args.adoptionJobs),
        '--max-plies', String(args.maxPlies),
        '--threshold', String(quickConfig.threshold),
        '--confidence-level', String(quickConfig.confidenceLevel),
        '--min-lower-bound', String(quickConfig.minLowerBound),
        '--min-seed-uplift', String(quickConfig.minSeedUplift),
        '--min-seed-pass-count', String(quickConfig.minSeedPassCount),
        ...buildAdoptionWeightArgs(args, adoptionCardRate),
        '--candidate-model', iterationPaths.candidateModelPath,
        '--out', iterationPaths.quickAdoptionPath
    ].concat(adoptionBaselineArgs || [], verboseArgs || []);
}
function buildQualityGateCommandArgs(options) {
    const { args, iterationPaths, qualityConfig, adoptionCardRate, adoptionBaselineArgs, verboseArgs } = options;
    return [
        path.resolve('scripts', 'benchmark-policy-quality-gate.js'),
        '--games', String(args.qualityGateGames),
        '--seed', String(qualityConfig.seed),
        '--seed-count', String(qualityConfig.seedCount),
        '--seed-stride', String(qualityConfig.seedStride),
        '--jobs', String(args.adoptionJobs),
        '--max-plies', String(args.maxPlies),
        '--threshold', String(args.qualityGateThreshold),
        '--confidence-level', String(args.qualityGateConfidenceLevel),
        '--min-lower-bound', String(args.qualityGateMinLowerBound),
        '--min-seed-uplift', String(args.qualityGateMinSeedUplift),
        '--min-seed-pass-count', String(args.qualityGateMinSeedPassCount),
        ...buildAdoptionWeightArgs(args, adoptionCardRate),
        '--candidate-model', iterationPaths.candidateModelPath,
        '--out', iterationPaths.qualityGatePath
    ]
        .concat(args.qualityGateStrengthFirst ? ['--quality-gate-strength-first'] : [])
        .concat(adoptionBaselineArgs || [], verboseArgs || []);
}
function buildFinalAdoptionCommandArgs(options) {
    const { args, iterationPaths, finalConfig, adoptionCardRate, adoptionBaselineArgs, verboseArgs } = options;
    return [
        path.resolve('scripts', 'benchmark-policy-adoption.js'),
        '--gate-phase', 'final',
        '--games', String(args.finalGames),
        '--seed', String(finalConfig.seed),
        '--seed-count', String(finalConfig.seedCount),
        '--seed-stride', String(finalConfig.seedStride),
        '--jobs', String(args.adoptionJobs),
        '--max-plies', String(args.maxPlies),
        '--threshold', String(finalConfig.threshold),
        '--confidence-level', String(finalConfig.confidenceLevel),
        '--min-lower-bound', String(finalConfig.minLowerBound),
        '--min-seed-uplift', String(finalConfig.minSeedUplift),
        '--min-seed-pass-count', String(finalConfig.minSeedPassCount),
        ...buildAdoptionWeightArgs(args, adoptionCardRate),
        '--candidate-model', iterationPaths.candidateModelPath,
        '--out', iterationPaths.finalAdoptionPath
    ].concat(adoptionBaselineArgs || [], verboseArgs || []);
}
function buildCandidateOnnxBundleArgs(args, iterationPaths, hasTargetTrainingData) {
    const includeTargetHead = isTargetHeadEnabled(args)
        && !!(iterationPaths && iterationPaths.targetOnnxModelPath && iterationPaths.targetOnnxMetaPath)
        && !!hasTargetTrainingData;
    const includeValueHead = isValueHeadEnabled(args)
        && !!(iterationPaths && iterationPaths.valueOnnxModelPath && iterationPaths.valueOnnxMetaPath);
    return [
        '--candidate-onnx', iterationPaths.onnxModelPath,
        '--candidate-onnx-meta', iterationPaths.onnxMetaPath,
        ...(args.allowCardUsage ? [
            '--candidate-card-onnx', iterationPaths.cardOnnxModelPath,
            '--candidate-card-onnx-meta', iterationPaths.cardOnnxMetaPath
        ] : []),
        ...(includeTargetHead ? [
            '--candidate-target-onnx', iterationPaths.targetOnnxModelPath,
            '--candidate-target-onnx-meta', iterationPaths.targetOnnxMetaPath
        ] : []),
        ...(includeValueHead ? [
            '--candidate-value-onnx', iterationPaths.valueOnnxModelPath,
            '--candidate-value-onnx-meta', iterationPaths.valueOnnxMetaPath
        ] : [])
    ];
}
function buildTargetOnnxBundleArgs(args, hasTargetTrainingData) {
    const modelsDir = path.resolve(args.modelsDir);
    const includeTargetHead = isTargetHeadEnabled(args) && !!hasTargetTrainingData;
    const includeValueHead = isValueHeadEnabled(args);
    return [
        '--target-onnx', path.join(modelsDir, 'policy-net.onnx'),
        '--target-onnx-meta', path.join(modelsDir, 'policy-net.onnx.meta.json'),
        ...(args.allowCardUsage ? [
            '--target-card-onnx', path.join(modelsDir, 'policy-card.onnx'),
            '--target-card-onnx-meta', path.join(modelsDir, 'policy-card.onnx.meta.json')
        ] : []),
        ...(includeTargetHead ? [
            '--target-target-onnx', path.join(modelsDir, 'policy-target.onnx'),
            '--target-target-onnx-meta', path.join(modelsDir, 'policy-target.onnx.meta.json')
        ] : []),
        ...(includeValueHead ? [
            '--target-value-onnx', path.join(modelsDir, 'policy-value.onnx'),
            '--target-value-onnx-meta', path.join(modelsDir, 'policy-value.onnx.meta.json')
        ] : [])
    ];
}
function buildOnnxGateCommandArgs(options) {
    const { args, iterationPaths, hasTargetTrainingData, onnxConfig } = options;
    return [
        path.resolve('scripts', 'benchmark-policy-onnx-gate.js'),
        '--games', String(args.onnxGateGames),
        '--seed', String(onnxConfig.seed),
        '--seed-count', String(onnxConfig.seedCount),
        '--seed-stride', String(onnxConfig.seedStride),
        '--jobs', String(args.onnxGateJobs),
        '--threshold', String(args.onnxGateThreshold),
        '--min-seed-score', String(args.onnxGateMinSeedScore),
        '--min-seed-pass-count', String(args.onnxGateMinSeedPassCount),
        '--max-average-latency-ms', String(args.onnxGateMaxAverageLatencyMs),
        '--max-p95-latency-ms', String(args.onnxGateMaxP95LatencyMs),
        '--max-max-latency-ms', String(args.onnxGateMaxMaxLatencyMs),
        '--timeout-ms', String(args.onnxGateTimeoutMs),
        '--black-level', String(args.onnxGateBlackLevel),
        '--white-level', String(args.onnxGateWhiteLevel),
        '--candidate-color-mode', String(args.onnxGateCandidateColorMode),
        ...buildCandidateOnnxBundleArgs(args, iterationPaths, hasTargetTrainingData),
        ...buildTargetOnnxBundleArgs(args, hasTargetTrainingData),
        '--out', iterationPaths.onnxGatePath
    ];
}
function buildPromotionTargetBundleArgs(args, hasTargetTrainingData) {
    const modelsDir = path.resolve(args.modelsDir);
    return [
        '--target-model', path.join(modelsDir, 'policy-table.json'),
        ...buildTargetOnnxBundleArgs(args, hasTargetTrainingData)
    ];
}
function buildPromotionCommandArgs(args, iterationPaths, adoptionResultPath, hasTargetTrainingData) {
    const modelsDir = path.resolve(args.modelsDir);
    const gatePayloadArgs = [];
    if (iterationPaths.quickAdoptionPath) {
        gatePayloadArgs.push('--quick-gate-payload', iterationPaths.quickAdoptionPath);
    }
    if (iterationPaths.qualityGatePath) {
        gatePayloadArgs.push('--quality-gate-payload', iterationPaths.qualityGatePath);
    }
    if (iterationPaths.finalAdoptionPath) {
        gatePayloadArgs.push('--final-gate-payload', iterationPaths.finalAdoptionPath);
    }
    if (iterationPaths.onnxGatePath) {
        gatePayloadArgs.push('--onnx-gate-payload', iterationPaths.onnxGatePath);
    }
    if (iterationPaths.warehouseManifestPath) {
        gatePayloadArgs.push('--warehouse-manifest', iterationPaths.warehouseManifestPath);
    }
    return [
        path.resolve('scripts', 'promote-policy-model.js'),
        '--adoption-result', adoptionResultPath,
        ...gatePayloadArgs,
        '--candidate-model', iterationPaths.candidateModelPath,
        ...buildCandidateOnnxBundleArgs(args, iterationPaths, hasTargetTrainingData),
        ...buildPromotionTargetBundleArgs(args, hasTargetTrainingData),
        '--promoted-dir', path.join(modelsDir, 'promoted'),
        '--archive-dir', path.join(modelsDir, 'archive'),
        '--manifest', path.join(modelsDir, 'promoted', 'promotion-manifest.json')
    ];
}
module.exports = {
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
};
//# sourceMappingURL=training-cycle-command-builders.js.map