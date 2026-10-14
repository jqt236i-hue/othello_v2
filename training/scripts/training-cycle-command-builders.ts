'use strict';

import * as fs from 'fs';
import * as path from 'path';
import GateContract = require('./policy-onnx-browser-gate-contract');

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function resolveTrainingPythonScript(scriptName: string) {
    return path.resolve('training', 'python', scriptName);
}

function normalizeSpecialistEarlyStopMonitor(monitor: any) {
    if (monitor === 'val_place_loss') return 'val_loss';
    if (monitor === 'train_place_loss') return 'train_loss';
    return monitor;
}

function appendResumeArgs(args: any, resumeCheckpointPath: any, resumeOptimizer: any) {
    if (resumeCheckpointPath) {
        args.push('--resume-checkpoint', resumeCheckpointPath);
    }
    if (resumeOptimizer) {
        args.push('--resume-optimizer');
    }
    return args;
}

function isValueHeadEnabled(args: any) {
    return !(args && args.trainValueHeadEnabled === false);
}

function isTargetHeadEnabled(args: any) {
    return !(args && args.trainTargetHeadEnabled === false);
}

function isCardSpecialistEnabled(args: any) {
    return !!(args && args.allowCardUsage && Number.isFinite(Number(args.trainCardEvery)) && Number(args.trainCardEvery) > 0);
}

function buildAdoptionWeightArgs(args: any, adoptionCardRate: any) {
    const deckArgs = args && args.selfplayWhiteDeckCode
        ? ['--white-deck-code', String(args.selfplayWhiteDeckCode)]
        : ['--no-white-deck-code'];
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
        '--quality-weight-corner-donation-avoidance', String(args.adoptionQualityWeightCornerDonationAvoidance),
        '--quality-weight-opponent-safe-edge-avoidance', String(args.adoptionQualityWeightOpponentSafeEdgeAvoidance),
        '--quality-weight-own-safe-edge', String(args.adoptionQualityWeightOwnSafeEdge),
        '--quality-weight-own-edge-gap-avoidance', String(args.adoptionQualityWeightOwnEdgeGapAvoidance),
        '--quality-weight-opponent-edge-cut', String(args.adoptionQualityWeightOpponentEdgeCut),
        '--quality-weight-bonus', String(args.adoptionQualityWeightBonus),
        '--quality-weight-card-immediate', String(args.adoptionQualityWeightCardImmediate),
        '--quality-weight-card-future', String(args.adoptionQualityWeightCardFuture),
        '--quality-weight-place-delta', String(args.adoptionQualityWeightPlaceDelta)
    ].concat(deckArgs);
}

function buildGenerateSelfplayDataArgs(options: any) {
    return [
        path.resolve('scripts', 'generate-selfplay-data.js'),
        '--games', String(options.games),
        '--seed', String(options.seed),
        '--max-plies', String(options.maxPlies),
        '--out', options.outPath,
        '--seed-family', options.seedFamily,
        '--data-lane', options.dataLane,
        '--jobs', String(options.selfplayJobs)
    ].concat(
        options.hardcaseOutPath ? ['--hardcase-out', options.hardcaseOutPath] : [],
        options.generateCardArgs || [],
        options.selfplayDeckArgs || [],
        options.selfplayDiversityArgs || [],
        options.guideModelArgs || [],
        options.selfplayResumeArgs || [],
        options.reuseCompletedChunks ? ['--reuse-completed-chunks'] : [],
        options.verboseArgs || []
    );
}

