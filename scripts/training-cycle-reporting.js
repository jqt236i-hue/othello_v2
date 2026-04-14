'use strict';

const fs = require('fs');
const path = require('path');
const { cloneResumeCheckpointPaths } = require('./training-checkpoint-utils');
const { TRAINING_WAREHOUSE_MANIFEST_SCHEMA_VERSION } = require('./training-warehouse-manifest-utils');

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
    'onnxHiddenSize',
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
    if (Number.isFinite(detail.iteration)) parts.push(`iteration=${detail.iteration}`);
    if (detail.step) parts.push(`step=${detail.step}`);
    if (Number.isFinite(detail.exitCode)) parts.push(`exit=${detail.exitCode}`);
    if (detail.errorCode && detail.errorCode !== 'COMMAND_FAILED') parts.push(`code=${detail.errorCode}`);
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
