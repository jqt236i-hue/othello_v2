#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function defaultSelfplayJobs() {
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    return Math.max(1, Math.min(10, cpuCount));
}

function parseArgs(argv) {
    const args = {
        iterations: 1,
        maxHours: 100,
        trainGames: 20000,
        evalGames: 2000,
        selfplayJobs: defaultSelfplayJobs(),
        adoptionJobs: defaultSelfplayJobs(),
        onnxGateJobs: defaultSelfplayJobs(),
        seed: 1,
        seedStride: 1000,
        evalSeedOffset: 100000,
        maxPlies: 220,
        allowCardUsage: true,
        cardUsageRate: 0.2,
        selfplayPolicyMixRate: 1,
        selfplayPolicyModelPoolSize: 4,
        selfplayPolicyPoolSampling: 'recency',
        selfplayPolicyPoolRecencyDecay: 2.5,
        selfplayPolicyCurrentAnchorRate: 0.35,
        selfplayCardUsageRateJitter: 0,
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
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
        onnxEpochs: 9999,
        onnxBatchSize: 2048,
        onnxLr: 0.001,
        onnxHiddenSize: 256,
        onnxDevice: 'auto',
        onnxLogIntervalSteps: 0,
        onnxValSplit: 0.1,
        onnxEarlyStopPatience: 8,
        onnxEarlyStopMinDelta: 0.0005,
        onnxEarlyStopMinEpochs: 8,
        onnxEarlyStopMonitor: 'val_loss',
        onnxEarlyStopSmoothingWindow: 1,
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
        adoptionQualityWeightEdge: 0.16,
        adoptionQualityWeightCornerRecovery: 0.18,
        adoptionQualityWeightCornerRecapture: 0.14,
        adoptionQualityWeightEdgeRecovery: 0.12,
        adoptionQualityWeightCornerHold: 0.16,
        adoptionQualityWeightCornerHoldTurns: 0.10,
        adoptionQualityWeightEdgeHold: 0.10,
        adoptionQualityWeightFinalCornerShare: 0.24,
        adoptionQualityWeightFinalEdgeShare: 0.10,
        adoptionQualityWeightBonus: 0.01,
        adoptionQualityWeightCardImmediate: 0.015,
        adoptionQualityWeightCardFuture: 0.02,
        adoptionQualityWeightPlaceDelta: 0.015,
        adoptionUseGuideBaseline: false,
        onnxGateEnabled: false,
        onnxGateGames: 8,
        onnxGateSeedCount: 1,
        onnxGateSeedStride: 1000,
        onnxGateSeedOffset: 700000,
        onnxGateThreshold: 0.5,
        onnxGateMinSeedScore: 0,
        onnxGateMinSeedPassCount: 0,
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
        promoteOnPass: true,
        selfplayUsePromotedModelOnly: true,
        bootstrapPolicyModelPath: null,
        resumeCheckpointPath: null,
        carryOverCheckpoint: true,
        runTag: null,
        runsDir: path.resolve(process.cwd(), 'data', 'runs'),
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        summaryOut: null,
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
        if (a === '--adoption-jobs') { args.adoptionJobs = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-jobs') { args.onnxGateJobs = Number(argv[++i]); continue; }
        if (a === '--seed' || a === '-s') { args.seed = Number(argv[++i]); continue; }
        if (a === '--seed-stride') { args.seedStride = Number(argv[++i]); continue; }
        if (a === '--eval-seed-offset') { args.evalSeedOffset = Number(argv[++i]); continue; }
        if (a === '--max-plies') { args.maxPlies = Number(argv[++i]); continue; }
        if (a === '--with-cards') { args.allowCardUsage = true; continue; }
        if (a === '--no-cards') { args.allowCardUsage = false; continue; }
        if (a === '--card-usage-rate') { args.cardUsageRate = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-mix-rate') { args.selfplayPolicyMixRate = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-model-pool-size') { args.selfplayPolicyModelPoolSize = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-pool-sampling') { args.selfplayPolicyPoolSampling = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--selfplay-policy-pool-recency-decay') { args.selfplayPolicyPoolRecencyDecay = Number(argv[++i]); continue; }
        if (a === '--selfplay-policy-current-anchor-rate') { args.selfplayPolicyCurrentAnchorRate = Number(argv[++i]); continue; }
        if (a === '--selfplay-card-usage-rate-jitter') { args.selfplayCardUsageRateJitter = Number(argv[++i]); continue; }
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
        if (a === '--python') { args.pythonPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--onnx-epochs') { args.onnxEpochs = Number(argv[++i]); continue; }
        if (a === '--onnx-batch-size') { args.onnxBatchSize = Number(argv[++i]); continue; }
        if (a === '--onnx-lr') { args.onnxLr = Number(argv[++i]); continue; }
        if (a === '--onnx-hidden-size') { args.onnxHiddenSize = Number(argv[++i]); continue; }
        if (a === '--onnx-device') { args.onnxDevice = String(argv[++i] || '').trim().toLowerCase() || 'auto'; continue; }
        if (a === '--onnx-log-interval-steps') { args.onnxLogIntervalSteps = Number(argv[++i]); continue; }
        if (a === '--onnx-val-split') { args.onnxValSplit = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-patience') { args.onnxEarlyStopPatience = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-min-delta') { args.onnxEarlyStopMinDelta = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-min-epochs') { args.onnxEarlyStopMinEpochs = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-monitor') { args.onnxEarlyStopMonitor = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--onnx-early-stop-smoothing-window') { args.onnxEarlyStopSmoothingWindow = Number(argv[++i]); continue; }
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
        if (a === '--adoption-quality-weight-final-corner-share') { args.adoptionQualityWeightFinalCornerShare = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-final-edge-share') { args.adoptionQualityWeightFinalEdgeShare = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-bonus') { args.adoptionQualityWeightBonus = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-card-immediate') { args.adoptionQualityWeightCardImmediate = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-card-future') { args.adoptionQualityWeightCardFuture = Number(argv[++i]); continue; }
        if (a === '--adoption-quality-weight-place-delta') { args.adoptionQualityWeightPlaceDelta = Number(argv[++i]); continue; }
        if (a === '--adoption-use-guide-baseline') { args.adoptionUseGuideBaseline = true; continue; }
        if (a === '--no-adoption-use-guide-baseline') { args.adoptionUseGuideBaseline = false; continue; }
        if (a === '--onnx-gate') { args.onnxGateEnabled = true; continue; }
        if (a === '--no-onnx-gate') { args.onnxGateEnabled = false; continue; }
        if (a === '--onnx-gate-games') { args.onnxGateGames = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-seed-count') { args.onnxGateSeedCount = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-seed-stride') { args.onnxGateSeedStride = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-seed-offset') { args.onnxGateSeedOffset = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-threshold') { args.onnxGateThreshold = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-min-seed-score') { args.onnxGateMinSeedScore = Number(argv[++i]); continue; }
        if (a === '--onnx-gate-min-seed-pass-count') { args.onnxGateMinSeedPassCount = Number(argv[++i]); continue; }
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
        if (a === '--promote') { args.promoteOnPass = true; continue; }
        if (a === '--no-promote') { args.promoteOnPass = false; continue; }
        if (a === '--selfplay-use-promoted-model-only') { args.selfplayUsePromotedModelOnly = true; continue; }
        if (a === '--selfplay-use-candidate-every-iteration') { args.selfplayUsePromotedModelOnly = false; continue; }
        if (a === '--bootstrap-policy-model') { args.bootstrapPolicyModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--resume-checkpoint') { args.resumeCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--carry-over-checkpoint') { args.carryOverCheckpoint = true; continue; }
        if (a === '--no-carry-over-checkpoint') { args.carryOverCheckpoint = false; continue; }
        if (a === '--run-tag') { args.runTag = String(argv[++i] || '').trim(); continue; }
        if (a === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--summary-out') { args.summaryOut = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.help) return args;

    if (!Number.isFinite(args.iterations) || args.iterations < 1) throw new Error('--iterations must be >= 1');
    if (!Number.isFinite(args.maxHours) || args.maxHours <= 0) throw new Error('--max-hours must be > 0');
    if (!Number.isFinite(args.trainGames) || args.trainGames < 1) throw new Error('--train-games must be >= 1');
    if (!Number.isFinite(args.evalGames) || args.evalGames < 1) throw new Error('--eval-games must be >= 1');
    if (!Number.isFinite(args.selfplayJobs) || args.selfplayJobs < 1) throw new Error('--selfplay-jobs must be >= 1');
    args.selfplayJobs = Math.floor(args.selfplayJobs);
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
    args.selfplayTacticalDepthOpening = Math.floor(args.selfplayTacticalDepthOpening);
    args.selfplayTacticalDepthMid = Math.floor(args.selfplayTacticalDepthMid);
    args.selfplayTacticalDepthEnd = Math.floor(args.selfplayTacticalDepthEnd);
    args.selfplayTacticalBeamWidth = Math.floor(args.selfplayTacticalBeamWidth);
    if (!Number.isFinite(args.onnxEpochs) || args.onnxEpochs < 1) throw new Error('--onnx-epochs must be >= 1');
    if (!Number.isFinite(args.onnxBatchSize) || args.onnxBatchSize < 1) throw new Error('--onnx-batch-size must be >= 1');
    if (!Number.isFinite(args.onnxLr) || args.onnxLr <= 0) throw new Error('--onnx-lr must be > 0');
    if (!Number.isFinite(args.onnxHiddenSize) || args.onnxHiddenSize < 8) throw new Error('--onnx-hidden-size must be >= 8');
    if (args.onnxDevice !== 'auto' && args.onnxDevice !== 'cpu' && args.onnxDevice !== 'cuda') {
        throw new Error('--onnx-device must be one of auto/cpu/cuda');
    }
    if (!Number.isFinite(args.onnxLogIntervalSteps) || args.onnxLogIntervalSteps < 0) {
        throw new Error('--onnx-log-interval-steps must be >= 0');
    }
    if (!Number.isFinite(args.onnxValSplit) || args.onnxValSplit < 0 || args.onnxValSplit >= 0.5) {
        throw new Error('--onnx-val-split must be in [0,0.5)');
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
    if (!Number.isFinite(args.adoptionQualityWeightFinalCornerShare) || args.adoptionQualityWeightFinalCornerShare < 0 || args.adoptionQualityWeightFinalCornerShare > 1) {
        throw new Error('--adoption-quality-weight-final-corner-share must be in [0,1]');
    }
    if (!Number.isFinite(args.adoptionQualityWeightFinalEdgeShare) || args.adoptionQualityWeightFinalEdgeShare < 0 || args.adoptionQualityWeightFinalEdgeShare > 1) {
        throw new Error('--adoption-quality-weight-final-edge-share must be in [0,1]');
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
    if (args.promotionMode !== 'strict' && args.promotionMode !== 'onnx-primary') {
        throw new Error('--promotion-mode must be strict or onnx-primary');
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
    if (!args.runTag) args.runTag = makeRunTag();
    if (!args.summaryOut) args.summaryOut = path.resolve(args.runsDir, `training-cycle.${args.runTag}.json`);

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-selfplay-training-cycle.js [options]',
        '',
        'Options:',
        '  -n, --iterations <n>        Number of full training cycles (default: 1)',
        '      --max-hours <h>         Time budget in hours (default: 100)',
        '      --train-games <n>       Self-play games for train data (default: 20000)',
        '      --eval-games <n>        Self-play games for eval data (default: 2000)',
        '      --selfplay-jobs <n>     Parallel workers for self-play generation (default: auto, up to 10)',
        '      --adoption-jobs <n>     Parallel workers for adoption benchmark (default: auto, up to 10)',
        '      --onnx-gate-jobs <n>    Parallel workers for ONNX gate matches (default: auto, up to 10)',
        '  -s, --seed <n>              Base seed (default: 1)',
        '      --seed-stride <n>       Seed step per iteration (default: 1000)',
        '      --eval-seed-offset <n>  Eval seed offset from train seed (default: 100000)',
        '      --max-plies <n>         Max plies per game (default: 220)',
        '      --with-cards            Enable cards in self-play (default: on)',
        '      --no-cards              Disable cards in self-play',
        '      --card-usage-rate <r>   Card usage rate [0..1] (default: 0.2)',
        '      --selfplay-policy-mix-rate <r> Probability to use guide model per player/game [0..1] (default: 1)',
        '      --selfplay-policy-model-pool-size <n> Recent promoted/candidate models kept in self-play pool (default: 4)',
        '      --selfplay-policy-pool-sampling <mode> Model-pool sampling mode uniform|recency (default: recency)',
        '      --selfplay-policy-pool-recency-decay <r> Recency decay (>0) for recency sampling (default: 2.5)',
        '      --selfplay-policy-current-anchor-rate <r> Probability to anchor one side to current guide model [0..1] (default: 0.35)',
        '      --selfplay-card-usage-rate-jitter <r> Per-game card usage jitter (+/-r) [0..1] (default: 0)',
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
        '      --python <path>         Python executable path (default: .venv/Scripts/python.exe)',
        '      --onnx-epochs <n>       train_policy_onnx --epochs (default: 9999)',
        '      --onnx-batch-size <n>   train_policy_onnx --batch-size (default: 2048)',
        '      --onnx-lr <r>           train_policy_onnx --lr (default: 0.001)',
        '      --onnx-hidden-size <n>  train_policy_onnx --hidden-size (default: 256)',
        '      --onnx-device <mode>    train_policy_onnx --device auto/cpu/cuda (default: auto)',
        '      --onnx-log-interval-steps <n>  train_policy_onnx step log interval (default: 0=off)',
        '      --onnx-val-split <r>    train_policy_onnx --val-split [0..0.5) (default: 0.1)',
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
        '      --adoption-quality-weight-edge <r> Adoption quality edge-take weight [0..1] (default: 0.16)',
        '      --adoption-quality-weight-corner-recovery <r> Adoption quality corner-recovery weight [0..1] (default: 0.18)',
        '      --adoption-quality-weight-corner-recapture <r> Adoption quality corner-recapture weight [0..1] (default: 0.14)',
        '      --adoption-quality-weight-edge-recovery <r> Adoption quality edge-recovery weight [0..1] (default: 0.12)',
        '      --adoption-quality-weight-corner-hold <r> Adoption quality corner-hold weight [0..1] (default: 0.16)',
        '      --adoption-quality-weight-corner-hold-turns <r> Adoption quality corner-hold-turns weight [0..1] (default: 0.10)',
        '      --adoption-quality-weight-edge-hold <r> Adoption quality edge-hold weight [0..1] (default: 0.10)',
        '      --adoption-quality-weight-final-corner-share <r> Adoption quality final corner share weight [0..1] (default: 0.24)',
        '      --adoption-quality-weight-final-edge-share <r> Adoption quality final edge share weight [0..1] (default: 0.10)',
        '      --adoption-quality-weight-bonus <r> Adoption quality bonus weight [0..1] (default: 0.01)',
        '      --adoption-quality-weight-card-immediate <r> Adoption quality card-immediate weight [0..1] (default: 0.015)',
        '      --adoption-quality-weight-card-future <r> Adoption quality card-future(3ply) weight [0..1] (default: 0.02)',
        '      --adoption-quality-weight-place-delta <r> Adoption quality place-delta weight [0..1] (default: 0.015)',
        '      --adoption-use-guide-baseline  Compare candidate against current guide model in adoption benchmark',
        '      --no-adoption-use-guide-baseline Disable guide-model baseline compare (default)',
        '      --onnx-gate             Enable browser ONNX gate before promotion (default: off)',
        '      --no-onnx-gate          Disable browser ONNX gate',
        '      --onnx-gate-games <n>   ONNX gate games per side/seed (default: 8)',
        '      --onnx-gate-seed-count <n> ONNX gate seed count (default: 1)',
        '      --onnx-gate-seed-stride <n> ONNX gate seed stride (default: 1000)',
        '      --onnx-gate-seed-offset <n> ONNX gate base seed offset (default: 700000)',
        '      --onnx-gate-threshold <r> ONNX gate average score threshold [0..1] (default: 0.5)',
        '      --onnx-gate-min-seed-score <r> ONNX gate minimum seed score [0..1] (default: 0)',
        '      --onnx-gate-min-seed-pass-count <n> ONNX gate minimum passing seeds (default: 0)',
        '      --onnx-gate-timeout-ms <n> ONNX gate per-match timeout in ms (default: 180000)',
        '      --onnx-gate-black-level <n> ONNX gate black CPU level [1..6] (default: 6)',
        '      --onnx-gate-white-level <n> ONNX gate white CPU level [1..6] (default: 6)',
        '      --onnx-gate-candidate-color-mode <m> ONNX gate candidate side mode both|white (default: both)',
        '      --promotion-mode <mode> Promotion gate strategy: strict | onnx-primary (default: strict)',
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
        '      --promote               Promote model when selected promotion mode passes (default: on)',
        '      --no-promote            Skip promotion even when final check passes',
        '      --selfplay-use-promoted-model-only        Update next self-play guide only when promotion succeeds (default: on)',
        '      --selfplay-use-candidate-every-iteration  Update next self-play guide to latest candidate every iteration',
        '      --bootstrap-policy-model <path>  Seed self-play with an existing policy-table JSON',
        '      --resume-checkpoint <path>       Resume ONNX training from checkpoint (.pt)',
        '      --carry-over-checkpoint          Carry candidate checkpoint to next iteration (default: on)',
        '      --no-carry-over-checkpoint       Do not carry checkpoint to next iteration',
        '      --run-tag <tag>         Tag appended to output filenames',
        '      --runs-dir <path>       Output directory for records/results (default: data/runs)',
        '      --models-dir <path>     Output directory for candidate models (default: data/models)',
        '      --summary-out <path>    Output summary JSON path',
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
            throw err;
        }
        throw result.error;
    }
    if (!allowExitCodes.includes(result.status)) {
        throw new Error(`command failed (exit=${result.status}): ${shown}`);
    }
    return { status: result.status, elapsedMs };
}

function iterationTag(runTag, iterationIndex) {
    return `${runTag}.it${String(iterationIndex).padStart(2, '0')}`;
}

function buildIterationPaths(args, iterationIndex) {
    const tag = iterationTag(args.runTag, iterationIndex);
    return {
        tag,
        trainDataPath: path.resolve(args.runsDir, `selfplay.train.${tag}.ndjson`),
        trainHardcaseDataPath: path.resolve(args.runsDir, `selfplay.train.hardcase.${tag}.ndjson`),
        evalDataPath: path.resolve(args.runsDir, `selfplay.eval.${tag}.ndjson`),
        evalHardcaseDataPath: path.resolve(args.runsDir, `selfplay.eval.hardcase.${tag}.ndjson`),
        onnxModelPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx`),
        onnxMetaPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx.meta.json`),
        checkpointPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.checkpoint.pt`),
        onnxMetricsPath: path.resolve(args.runsDir, `train.metrics.${tag}.jsonl`),
        candidateModelPath: path.resolve(args.modelsDir, `policy-table.candidate.${tag}.json`),
        quickAdoptionPath: path.resolve(args.runsDir, `adoption.quick.${tag}.json`),
        finalAdoptionPath: path.resolve(args.runsDir, `adoption.final.${tag}.json`),
        onnxGatePath: path.resolve(args.runsDir, `adoption.onnx.${tag}.json`)
    };
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

function buildInitialGuideModelPoolPaths(modelsDir, guideModelPath, maxSize) {
    const limit = Number.isFinite(maxSize) ? Math.max(1, Math.floor(maxSize)) : 1;
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
    if (!modelsDir || !fs.existsSync(modelsDir)) {
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

function getRemainingMs(deadlineMs) {
    if (!Number.isFinite(deadlineMs)) return null;
    return Math.max(0, deadlineMs - Date.now());
}

function runIteration(args, iterationIndex, deadlineMs, carryOver) {
    const seed = args.seed + ((iterationIndex - 1) * args.seedStride);
    const finalAdoptionSeed = seed + args.adoptionFinalSeedOffset;
    const evalSeed = seed + args.evalSeedOffset;
    const p = buildIterationPaths(args, iterationIndex);
    const steps = [];
    const guideModelPath = carryOver && carryOver.guideModelPath ? carryOver.guideModelPath : null;
    const guideModelPoolPaths = carryOver && Array.isArray(carryOver.guideModelPoolPaths)
        ? carryOver.guideModelPoolPaths.filter((one) => !!one)
        : [];
    const resumeCheckpointPath = carryOver && carryOver.resumeCheckpointPath ? carryOver.resumeCheckpointPath : null;
    const generateCardArgs = args.allowCardUsage
        ? ['--with-cards', '--card-usage-rate', String(args.cardUsageRate)]
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
        '--teacher-committee-consensus-bonus-max', String(args.selfplayTeacherCommitteeConsensusBonusMax)
    ];
    const guideModelArgs = [];
    if (guideModelPath) {
        guideModelArgs.push('--policy-model', guideModelPath);
    }
    if (guideModelPoolPaths.length > 0) {
        guideModelArgs.push('--policy-model-pool', guideModelPoolPaths.join(','));
    }
    const adoptionBaselineArgs = (args.adoptionUseGuideBaseline && guideModelPath)
        ? ['--baseline-model', guideModelPath]
        : [];
    const verboseArgs = args.verbose ? ['--verbose'] : [];
    const adoptionCardRate = args.allowCardUsage ? args.cardUsageRate : 0;
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

    fs.mkdirSync(args.runsDir, { recursive: true });
    fs.mkdirSync(args.modelsDir, { recursive: true });

    const runStep = (name, cmd, stepArgs, options) => {
        const remainingMs = getRemainingMs(deadlineMs);
        if (Number.isFinite(remainingMs) && remainingMs <= 0) {
            const err = new Error(`time budget exceeded before ${name}`);
            err.code = 'TIME_BUDGET_EXCEEDED';
            throw err;
        }
        const result = runCommand(cmd, stepArgs, Object.assign({}, options || {}, {
            timeoutMs: Number.isFinite(remainingMs) ? remainingMs : undefined
        }));
        steps.push({ name, ...result });
        return result;
    };

    runStep('generate-train', process.execPath, [
        path.resolve('scripts', 'generate-selfplay-data.js'),
        '--games', String(args.trainGames),
        '--seed', String(seed),
        '--max-plies', String(args.maxPlies),
        '--out', p.trainDataPath,
        '--hardcase-out', p.trainHardcaseDataPath,
        '--seed-family', 'train',
        '--data-lane', 'train-main',
        '--jobs', String(args.selfplayJobs)
    ].concat(generateCardArgs, selfplayDiversityArgs, guideModelArgs, verboseArgs));

    runStep('generate-eval', process.execPath, [
        path.resolve('scripts', 'generate-selfplay-data.js'),
        '--games', String(args.evalGames),
        '--seed', String(evalSeed),
        '--max-plies', String(args.maxPlies),
        '--out', p.evalDataPath,
        '--hardcase-out', p.evalHardcaseDataPath,
        '--seed-family', 'eval',
        '--data-lane', 'eval-suite',
        '--jobs', String(args.selfplayJobs)
    ].concat(generateCardArgs, selfplayDiversityArgs, guideModelArgs, verboseArgs));

    runStep('train-policy', args.pythonPath, [
        path.resolve('ai', 'train', 'train_policy_onnx.py'),
        '--input', p.trainDataPath,
        '--onnx-out', p.onnxModelPath,
        '--meta-out', p.onnxMetaPath,
        '--policy-table-out', p.candidateModelPath,
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(args.onnxLr),
        '--hidden-size', String(args.onnxHiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-min-epochs', String(args.onnxEarlyStopMinEpochs),
        '--early-stop-monitor', args.onnxEarlyStopMonitor,
        '--early-stop-smoothing-window', String(args.onnxEarlyStopSmoothingWindow),
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
        '--metrics-out', p.onnxMetricsPath,
        '--min-visits', String(args.minVisits),
        '--shape-immediate', String(args.shapeImmediate),
        '--checkpoint-out', p.checkpointPath
    ]
        .concat(resumeCheckpointPath ? ['--resume-checkpoint', resumeCheckpointPath] : [])
        .concat(args.onnxResumeOptimizer ? ['--resume-optimizer'] : []));

    runStep('evaluate-policy', args.pythonPath, [
        path.resolve('ai', 'train', 'evaluate_policy_table.py'),
        '--input', p.evalDataPath,
        '--model', p.candidateModelPath
    ]);

    runStep('adoption-quick', process.execPath, [
        path.resolve('scripts', 'benchmark-policy-adoption.js'),
        '--games', String(args.quickGames),
        '--seed', String(seed),
        '--seed-count', String(quickAdoptionSeedCount),
        '--seed-stride', String(quickAdoptionSeedStride),
        '--jobs', String(args.adoptionJobs),
        '--max-plies', String(args.maxPlies),
        '--threshold', String(quickAdoptionThreshold),
        '--confidence-level', String(quickAdoptionConfidenceLevel),
        '--min-lower-bound', String(quickAdoptionMinLowerBound),
        '--min-seed-uplift', String(quickAdoptionMinSeedUplift),
        '--min-seed-pass-count', String(quickAdoptionMinSeedPassCount),
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
        '--quality-weight-final-corner-share', String(args.adoptionQualityWeightFinalCornerShare),
        '--quality-weight-final-edge-share', String(args.adoptionQualityWeightFinalEdgeShare),
        '--quality-weight-bonus', String(args.adoptionQualityWeightBonus),
        '--quality-weight-card-immediate', String(args.adoptionQualityWeightCardImmediate),
        '--quality-weight-card-future', String(args.adoptionQualityWeightCardFuture),
        '--quality-weight-place-delta', String(args.adoptionQualityWeightPlaceDelta),
        '--candidate-model', p.candidateModelPath,
        '--out', p.quickAdoptionPath
    ].concat(adoptionBaselineArgs, verboseArgs), { allowExitCodes: [0, 2] });
    const quickPayload = readJsonSafe(p.quickAdoptionPath);
    const quickPassed = !!(quickPayload && quickPayload.decision && quickPayload.decision.passed);
    const quickDecision = quickPayload && quickPayload.decision ? quickPayload.decision : null;
    const quickUplift = quickDecision && Number.isFinite(quickDecision.uplift)
        ? Number(quickDecision.uplift)
        : -Infinity;
    const quickUpliftLowerBound = quickDecision && Number.isFinite(quickDecision.upliftLowerBound)
        ? Number(quickDecision.upliftLowerBound)
        : -Infinity;
    const quickRegressionWithinOnnxPrimaryLimit = quickUplift >= (-args.onnxPrimaryMaxQuickRegression);
    const quickCoreDelta = resolveQuickComponentDelta(
        quickPayload,
        quickDecision,
        'baselineCoreScore',
        'candidateCoreScore'
    );
    const quickWhiteDelta = resolveQuickComponentDelta(
        quickPayload,
        quickDecision,
        'baselineWhiteScore',
        'candidateWhiteScore'
    );
    const quickQualityDelta = resolveQuickComponentDelta(
        quickPayload,
        quickDecision,
        'baselineQualityScore',
        'candidateQualityScore'
    );
    const quickNonRegressionWithinOnnxPrimaryLimit =
        quickCoreDelta >= args.onnxPrimaryMinQuickCoreDelta &&
        quickWhiteDelta >= args.onnxPrimaryMinQuickWhiteDelta &&
        quickQualityDelta >= args.onnxPrimaryMinQuickQualityDelta;

    let finalPayload = null;
    let finalPassed = false;
    const shouldRunFinalAdoption = quickPassed && args.promotionMode !== 'onnx-primary';
    if (shouldRunFinalAdoption) {
        runStep('adoption-final', process.execPath, [
            path.resolve('scripts', 'benchmark-policy-adoption.js'),
            '--games', String(args.finalGames),
            '--seed', String(finalAdoptionSeed),
            '--seed-count', String(finalAdoptionSeedCount),
            '--seed-stride', String(finalAdoptionSeedStride),
            '--jobs', String(args.adoptionJobs),
            '--max-plies', String(args.maxPlies),
            '--threshold', String(finalAdoptionThreshold),
            '--confidence-level', String(finalAdoptionConfidenceLevel),
            '--min-lower-bound', String(finalAdoptionMinLowerBound),
            '--min-seed-uplift', String(finalAdoptionMinSeedUplift),
            '--min-seed-pass-count', String(finalAdoptionMinSeedPassCount),
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
            '--quality-weight-final-corner-share', String(args.adoptionQualityWeightFinalCornerShare),
            '--quality-weight-final-edge-share', String(args.adoptionQualityWeightFinalEdgeShare),
            '--quality-weight-bonus', String(args.adoptionQualityWeightBonus),
            '--quality-weight-card-immediate', String(args.adoptionQualityWeightCardImmediate),
            '--quality-weight-card-future', String(args.adoptionQualityWeightCardFuture),
            '--quality-weight-place-delta', String(args.adoptionQualityWeightPlaceDelta),
            '--candidate-model', p.candidateModelPath,
            '--out', p.finalAdoptionPath
        ].concat(adoptionBaselineArgs, verboseArgs), { allowExitCodes: [0, 2] });
        finalPayload = readJsonSafe(p.finalAdoptionPath);
        finalPassed = !!(finalPayload && finalPayload.decision && finalPayload.decision.passed);
    }

    let onnxGatePayload = null;
    let onnxGatePassed = !args.onnxGateEnabled;
    const shouldRunOnnxGate = args.onnxGateEnabled && (finalPassed || args.promotionMode === 'onnx-primary');
    if (shouldRunOnnxGate) {
        runStep('adoption-onnx-gate', process.execPath, [
            path.resolve('scripts', 'benchmark-policy-onnx-gate.js'),
            '--games', String(args.onnxGateGames),
            '--seed', String(seed + args.onnxGateSeedOffset),
            '--seed-count', String(args.onnxGateSeedCount),
            '--seed-stride', String(args.onnxGateSeedStride),
            '--jobs', String(args.onnxGateJobs),
            '--threshold', String(args.onnxGateThreshold),
            '--min-seed-score', String(args.onnxGateMinSeedScore),
            '--min-seed-pass-count', String(args.onnxGateMinSeedPassCount),
            '--timeout-ms', String(args.onnxGateTimeoutMs),
            '--black-level', String(args.onnxGateBlackLevel),
            '--white-level', String(args.onnxGateWhiteLevel),
            '--candidate-color-mode', String(args.onnxGateCandidateColorMode),
            '--candidate-onnx', p.onnxModelPath,
            '--candidate-onnx-meta', p.onnxMetaPath,
            '--out', p.onnxGatePath
        ], { allowExitCodes: [0, 2] });
        onnxGatePayload = readJsonSafe(p.onnxGatePath);
        onnxGatePassed = !!(onnxGatePayload && onnxGatePayload.decision && onnxGatePayload.decision.passed);
    }

    const strictPromoteEligible = finalPassed && onnxGatePassed;
    const onnxPrimaryQuickGuardPassed = !args.onnxPrimaryRequireQuickRegression || quickRegressionWithinOnnxPrimaryLimit;
    const onnxPrimaryQuickNonRegressionGuardPassed = !args.onnxPrimaryRequireQuickNonRegression || quickNonRegressionWithinOnnxPrimaryLimit;
    const onnxGateDecision = onnxGatePayload && onnxGatePayload.decision ? onnxGatePayload.decision : null;
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
        onnxGatePassed &&
        onnxPrimaryQuickGuardPassed &&
        onnxPrimaryQuickNonRegressionGuardPassed &&
        onnxPrimaryQuickUpliftGuardPassed &&
        onnxPrimaryQuickLowerBoundGuardPassed &&
        onnxPrimaryOnnxGateAvgGuardPassed &&
        onnxPrimaryOnnxGateMinSeedGuardPassed;
    const promoteEligible = args.promotionMode === 'onnx-primary'
        ? onnxPrimaryPromoteEligible
        : strictPromoteEligible;

    let promoted = false;
    if (promoteEligible && args.promoteOnPass) {
        const adoptionResultPath = (args.promotionMode === 'onnx-primary' && !finalPassed)
            ? p.quickAdoptionPath
            : p.finalAdoptionPath;
        const promoteArgs = [
            path.resolve('scripts', 'promote-policy-model.js'),
            '--adoption-result', adoptionResultPath,
            '--candidate-model', p.candidateModelPath,
            '--candidate-onnx', p.onnxModelPath,
            '--candidate-onnx-meta', p.onnxMetaPath
        ];
        if (args.promotionMode === 'onnx-primary' && !finalPassed) {
            promoteArgs.push('--force');
        }
        runStep('promote-model', process.execPath, promoteArgs);
        promoted = true;
    }

    return {
        iteration: iterationIndex,
        seed,
        finalAdoptionSeed,
        evalSeed,
        usedGuideModelPath: guideModelPath,
        usedGuideModelPoolPaths: guideModelPoolPaths,
        usedResumeCheckpointPath: resumeCheckpointPath,
        paths: p,
        quickAdoptionConfig: {
            threshold: quickAdoptionThreshold,
            seedCount: quickAdoptionSeedCount,
            seedStride: quickAdoptionSeedStride,
            confidenceLevel: quickAdoptionConfidenceLevel,
            minLowerBound: quickAdoptionMinLowerBound,
            minSeedUplift: quickAdoptionMinSeedUplift,
            minSeedPassCount: quickAdoptionMinSeedPassCount
        },
        finalAdoptionConfig: {
            threshold: finalAdoptionThreshold,
            seedCount: finalAdoptionSeedCount,
            seedStride: finalAdoptionSeedStride,
            confidenceLevel: finalAdoptionConfidenceLevel,
            minLowerBound: finalAdoptionMinLowerBound,
            minSeedUplift: finalAdoptionMinSeedUplift,
            minSeedPassCount: finalAdoptionMinSeedPassCount
        },
        quickDecision,
        finalDecision: finalPayload && finalPayload.decision ? finalPayload.decision : null,
        onnxGateDecision: onnxGatePayload && onnxGatePayload.decision ? onnxGatePayload.decision : null,
        promotionDetail: {
            mode: args.promotionMode,
            promoteEligible,
            strictPromoteEligible,
            onnxPrimaryPromoteEligible,
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
        steps
    };
}

function writeSummarySnapshot(args, startedAt, iterations, guideModelPath, guideModelPoolPaths, resumeCheckpointPath, stoppedByTimeBudget, stopReason) {
    const payload = {
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        config: {
            iterations: args.iterations,
            maxHours: args.maxHours,
            trainGames: args.trainGames,
            evalGames: args.evalGames,
            selfplayJobs: args.selfplayJobs,
            adoptionJobs: args.adoptionJobs,
            onnxGateJobs: args.onnxGateJobs,
            seed: args.seed,
            seedStride: args.seedStride,
            evalSeedOffset: args.evalSeedOffset,
            maxPlies: args.maxPlies,
            allowCardUsage: args.allowCardUsage,
            cardUsageRate: args.cardUsageRate,
            selfplayPolicyMixRate: args.selfplayPolicyMixRate,
            selfplayPolicyModelPoolSize: args.selfplayPolicyModelPoolSize,
            selfplayPolicyPoolSampling: args.selfplayPolicyPoolSampling,
            selfplayPolicyPoolRecencyDecay: args.selfplayPolicyPoolRecencyDecay,
            selfplayPolicyCurrentAnchorRate: args.selfplayPolicyCurrentAnchorRate,
            selfplayCardUsageRateJitter: args.selfplayCardUsageRateJitter,
            selfplayTacticalWeightMin: args.selfplayTacticalWeightMin,
            selfplayTacticalWeightMax: args.selfplayTacticalWeightMax,
            selfplayTacticalDepthOpening: args.selfplayTacticalDepthOpening,
            selfplayTacticalDepthMid: args.selfplayTacticalDepthMid,
            selfplayTacticalDepthEnd: args.selfplayTacticalDepthEnd,
            selfplayTacticalBeamWidth: args.selfplayTacticalBeamWidth,
            selfplayTeacherCommitteeWeightMin: args.selfplayTeacherCommitteeWeightMin,
            selfplayTeacherCommitteeWeightMax: args.selfplayTeacherCommitteeWeightMax,
            selfplayTeacherCommitteeConsensusBonusMin: args.selfplayTeacherCommitteeConsensusBonusMin,
            selfplayTeacherCommitteeConsensusBonusMax: args.selfplayTeacherCommitteeConsensusBonusMax,
            pythonPath: args.pythonPath,
            onnxEpochs: args.onnxEpochs,
            onnxBatchSize: args.onnxBatchSize,
            onnxLr: args.onnxLr,
            onnxHiddenSize: args.onnxHiddenSize,
            onnxDevice: args.onnxDevice,
            onnxLogIntervalSteps: args.onnxLogIntervalSteps,
            onnxValSplit: args.onnxValSplit,
            onnxEarlyStopPatience: args.onnxEarlyStopPatience,
            onnxEarlyStopMinDelta: args.onnxEarlyStopMinDelta,
            onnxEarlyStopMinEpochs: args.onnxEarlyStopMinEpochs,
            onnxEarlyStopMonitor: args.onnxEarlyStopMonitor,
            onnxEarlyStopSmoothingWindow: args.onnxEarlyStopSmoothingWindow,
            onnxResumeOptimizer: args.onnxResumeOptimizer,
            onnxCardNoActionWeight: args.onnxCardNoActionWeight,
            onnxCardClassBalancePower: args.onnxCardClassBalancePower,
            onnxWinnerSampleBoost: args.onnxWinnerSampleBoost,
            onnxLoserSampleWeight: args.onnxLoserSampleWeight,
            onnxDrawSampleWeight: args.onnxDrawSampleWeight,
            onnxCornerEmergencySampleBoost: args.onnxCornerEmergencySampleBoost,
            onnxNegativeFutureDiscSampleBoost: args.onnxNegativeFutureDiscSampleBoost,
            onnxNegativeFutureDiscThreshold: args.onnxNegativeFutureDiscThreshold,
            onnxTacticalMissSampleBoost: args.onnxTacticalMissSampleBoost,
            onnxTacticalMissThreshold: args.onnxTacticalMissThreshold,
            minVisits: args.minVisits,
            shapeImmediate: args.shapeImmediate,
            quickGames: args.quickGames,
            finalGames: args.finalGames,
            threshold: args.threshold,
            adoptionSeedCount: args.adoptionSeedCount,
            adoptionSeedStride: args.adoptionSeedStride,
            adoptionFinalSeedOffset: args.adoptionFinalSeedOffset,
            adoptionConfidenceLevel: args.adoptionConfidenceLevel,
            adoptionMinLowerBound: args.adoptionMinLowerBound,
            adoptionMinSeedUplift: args.adoptionMinSeedUplift,
            adoptionMinSeedPassCount: args.adoptionMinSeedPassCount,
            quickAdoptionThreshold: args.quickAdoptionThreshold,
            quickAdoptionSeedCount: args.quickAdoptionSeedCount,
            quickAdoptionSeedStride: args.quickAdoptionSeedStride,
            quickAdoptionConfidenceLevel: args.quickAdoptionConfidenceLevel,
            quickAdoptionMinLowerBound: args.quickAdoptionMinLowerBound,
            quickAdoptionMinSeedUplift: args.quickAdoptionMinSeedUplift,
            quickAdoptionMinSeedPassCount: args.quickAdoptionMinSeedPassCount,
            finalAdoptionThreshold: args.finalAdoptionThreshold,
            finalAdoptionSeedCount: args.finalAdoptionSeedCount,
            finalAdoptionSeedStride: args.finalAdoptionSeedStride,
            finalAdoptionConfidenceLevel: args.finalAdoptionConfidenceLevel,
            finalAdoptionMinLowerBound: args.finalAdoptionMinLowerBound,
            finalAdoptionMinSeedUplift: args.finalAdoptionMinSeedUplift,
            finalAdoptionMinSeedPassCount: args.finalAdoptionMinSeedPassCount,
            adoptionTacticalWeight: args.adoptionTacticalWeight,
            adoptionTacticalDepthOpening: args.adoptionTacticalDepthOpening,
            adoptionTacticalDepthMid: args.adoptionTacticalDepthMid,
            adoptionTacticalDepthEnd: args.adoptionTacticalDepthEnd,
            adoptionTacticalBeamWidth: args.adoptionTacticalBeamWidth,
            adoptionPolicyScoreWeight: args.adoptionPolicyScoreWeight,
            adoptionHeuristicWeight: args.adoptionHeuristicWeight,
            adoptionWhitePriority: args.adoptionWhitePriority,
            adoptionQualityWeightCorner: args.adoptionQualityWeightCorner,
            adoptionQualityWeightEdge: args.adoptionQualityWeightEdge,
            adoptionQualityWeightCornerRecovery: args.adoptionQualityWeightCornerRecovery,
            adoptionQualityWeightCornerRecapture: args.adoptionQualityWeightCornerRecapture,
            adoptionQualityWeightEdgeRecovery: args.adoptionQualityWeightEdgeRecovery,
            adoptionQualityWeightCornerHold: args.adoptionQualityWeightCornerHold,
            adoptionQualityWeightCornerHoldTurns: args.adoptionQualityWeightCornerHoldTurns,
            adoptionQualityWeightEdgeHold: args.adoptionQualityWeightEdgeHold,
            adoptionQualityWeightFinalCornerShare: args.adoptionQualityWeightFinalCornerShare,
            adoptionQualityWeightFinalEdgeShare: args.adoptionQualityWeightFinalEdgeShare,
            adoptionQualityWeightBonus: args.adoptionQualityWeightBonus,
            adoptionQualityWeightCardImmediate: args.adoptionQualityWeightCardImmediate,
            adoptionQualityWeightCardFuture: args.adoptionQualityWeightCardFuture,
            adoptionQualityWeightPlaceDelta: args.adoptionQualityWeightPlaceDelta,
            adoptionUseGuideBaseline: args.adoptionUseGuideBaseline,
            onnxGateEnabled: args.onnxGateEnabled,
            onnxGateGames: args.onnxGateGames,
            onnxGateSeedCount: args.onnxGateSeedCount,
            onnxGateSeedStride: args.onnxGateSeedStride,
            onnxGateSeedOffset: args.onnxGateSeedOffset,
            onnxGateThreshold: args.onnxGateThreshold,
            onnxGateMinSeedScore: args.onnxGateMinSeedScore,
            onnxGateMinSeedPassCount: args.onnxGateMinSeedPassCount,
            onnxGateTimeoutMs: args.onnxGateTimeoutMs,
            onnxGateBlackLevel: args.onnxGateBlackLevel,
            onnxGateWhiteLevel: args.onnxGateWhiteLevel,
            onnxGateCandidateColorMode: args.onnxGateCandidateColorMode,
            promotionMode: args.promotionMode,
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
            promoteOnPass: args.promoteOnPass,
            selfplayUsePromotedModelOnly: args.selfplayUsePromotedModelOnly,
            bootstrapPolicyModelPath: args.bootstrapPolicyModelPath,
            resumeCheckpointPath: args.resumeCheckpointPath,
            carryOverCheckpoint: args.carryOverCheckpoint,
            runTag: args.runTag
        },
        latestGuideModelPath: guideModelPath,
        latestGuideModelPoolPaths: guideModelPoolPaths,
        latestResumeCheckpointPath: resumeCheckpointPath,
        stoppedByTimeBudget,
        stopReason,
        iterations
    };
    fs.mkdirSync(path.dirname(args.summaryOut), { recursive: true });
    fs.writeFileSync(args.summaryOut, JSON.stringify(payload, null, 2), 'utf8');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    console.log(`[training-cycle] selfplay guide update mode=${args.selfplayUsePromotedModelOnly ? 'promoted-only' : 'candidate-every-iteration'}`);
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

    const startedAt = Date.now();
    const deadlineMs = startedAt + Math.floor(args.maxHours * 60 * 60 * 1000);
    const iterations = [];
    let guideModelPath = args.bootstrapPolicyModelPath || null;
    let guideModelPoolPaths = buildInitialGuideModelPoolPaths(
        args.modelsDir,
        guideModelPath,
        args.selfplayPolicyModelPoolSize
    );
    let resumeCheckpointPath = args.resumeCheckpointPath || null;
    let stoppedByTimeBudget = false;
    let stopReason = null;
    for (let i = 1; i <= args.iterations; i++) {
        if (getRemainingMs(deadlineMs) <= 0) {
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
                resumeCheckpointPath
            });
        } catch (err) {
            if (err && (err.code === 'TIME_BUDGET_EXCEEDED' || err.code === 'COMMAND_TIMEOUT')) {
                stoppedByTimeBudget = true;
                stopReason = err.message || 'time budget reached';
                break;
            }
            throw err;
        }
        iterations.push(result);
        const finalPassed = !!(result.finalDecision && result.finalDecision.passed);
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
            const shouldAdvanceGuide = !args.selfplayUsePromotedModelOnly || !!result.promoted;
            if (result.paths.candidateModelPath && fs.existsSync(result.paths.candidateModelPath)) {
                if (shouldAdvanceGuide) {
                    const promotedModelPath = path.resolve(args.modelsDir, 'policy-table.json');
                    guideModelPath = (result.promoted && fs.existsSync(promotedModelPath))
                        ? promotedModelPath
                        : result.paths.candidateModelPath;
                    if (guideModelPath) {
                        const deduped = [guideModelPath]
                            .concat(guideModelPoolPaths.filter((one) => path.resolve(one) !== path.resolve(guideModelPath)));
                        guideModelPoolPaths = deduped.slice(0, args.selfplayPolicyModelPoolSize);
                    }
                }
            }
            const shouldCarryOverCheckpoint = args.carryOverCheckpoint && shouldAdvanceGuide;
            if (shouldCarryOverCheckpoint && result.paths.checkpointPath && fs.existsSync(result.paths.checkpointPath)) {
                resumeCheckpointPath = result.paths.checkpointPath;
            } else if (args.carryOverCheckpoint && args.selfplayUsePromotedModelOnly && !result.promoted) {
                console.log(`[training-cycle] iteration ${i} checkpoint carry-over skipped (promoted-only mode, promoted=false)`);
            }
        }
        const quickUpliftLabel = Number.isFinite(quickUplift) ? quickUplift.toFixed(3) : 'n/a';
        const quickCoreDeltaLabel = Number.isFinite(quickCoreDelta) ? quickCoreDelta.toFixed(3) : 'n/a';
        const quickWhiteDeltaLabel = Number.isFinite(quickWhiteDelta) ? quickWhiteDelta.toFixed(3) : 'n/a';
        const quickQualityDeltaLabel = Number.isFinite(quickQualityDelta) ? quickQualityDelta.toFixed(3) : 'n/a';
        console.log(`[training-cycle] iteration ${i} done quick_pass=${!!(result.quickDecision && result.quickDecision.passed)} final_pass=${finalPassed} onnx_gate_pass=${onnxGatePassed} promote_eligible=${promoteEligible} quick_uplift=${quickUpliftLabel} quick_core_delta=${quickCoreDeltaLabel} quick_white_delta=${quickWhiteDeltaLabel} quick_quality_delta=${quickQualityDeltaLabel} quick_non_regression_guard=${quickNonRegressionGuard} quick_uplift_guard=${quickUpliftGuard} quick_lb_guard=${quickLowerBoundGuard} gate_avg_guard=${gateAvgGuard} gate_min_seed_guard=${gateMinSeedGuard} promoted=${result.promoted}`);
        writeSummarySnapshot(
            args,
            startedAt,
            iterations,
            guideModelPath,
            guideModelPoolPaths,
            resumeCheckpointPath,
            stoppedByTimeBudget,
            stopReason
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
        resumeCheckpointPath,
        stoppedByTimeBudget,
        stopReason
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
    buildIterationPaths,
    iterationTag,
    makeRunTag,
    resolveQuickComponentDelta
};