function buildOnnxTrainerCoreArgs(args: any, overrides: any) {
    const learningRate = Object.prototype.hasOwnProperty.call(overrides || {}, 'lr') ? overrides.lr : args.onnxLr;
    const hiddenSize = Object.prototype.hasOwnProperty.call(overrides || {}, 'hiddenSize') ? overrides.hiddenSize : args.onnxHiddenSize;
    return [
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(learningRate),
        '--hidden-size', String(hiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--val-split-mode', String(args.onnxValSplitMode),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-min-epochs', String(args.onnxEarlyStopMinEpochs),
        '--early-stop-monitor', (overrides && overrides.specialistMonitor)
            ? normalizeSpecialistEarlyStopMonitor(args.onnxEarlyStopMonitor)
            : args.onnxEarlyStopMonitor,
        '--early-stop-smoothing-window', String(args.onnxEarlyStopSmoothingWindow),
        '--lr-plateau-patience', String(args.onnxLrPlateauPatience),
        '--lr-plateau-factor', String(args.onnxLrPlateauFactor),
        '--lr-plateau-min-lr', String(args.onnxLrPlateauMinLr)
    ];
}

function buildOnnxTrainerSampleWeightArgs(args: any, options: any) {
    return [
        ...((options && options.includeCardClassWeights) ? [
            '--card-no-action-weight', String(args.onnxCardNoActionWeight),
            '--card-class-balance-power', String(args.onnxCardClassBalancePower)
        ] : []),
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
        ...((options && options.includeBalanceBoosts) ? [
            '--corner-balance-sample-boost', String(args.onnxCornerBalanceSampleBoost),
            '--edge-balance-sample-boost', String(args.onnxEdgeBalanceSampleBoost),
            '--economy-balance-sample-boost', String(args.onnxEconomyBalanceSampleBoost)
        ] : [])
    ];
}

function buildPolicyTrainingCommandArgs(options: any) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    const trainerScript = args.policyTrainerScript || resolveTrainingPythonScript('train_policy_onnx.py');
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
        ...buildOnnxTrainerCoreArgs(args, {}),
        ...buildOnnxTrainerSampleWeightArgs(args, {
            includeCardClassWeights: false,
            includeBalanceBoosts: true
        }),
        '--metrics-out', iterationPaths.onnxMetricsPath,
        '--min-visits', String(args.minVisits),
        '--shape-immediate', String(args.shapeImmediate),
        '--checkpoint-out', iterationPaths.checkpointPath
    ].concat(cnnTrainerArgs);
    return appendResumeArgs(baseArgs, resumeCheckpointPath, args.onnxResumeOptimizer);
}

function buildCardTrainingCommandArgs(options: any) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    return appendResumeArgs([
        resolveTrainingPythonScript('train_card_onnx.py'),
        '--input', iterationPaths.trainDataPath,
        '--onnx-out', iterationPaths.cardOnnxModelPath,
        '--meta-out', iterationPaths.cardOnnxMetaPath,
        ...buildOnnxTrainerCoreArgs(args, { specialistMonitor: true }),
        ...buildOnnxTrainerSampleWeightArgs(args, {
            includeCardClassWeights: true
        }),
        '--metrics-out', iterationPaths.cardMetricsPath,
        '--checkpoint-out', iterationPaths.cardCheckpointPath
    ], resumeCheckpointPath, args.onnxResumeOptimizer);
}

function buildTargetTrainingCommandArgs(options: any) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    return appendResumeArgs([
        resolveTrainingPythonScript('train_target_onnx.py'),
        '--input', iterationPaths.trainDataPath,
        '--onnx-out', iterationPaths.targetOnnxModelPath,
        '--meta-out', iterationPaths.targetOnnxMetaPath,
        ...buildOnnxTrainerCoreArgs(args, { specialistMonitor: true }),
        ...buildOnnxTrainerSampleWeightArgs(args, {}),
        '--metrics-out', iterationPaths.targetMetricsPath,
        '--checkpoint-out', iterationPaths.targetCheckpointPath
    ], resumeCheckpointPath, args.onnxResumeOptimizer);
}

