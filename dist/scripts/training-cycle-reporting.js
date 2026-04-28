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
const training_checkpoint_utils_1 = __importDefault(require("./training-checkpoint-utils"));
const { cloneResumeCheckpointPaths } = training_checkpoint_utils_1.default;
const training_warehouse_manifest_utils_1 = __importDefault(require("./training-warehouse-manifest-utils"));
const { TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION } = training_warehouse_manifest_utils_1.default;
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const TRAINING_CYCLE_SUMMARY_CONFIG_KEYS = Object.freeze([
    'iterations',
    'maxHours',
    'trainGames',
    'evalGames',
    'selfplayJobs',
    'selfplayResumeChunkSize',
    'adoptionJobs',
    'onnxGateJobs',
    'seed',
    'seedStride',
    'evalSeedOffset',
    'maxPlies',
    'allowCardUsage',
    'cardUsageRate',
    'selfplayGenerateHardcases',
    'selfplayPolicyMixRate',
    'selfplayPolicyModelPoolSize',
    'selfplayPolicyPoolSampling',
    'selfplayPolicyPoolRecencyDecay',
    'selfplayPolicyCurrentAnchorRate',
    'selfplayCardUsageRateJitter',
    'selfplayCardUsageRateScheduleSpec',
    'selfplayTacticalWeightMin',
    'selfplayTacticalWeightMax',
    'selfplayTacticalDepthOpening',
    'selfplayTacticalDepthMid',
    'selfplayTacticalDepthEnd',
    'selfplayTacticalBeamWidth',
    'selfplayTeacherCommitteeWeightMin',
    'selfplayTeacherCommitteeWeightMax',
    'selfplayTeacherCommitteeConsensusBonusMin',
    'selfplayTeacherCommitteeConsensusBonusMax',
    'selfplayPolicyScoreWeightMin',
    'selfplayPolicyScoreWeightMax',
    'selfplayHeuristicWeightMin',
    'selfplayHeuristicWeightMax',
    'pythonPath',
    'onnxEpochs',
    'onnxBatchSize',
    'onnxLr',
    'onnxValueLr',
    'onnxHiddenSize',
    'onnxValueHiddenSize',
    'onnxDevice',
    'onnxLogIntervalSteps',
    'onnxValSplit',
    'onnxValSplitMode',
    'onnxEarlyStopPatience',
    'onnxEarlyStopMinDelta',
    'onnxEarlyStopMinEpochs',
    'onnxEarlyStopMonitor',
    'onnxEarlyStopSmoothingWindow',
    'onnxResumeOptimizer',
    'onnxCardNoActionWeight',
    'onnxCardClassBalancePower',
    'onnxWinnerSampleBoost',
    'onnxLoserSampleWeight',
    'onnxDrawSampleWeight',
    'onnxCornerEmergencySampleBoost',
    'onnxNegativeFutureDiscSampleBoost',
    'onnxNegativeFutureDiscThreshold',
    'onnxTacticalMissSampleBoost',
    'onnxTacticalMissThreshold',
    'onnxHandPressureSampleBoost',
    'onnxPendingTargetSampleBoost',
    'trainTargetHeadEnabled',
    'trainValueHeadEnabled',
    'trainCardEvery',
    'trainTargetEvery',
    'trainValueEvery',
    'minVisits',
    'shapeImmediate',
    'quickGames',
    'finalGames',
    'threshold',
    'adoptionSeedCount',
    'adoptionSeedStride',
    'adoptionFinalSeedOffset',
    'adoptionConfidenceLevel',
    'adoptionMinLowerBound',
    'adoptionMinSeedUplift',
    'adoptionMinSeedPassCount',
    'qualityGateEnabled',
    'qualityGateGames',
    'qualityGateSeedCount',
    'qualityGateSeedStride',
    'qualityGateSeedOffset',
    'qualityGateThreshold',
    'qualityGateConfidenceLevel',
    'qualityGateMinLowerBound',
    'qualityGateMinSeedUplift',
    'qualityGateMinSeedPassCount',
    'qualityGateStrengthFirst',
    'quickAdoptionThreshold',
    'quickAdoptionSeedOffset',
    'quickAdoptionSeedCount',
    'quickAdoptionSeedStride',
    'quickAdoptionConfidenceLevel',
    'quickAdoptionMinLowerBound',
    'quickAdoptionMinSeedUplift',
    'quickAdoptionMinSeedPassCount',
    'finalAdoptionThreshold',
    'finalAdoptionSeedCount',
    'finalAdoptionSeedStride',
    'finalAdoptionConfidenceLevel',
    'finalAdoptionMinLowerBound',
    'finalAdoptionMinSeedUplift',
    'finalAdoptionMinSeedPassCount',
    'adoptionTacticalWeight',
    'adoptionTacticalDepthOpening',
    'adoptionTacticalDepthMid',
    'adoptionTacticalDepthEnd',
    'adoptionTacticalBeamWidth',
    'adoptionPolicyScoreWeight',
    'adoptionHeuristicWeight',
    'adoptionWhitePriority',
    'adoptionQualityWeightCorner',
    'adoptionQualityWeightEdge',
    'adoptionQualityWeightCornerRecovery',
    'adoptionQualityWeightCornerRecapture',
    'adoptionQualityWeightEdgeRecovery',
    'adoptionQualityWeightCornerHold',
    'adoptionQualityWeightCornerHoldTurns',
    'adoptionQualityWeightEdgeHold',
    'adoptionQualityWeightFinalCornerShare',
    'adoptionQualityWeightFinalEdgeShare',
    'adoptionQualityWeightBonus',
    'adoptionQualityWeightCardImmediate',
    'adoptionQualityWeightCardFuture',
    'adoptionQualityWeightPlaceDelta',
    'adoptionUseGuideBaseline',
    'adoptionUseAnchorBaseline',
    'onnxGateEnabled',
    'onnxGateGames',
    'onnxGateSeedCount',
    'onnxGateSeedStride',
    'onnxGateSeedOffset',
    'onnxGateThreshold',
    'onnxGateMinSeedScore',
    'onnxGateMinSeedPassCount',
    'onnxGateMaxAverageLatencyMs',
    'onnxGateMaxP95LatencyMs',
    'onnxGateMaxMaxLatencyMs',
    'onnxGateTimeoutMs',
    'onnxGateBlackLevel',
    'onnxGateWhiteLevel',
    'onnxGateCandidateColorMode',
    'promotionMode',
    'onnxPrimaryMaxQuickRegression',
    'onnxPrimaryRequireQuickRegression',
    'onnxPrimaryRequireQuickNonRegression',
    'onnxPrimaryMinQuickCoreDelta',
    'onnxPrimaryMinQuickWhiteDelta',
    'onnxPrimaryMinQuickQualityDelta',
    'onnxPrimaryMinQuickUplift',
    'onnxPrimaryMinQuickLowerBound',
    'onnxPrimaryMinOnnxGateAvg',
    'onnxPrimaryMinOnnxGateMinSeed',
    'gateFinalIterationOnly',
    'promoteOnPass',
    'selfplayUsePromotedModelOnly',
    'bootstrapPolicyModelPath',
    'resumeCheckpointPath',
    'resumePolicyCheckpointPath',
    'resumeCardCheckpointPath',
    'resumeTargetCheckpointPath',
    'resumeValueCheckpointPath',
    'carryOverCheckpoint',
    'carryOverCheckpointMode',
    'seedBankPath',
    'reuseExistingArtifacts',
    'restartFromStep',
    'runTag'
]);
function writeJsonFileAtomic(filePath, payload) {
    const resolvedPath = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    const tempPath = `${resolvedPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tempPath, resolvedPath);
}
function getPrimaryResumeCheckpointPath(resumeCheckpointPaths) {
    return resumeCheckpointPaths && resumeCheckpointPaths.policy
        ? resumeCheckpointPaths.policy
        : null;
}
function extractTrainingCycleFailureDetail(error, context) {
    if (error && error.trainingCycle && typeof error.trainingCycle === 'object') {
        return Object.assign({}, error.trainingCycle);
    }
    const fallback = context && typeof context === 'object' ? context : {};
    return {
        iteration: Number.isFinite(fallback.iteration) ? fallback.iteration : null,
        step: fallback.step || null,
        runTag: fallback.runTag || null,
        iterationTag: fallback.iterationTag || null,
        summaryOut: fallback.summaryOut || null,
        message: error && error.message ? error.message : String(error),
        exitCode: error && Number.isFinite(error.exitCode) ? error.exitCode : null,
        errorCode: error && error.code ? error.code : null,
        command: error && error.command ? error.command : null,
        stepOutputs: Array.isArray(fallback.stepOutputs) ? fallback.stepOutputs.filter((one) => !!one) : [],
        generatedAt: new Date().toISOString()
    };
}
function annotateTrainingCycleError(error, context) {
    const detail = extractTrainingCycleFailureDetail(error, context);
    const parts = [];
    if (Number.isFinite(detail.iteration))
        parts.push(`iteration=${detail.iteration}`);
    if (detail.step)
        parts.push(`step=${detail.step}`);
    if (Number.isFinite(detail.exitCode))
        parts.push(`exit=${detail.exitCode}`);
    if (detail.errorCode && detail.errorCode !== 'COMMAND_FAILED')
        parts.push(`code=${detail.errorCode}`);
    parts.push(detail.message || 'training cycle failed');
    const wrapped = new Error(parts.join(' '));
    wrapped.code = detail.errorCode || (error && error.code) || 'TRAINING_CYCLE_FAILED';
    wrapped.exitCode = Number.isFinite(detail.exitCode) ? detail.exitCode : null;
    wrapped.command = detail.command || (error && error.command) || null;
    wrapped.trainingCycle = detail;
    wrapped.cause = error;
    return wrapped;
}
function buildTrainingCycleSummaryConfig(args) {
    const config = {};
    for (const key of TRAINING_CYCLE_SUMMARY_CONFIG_KEYS) {
        config[key] = args[key];
    }
    config.resumeCheckpointPaths = cloneResumeCheckpointPaths(args.resumeCheckpointPaths);
    return config;
}
function buildTrainingCycleSummaryPayload(args, options) {
    const latestResumeCheckpointPaths = cloneResumeCheckpointPaths(options.resumeCheckpointPaths);
    return {
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - options.startedAt,
        config: buildTrainingCycleSummaryConfig(args),
        latestGuideModelPath: options.guideModelPath,
        latestGuideModelPoolPaths: options.guideModelPoolPaths,
        latestResumeCheckpointPath: getPrimaryResumeCheckpointPath(latestResumeCheckpointPaths),
        latestResumeCheckpointPaths,
        latestAnchorModelPath: options.anchorModelPath,
        warehouseManifestSchemaVersion: TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION,
        latestWarehouseManifestPath: options.iterations.length > 0 && options.iterations[options.iterations.length - 1].paths
            ? options.iterations[options.iterations.length - 1].paths.warehouseManifestPath
            : null,
        stoppedByTimeBudget: options.stoppedByTimeBudget,
        stopReason: options.stopReason,
        failure: options.failureDetail || null,
        iterations: options.iterations
    };
}
function writeSummarySnapshot(args, startedAt, iterations, guideModelPath, guideModelPoolPaths, resumeCheckpointPaths, anchorModelPath, stoppedByTimeBudget, stopReason, failureDetail) {
    const payload = buildTrainingCycleSummaryPayload(args, {
        startedAt,
        iterations,
        guideModelPath,
        guideModelPoolPaths,
        resumeCheckpointPaths,
        anchorModelPath,
        stoppedByTimeBudget,
        stopReason,
        failureDetail
    });
    writeJsonFileAtomic(args.summaryOut, payload);
    return payload;
}
module.exports = {
    TRAINING_CYCLE_SUMMARY_CONFIG_KEYS,
    extractTrainingCycleFailureDetail,
    annotateTrainingCycleError,
    buildTrainingCycleSummaryConfig,
    buildTrainingCycleSummaryPayload,
    writeSummarySnapshot
};
//# sourceMappingURL=training-cycle-reporting.js.map