function buildValueTrainingCommandArgs(options: any) {
    const { args, iterationPaths, resumeCheckpointPath } = options;
    const valueLr = Number.isFinite(args.onnxValueLr) ? args.onnxValueLr : args.onnxLr;
    const valueHiddenSize = Number.isFinite(args.onnxValueHiddenSize) ? args.onnxValueHiddenSize : args.onnxHiddenSize;
    return appendResumeArgs([
        resolveTrainingPythonScript('train_value_onnx.py'),
        '--input', iterationPaths.trainDataPath,
        '--onnx-out', iterationPaths.valueOnnxModelPath,
        '--meta-out', iterationPaths.valueOnnxMetaPath,
        ...buildOnnxTrainerCoreArgs(args, {
            lr: valueLr,
            hiddenSize: valueHiddenSize,
            specialistMonitor: true
        }),
        ...buildOnnxTrainerSampleWeightArgs(args, {
            includeBalanceBoosts: true
        }),
        '--metrics-out', iterationPaths.valueMetricsPath,
        '--value-target-corner-weight', String(args.onnxValueTargetCornerWeight),
        '--value-target-edge-weight', String(args.onnxValueTargetEdgeWeight),
        '--value-target-economy-weight', String(args.onnxValueTargetEconomyWeight),
        '--value-target-corner-emergency-weight', String(args.onnxValueTargetCornerEmergencyWeight),
        '--checkpoint-out', iterationPaths.valueCheckpointPath
    ], resumeCheckpointPath, args.onnxResumeOptimizer);
}

function buildQuickAdoptionCommandArgs(options: any) {
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

function buildQualityGateCommandArgs(options: any) {
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

function buildFinalAdoptionCommandArgs(options: any) {
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

type OnnxHeadKey = 'primary' | 'card' | 'target' | 'value';
/** generated: trained in this iteration; reused: this iteration's output reused on resume;
 * retained: not trained this iteration (cadence) - the lane keeps its existing asset, which is
 * never presented as a candidate; disabled: the head is off for this lane/iteration. */
type OnnxHeadStatus = 'generated' | 'reused' | 'retained' | 'disabled';
type OnnxHeadEntry = {
    head: OnnxHeadKey;
    status: OnnxHeadStatus;
    candidatePath: string | null;
    candidateMetaPath: string | null;
    laneAssetPath: string | null;
    laneAssetPresent: boolean | null;
};
type OnnxIterationBundle = { schema: 'onnx-iteration-bundle.v1'; heads: Record<OnnxHeadKey, OnnxHeadEntry> };

const ONNX_HEAD_FILES: Readonly<Record<OnnxHeadKey, { candidate: string; candidateMeta: string; lane: string; laneMeta: string; flag: string }>> = Object.freeze({
    primary: { candidate: 'onnxModelPath', candidateMeta: 'onnxMetaPath', lane: 'policy-net.onnx', laneMeta: 'policy-net.onnx.meta.json', flag: 'onnx' },
    card: { candidate: 'cardOnnxModelPath', candidateMeta: 'cardOnnxMetaPath', lane: 'policy-card.onnx', laneMeta: 'policy-card.onnx.meta.json', flag: 'card-onnx' },
    target: { candidate: 'targetOnnxModelPath', candidateMeta: 'targetOnnxMetaPath', lane: 'policy-target.onnx', laneMeta: 'policy-target.onnx.meta.json', flag: 'target-onnx' },
    value: { candidate: 'valueOnnxModelPath', candidateMeta: 'valueOnnxMetaPath', lane: 'policy-value.onnx', laneMeta: 'policy-value.onnx.meta.json', flag: 'value-onnx' }
});
const ONNX_HEAD_ORDER: readonly OnnxHeadKey[] = Object.freeze(['primary', 'card', 'target', 'value'] as OnnxHeadKey[]);

function isOnnxHeadEnabled(head: OnnxHeadKey, args: any, iterationPaths: any, hasTargetTrainingData: any) {
    const files = ONNX_HEAD_FILES[head];
    if (!(iterationPaths && iterationPaths[files.candidate] && iterationPaths[files.candidateMeta])) return false;
    if (head === 'card') return isCardSpecialistEnabled(args);
    if (head === 'target') return isTargetHeadEnabled(args) && !!hasTargetTrainingData;
    if (head === 'value') return isValueHeadEnabled(args);
    return true;
}

/**
 * Resolves, once per iteration, what each ONNX head actually is. Gate and promotion both consume
 * this same bundle, so a head skipped by its training cadence is never passed on as a planned
 * candidate path that was not produced. A head reported as produced must exist on disk.
 */
function resolveIterationOnnxBundle(options: {
    args: any;
    iterationPaths: any;
    hasTargetTrainingData: any;
    headSteps: Partial<Record<OnnxHeadKey, { ran: boolean; reused?: boolean }>>;
    fileExists?: (filePath: string) => boolean;
}): OnnxIterationBundle {
    const { args, iterationPaths, hasTargetTrainingData, headSteps } = options;
    const exists = options.fileExists || ((filePath: string) => fs.existsSync(filePath));
    const modelsDir = path.resolve(args.modelsDir);
    const heads = {} as Record<OnnxHeadKey, OnnxHeadEntry>;
    for (const head of ONNX_HEAD_ORDER) {
        const files = ONNX_HEAD_FILES[head];
        const laneAssetPath = path.join(modelsDir, files.lane);
        const entry: OnnxHeadEntry = { head, status: 'disabled', candidatePath: null, candidateMetaPath: null, laneAssetPath: null, laneAssetPresent: null };
        if (isOnnxHeadEnabled(head, args, iterationPaths, hasTargetTrainingData)) {
            const step = headSteps[head];
            if (step && step.ran) {
                entry.status = step.reused ? 'reused' : 'generated';
                entry.candidatePath = iterationPaths[files.candidate];
                entry.candidateMetaPath = iterationPaths[files.candidateMeta];
                for (const filePath of [entry.candidatePath, entry.candidateMetaPath]) {
                    if (!exists(filePath as string)) {
                        throw new Error(`[training-cycle] ${head} ONNX head was reported as ${entry.status} but ${filePath} does not exist`);
                    }
                }
            } else {
                entry.status = 'retained';
                entry.laneAssetPath = laneAssetPath;
                entry.laneAssetPresent = exists(laneAssetPath);
            }
        }
        heads[head] = entry;
    }
    return { schema: 'onnx-iteration-bundle.v1', heads };
}

function isCandidateHead(entry: OnnxHeadEntry | undefined) {
    return !!entry && (entry.status === 'generated' || entry.status === 'reused');
}

/** Candidate arguments for the heads produced in this iteration (optionally limited to `heads`). */
function buildCandidateOnnxBundleArgs(bundle: OnnxIterationBundle, heads: readonly OnnxHeadKey[] = ONNX_HEAD_ORDER) {
    if (!isCandidateHead(bundle.heads.primary)) throw new Error('[training-cycle] the primary ONNX head has no candidate in this iteration');
    const out: string[] = [];
    for (const head of ONNX_HEAD_ORDER) {
        const entry = bundle.heads[head];
        if (!heads.includes(head) || !isCandidateHead(entry)) continue;
        const flag = ONNX_HEAD_FILES[head].flag;
        out.push(`--candidate-${flag}`, entry.candidatePath as string, `--candidate-${flag}-meta`, entry.candidateMetaPath as string);
    }
    return out;
}

/** Lane target arguments for every head that is not disabled. */
function buildTargetOnnxBundleArgs(args: any, bundle: OnnxIterationBundle, heads: readonly OnnxHeadKey[] = ONNX_HEAD_ORDER) {
    const modelsDir = path.resolve(args.modelsDir);
    const out: string[] = [];
    for (const head of ONNX_HEAD_ORDER) {
        if (!heads.includes(head) || bundle.heads[head].status === 'disabled') continue;
        const files = ONNX_HEAD_FILES[head];
        out.push(`--target-${files.flag}`, path.join(modelsDir, files.lane), `--target-${files.flag}-meta`, path.join(modelsDir, files.laneMeta));
    }
    return out;
}

/** Heads the browser ONNX gate verifies; a produced card head cannot be gated (research only). */
function resolveOnnxGateHeads(bundle: OnnxIterationBundle): OnnxHeadKey[] {
    if (isCandidateHead(bundle.heads.card)) GateContract.assertBrowserGateHeadsSupported(['card'], 'training-cycle onnx-gate');
    return ONNX_HEAD_ORDER.filter((head) => head !== 'card' && !!GateContract.getBrowserGateHead(head));
}

function buildOnnxGateCommandArgs(options: any) {
    const { args, iterationPaths, onnxBundle, onnxConfig } = options;
    if (!onnxBundle || onnxBundle.schema !== 'onnx-iteration-bundle.v1') throw new Error('[training-cycle] onnx gate requires the resolved iteration ONNX bundle');
    const gateHeads = resolveOnnxGateHeads(onnxBundle);
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
        ...buildCandidateOnnxBundleArgs(onnxBundle, gateHeads),
        // The gate serves the candidates from its own bundle; these lane paths only name the
        // browser model files. The root delivery directory is never a gate target.
        ...buildTargetOnnxBundleArgs(args, onnxBundle, gateHeads),
        '--out', iterationPaths.onnxGatePath
    ];
}

function buildPromotionTargetBundleArgs(args: any, onnxBundle: OnnxIterationBundle) {
    const modelsDir = path.resolve(args.modelsDir);
    return [
        '--target-model', path.join(modelsDir, 'policy-table.json'),
        ...buildTargetOnnxBundleArgs(args, onnxBundle)
    ];
}

function buildPromotionCommandArgs(args: any, iterationPaths: any, adoptionResultPath: any, onnxBundle: OnnxIterationBundle) {
    if (!onnxBundle || onnxBundle.schema !== 'onnx-iteration-bundle.v1') throw new Error('[training-cycle] promotion requires the resolved iteration ONNX bundle');
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
        // Exactly the bundle the gate verified (card is a lane-local research asset, never browser-gated).
        ...buildCandidateOnnxBundleArgs(onnxBundle),
        ...buildPromotionTargetBundleArgs(args, onnxBundle),
        '--promoted-dir', path.join(modelsDir, 'promoted'),
        '--archive-dir', path.join(modelsDir, 'archive'),
        '--manifest', path.join(modelsDir, 'promoted', 'promotion-manifest.json')
    ];
}

function buildDeployPromotedToRootCommandArgs(args: any, iterationPaths: any) {
    const deployArgs = [
        path.resolve('scripts', 'deploy-lane-model-to-root.js'),
        '--lane-dir', path.resolve(args.modelsDir),
        '--root-models-dir', path.resolve(args.deployPromotedRootModelsDir),
        '--deploy-id', String((iterationPaths && iterationPaths.tag) || args.runTag || 'promoted')
    ];
    if (Number.isFinite(Number(args.deployPromotedMinStates)) && Number(args.deployPromotedMinStates) > 0) {
        deployArgs.push('--min-states', String(Math.floor(Number(args.deployPromotedMinStates))));
    }
    if (args.deployPromotedForce) {
        deployArgs.push('--force');
    }
    return deployArgs;
}

export = {
    buildGenerateSelfplayDataArgs,
    buildPolicyTrainingCommandArgs,
    buildCardTrainingCommandArgs,
    buildTargetTrainingCommandArgs,
    buildValueTrainingCommandArgs,
    buildQuickAdoptionCommandArgs,
    buildQualityGateCommandArgs,
    buildFinalAdoptionCommandArgs,
    resolveIterationOnnxBundle,
    buildCandidateOnnxBundleArgs,
    buildTargetOnnxBundleArgs,
    buildOnnxGateCommandArgs,
    buildPromotionTargetBundleArgs,
    buildPromotionCommandArgs,
    buildDeployPromotedToRootCommandArgs
};
