const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    parseArgs,
    TRAINING_CYCLE_STEP_ORDER,
    buildInitialGuideModelPoolPaths,
    buildIterationPaths,
    hasCoordinatePendingSelectionRecords,
    iterationTag,
    normalizeRestartFromStep,
    resolveAdoptionBaselineMode,
    resolveIterationGateControl,
    resolveSelfplayCardUsageRateForIteration,
    getPrimaryResumeCheckpointPath,
    resolveResumeCheckpointPathsFromArgs,
    resolveNextCarryOverState,
    buildPromotionCommandArgs,
    shouldReuseStepArtifacts,
    shouldRunGateForIteration,
    resolveQuickComponentDelta,
    resolvePromotionEligibility,
    extractTrainingCycleFailureDetail,
    annotateTrainingCycleError
} = require('../scripts/run-selfplay-training-cycle');

describe('selfplay training cycle script', () => {
    test('parseArgs uses long-run defaults', () => {
        const args = parseArgs([]);
        expect(args.maxHours).toBe(100);
        expect(args.onnxEpochs).toBe(9999);
        expect(args.selfplayJobs).toBe(10);
        expect(args.selfplayResumeChunkSize).toBe(1000);
        expect(args.adoptionJobs).toBe(10);
        expect(args.onnxGateJobs).toBe(10);
        expect(args.cardUsageRate).toBeCloseTo(0.2, 6);
        expect(args.selfplayPolicyMixRate).toBeCloseTo(1, 6);
        expect(args.selfplayPolicyModelPoolSize).toBe(4);
        expect(args.selfplayPolicyPoolSampling).toBe('recency');
        expect(args.selfplayPolicyPoolRecencyDecay).toBeCloseTo(2.5, 6);
        expect(args.selfplayPolicyCurrentAnchorRate).toBeCloseTo(0.35, 6);
        expect(args.selfplayCardUsageRateJitter).toBeCloseTo(0, 6);
        expect(args.selfplayCardUsageRateScheduleSpec).toBeNull();
        expect(args.selfplayCardUsageRateSchedule).toEqual([]);
        expect(args.selfplayTacticalWeightMin).toBeCloseTo(1, 6);
        expect(args.selfplayTacticalWeightMax).toBeCloseTo(1, 6);
        expect(args.selfplayTacticalDepthOpening).toBe(4);
        expect(args.selfplayTacticalDepthMid).toBe(6);
        expect(args.selfplayTacticalDepthEnd).toBe(8);
        expect(args.selfplayTacticalBeamWidth).toBe(12);
        expect(args.selfplayPolicyScoreWeightMin).toBeCloseTo(1, 6);
        expect(args.selfplayPolicyScoreWeightMax).toBeCloseTo(1, 6);
        expect(args.selfplayHeuristicWeightMin).toBeCloseTo(1, 6);
        expect(args.selfplayHeuristicWeightMax).toBeCloseTo(1, 6);
        expect(args.onnxEarlyStopPatience).toBe(8);
        expect(args.onnxEarlyStopMinDelta).toBeCloseTo(0.0005, 8);
        expect(args.onnxEarlyStopMinEpochs).toBe(8);
        expect(args.onnxEarlyStopSmoothingWindow).toBe(1);
        expect(args.onnxWinnerSampleBoost).toBeCloseTo(0.35, 6);
        expect(args.onnxLoserSampleWeight).toBeCloseTo(0.8, 6);
        expect(args.onnxDrawSampleWeight).toBeCloseTo(1.0, 6);
        expect(args.onnxCornerEmergencySampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxNegativeFutureDiscSampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxNegativeFutureDiscThreshold).toBeCloseTo(-1.0, 6);
        expect(args.onnxTacticalMissSampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxTacticalMissThreshold).toBeCloseTo(0.08, 6);
        expect(args.onnxHandPressureSampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxPendingTargetSampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxCornerBalanceSampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxEdgeBalanceSampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxEconomyBalanceSampleBoost).toBeCloseTo(0.0, 6);
        expect(args.onnxValueTargetCornerWeight).toBeCloseTo(0.0, 6);
        expect(args.onnxValueTargetEdgeWeight).toBeCloseTo(0.0, 6);
        expect(args.onnxValueTargetEconomyWeight).toBeCloseTo(0.0, 6);
        expect(args.onnxValueTargetCornerEmergencyWeight).toBeCloseTo(0.0, 6);
        expect(args.adoptionTacticalWeight).toBeCloseTo(0.25, 6);
        expect(args.adoptionTacticalDepthOpening).toBe(4);
        expect(args.adoptionTacticalDepthMid).toBe(6);
        expect(args.adoptionTacticalDepthEnd).toBe(8);
        expect(args.adoptionTacticalBeamWidth).toBe(12);
        expect(args.adoptionPolicyScoreWeight).toBeCloseTo(2.0, 6);
        expect(args.adoptionHeuristicWeight).toBeCloseTo(0.85, 6);
        expect(args.adoptionWhitePriority).toBeCloseTo(0.5, 6);
        expect(args.adoptionQualityWeightCorner).toBeCloseTo(0.22, 6);
        expect(args.adoptionQualityWeightEdge).toBeCloseTo(0.16, 6);
        expect(args.adoptionQualityWeightCornerRecovery).toBeCloseTo(0.18, 6);
        expect(args.adoptionQualityWeightCornerRecapture).toBeCloseTo(0.14, 6);
        expect(args.adoptionQualityWeightEdgeRecovery).toBeCloseTo(0.12, 6);
        expect(args.adoptionQualityWeightCornerHold).toBeCloseTo(0.16, 6);
        expect(args.adoptionQualityWeightCornerHoldTurns).toBeCloseTo(0.10, 6);
        expect(args.adoptionQualityWeightEdgeHold).toBeCloseTo(0.10, 6);
        expect(args.adoptionQualityWeightFinalCornerShare).toBeCloseTo(0.24, 6);
        expect(args.adoptionQualityWeightFinalEdgeShare).toBeCloseTo(0.10, 6);
        expect(args.adoptionQualityWeightBonus).toBeCloseTo(0.01, 6);
        expect(args.adoptionQualityWeightCardImmediate).toBeCloseTo(0.015, 6);
        expect(args.adoptionQualityWeightCardFuture).toBeCloseTo(0.02, 6);
        expect(args.adoptionQualityWeightPlaceDelta).toBeCloseTo(0.015, 6);
        expect(args.adoptionConfidenceLevel).toBeCloseTo(0.95, 6);
        expect(args.adoptionMinLowerBound).toBeCloseTo(-1, 6);
        expect(args.qualityGateEnabled).toBe(false);
        expect(args.qualityGateGames).toBe(1000);
        expect(args.qualityGateSeedCount).toBe(1);
        expect(args.qualityGateSeedStride).toBe(1000);
        expect(args.qualityGateSeedOffset).toBe(250000);
        expect(args.qualityGateThreshold).toBeCloseTo(0, 6);
        expect(args.qualityGateConfidenceLevel).toBeCloseTo(0.95, 6);
        expect(args.qualityGateMinLowerBound).toBeCloseTo(-1, 6);
        expect(args.qualityGateMinSeedUplift).toBeCloseTo(-1, 6);
        expect(args.qualityGateMinSeedPassCount).toBe(0);
        expect(args.qualityGateStrengthFirst).toBe(false);
        expect(args.quickAdoptionThreshold).toBeNull();
        expect(args.quickAdoptionSeedOffset).toBe(0);
        expect(args.quickAdoptionSeedCount).toBeNull();
        expect(args.quickAdoptionSeedStride).toBeNull();
        expect(args.quickAdoptionConfidenceLevel).toBeNull();
        expect(args.quickAdoptionMinLowerBound).toBeNull();
        expect(args.quickAdoptionMinSeedUplift).toBeNull();
        expect(args.quickAdoptionMinSeedPassCount).toBeNull();
        expect(args.finalAdoptionThreshold).toBeNull();
        expect(args.finalAdoptionSeedCount).toBeNull();
        expect(args.finalAdoptionSeedStride).toBeNull();
        expect(args.finalAdoptionConfidenceLevel).toBeNull();
        expect(args.finalAdoptionMinLowerBound).toBeNull();
        expect(args.finalAdoptionMinSeedUplift).toBeNull();
        expect(args.finalAdoptionMinSeedPassCount).toBeNull();
        expect(args.adoptionUseGuideBaseline).toBe(false);
        expect(args.adoptionUseAnchorBaseline).toBe(false);
        expect(args.promotionMode).toBe('strict');
        expect(args.onnxPrimaryMaxQuickRegression).toBeCloseTo(0.05, 6);
        expect(args.onnxPrimaryRequireQuickRegression).toBe(false);
        expect(args.onnxPrimaryRequireQuickNonRegression).toBe(false);
        expect(args.onnxPrimaryMinQuickCoreDelta).toBeCloseTo(0, 6);
        expect(args.onnxPrimaryMinQuickWhiteDelta).toBeCloseTo(0, 6);
        expect(args.onnxPrimaryMinQuickQualityDelta).toBeCloseTo(-0.01, 6);
        expect(args.onnxPrimaryMinQuickUplift).toBeCloseTo(0, 6);
        expect(args.onnxPrimaryMinQuickLowerBound).toBeCloseTo(-1, 6);
        expect(args.onnxPrimaryMinOnnxGateAvg).toBeCloseTo(0, 6);
        expect(args.onnxPrimaryMinOnnxGateMinSeed).toBeCloseTo(0, 6);
        expect(args.onnxGateCandidateColorMode).toBe('both');
        expect(args.onnxGateMaxAverageLatencyMs).toBe(0);
        expect(args.onnxGateMaxP95LatencyMs).toBe(0);
        expect(args.onnxGateMaxMaxLatencyMs).toBe(0);
        expect(args.gateFinalIterationOnly).toBe(false);
        expect(args.reuseExistingArtifacts).toBe(false);
    });

    test('parseArgs enables existing artifact reuse when requested', () => {
        const args = parseArgs(['--reuse-existing-artifacts']);
        expect(args.reuseExistingArtifacts).toBe(true);
    });

    test('parseArgs accepts restart-from-step for midpoint reruns', () => {
        const args = parseArgs(['--reuse-existing-artifacts', '--restart-from-step', 'adoption-quality-gate']);
        expect(args.reuseExistingArtifacts).toBe(true);
        expect(args.restartFromStep).toBe('adoption-quality-gate');
    });

    test('parseArgs validates range options', () => {
        expect(() => parseArgs(['--iterations', '0'])).toThrow('--iterations must be >= 1');
        expect(() => parseArgs(['--max-hours', '0'])).toThrow('--max-hours must be > 0');
        expect(() => parseArgs(['--card-usage-rate', '2'])).toThrow('--card-usage-rate must be in [0,1]');
        expect(() => parseArgs(['--selfplay-policy-mix-rate', '2'])).toThrow('--selfplay-policy-mix-rate must be in [0,1]');
        expect(() => parseArgs(['--selfplay-policy-model-pool-size', '0'])).toThrow('--selfplay-policy-model-pool-size must be >= 1');
        expect(() => parseArgs(['--selfplay-policy-pool-sampling', 'bad'])).toThrow('--selfplay-policy-pool-sampling must be uniform or recency');
        expect(() => parseArgs(['--selfplay-policy-pool-recency-decay', '0'])).toThrow('--selfplay-policy-pool-recency-decay must be > 0');
        expect(() => parseArgs(['--selfplay-policy-current-anchor-rate', '-0.1'])).toThrow('--selfplay-policy-current-anchor-rate must be in [0,1]');
        expect(() => parseArgs(['--selfplay-card-usage-rate-jitter', '-0.1'])).toThrow('--selfplay-card-usage-rate-jitter must be in [0,1]');
        expect(() => parseArgs(['--selfplay-card-usage-rate-schedule', 'oops'])).toThrow('--selfplay-card-usage-rate-schedule entries must use <rate>@<iteration>');
        expect(() => parseArgs(['--selfplay-card-usage-rate-schedule', '0.3@2,0.4@2'])).toThrow('--selfplay-card-usage-rate-schedule iterations must be strictly increasing');
        expect(() => parseArgs(['--selfplay-tactical-weight-min', '-1'])).toThrow('--selfplay-tactical-weight-min must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-weight-max', '-1'])).toThrow('--selfplay-tactical-weight-max must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-weight-min', '1.2', '--selfplay-tactical-weight-max', '0.9'])).toThrow('--selfplay-tactical-weight-max must be >= --selfplay-tactical-weight-min');
        expect(() => parseArgs(['--selfplay-tactical-depth-opening', '-1'])).toThrow('--selfplay-tactical-depth-opening must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-depth-mid', '-1'])).toThrow('--selfplay-tactical-depth-mid must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-depth-end', '-1'])).toThrow('--selfplay-tactical-depth-end must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-beam-width', '-1'])).toThrow('--selfplay-tactical-beam-width must be >= 0');
        expect(() => parseArgs(['--selfplay-policy-score-weight-min', '-1'])).toThrow('--selfplay-policy-score-weight-min must be >= 0');
        expect(() => parseArgs(['--selfplay-policy-score-weight-max', '-1'])).toThrow('--selfplay-policy-score-weight-max must be >= 0');
        expect(() => parseArgs(['--selfplay-policy-score-weight-min', '1.1', '--selfplay-policy-score-weight-max', '0.9'])).toThrow('--selfplay-policy-score-weight-max must be >= --selfplay-policy-score-weight-min');
        expect(() => parseArgs(['--selfplay-heuristic-weight-min', '-1'])).toThrow('--selfplay-heuristic-weight-min must be >= 0');
        expect(() => parseArgs(['--selfplay-heuristic-weight-max', '-1'])).toThrow('--selfplay-heuristic-weight-max must be >= 0');
        expect(() => parseArgs(['--selfplay-heuristic-weight-min', '1.1', '--selfplay-heuristic-weight-max', '0.9'])).toThrow('--selfplay-heuristic-weight-max must be >= --selfplay-heuristic-weight-min');
        expect(() => parseArgs(['--onnx-log-interval-steps', '-1'])).toThrow('--onnx-log-interval-steps must be >= 0');
        expect(() => parseArgs(['--onnx-val-split', '0.5'])).toThrow('--onnx-val-split must be in [0,0.5)');
        expect(() => parseArgs(['--onnx-early-stop-patience', '-1'])).toThrow('--onnx-early-stop-patience must be >= 0');
        expect(() => parseArgs(['--onnx-early-stop-min-delta', '-0.1'])).toThrow('--onnx-early-stop-min-delta must be >= 0');
        expect(() => parseArgs(['--onnx-early-stop-smoothing-window', '0'])).toThrow('--onnx-early-stop-smoothing-window must be >= 1');
        expect(() => parseArgs(['--onnx-early-stop-monitor', 'x'])).toThrow('--onnx-early-stop-monitor must be val_loss/train_loss/val_place_loss/train_place_loss');
        expect(() => parseArgs(['--onnx-winner-sample-boost', '-0.1'])).toThrow('--onnx-winner-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-loser-sample-weight', '0'])).toThrow('--onnx-loser-sample-weight must be > 0');
        expect(() => parseArgs(['--onnx-draw-sample-weight', '0'])).toThrow('--onnx-draw-sample-weight must be > 0');
        expect(() => parseArgs(['--onnx-corner-emergency-sample-boost', '-0.1'])).toThrow('--onnx-corner-emergency-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-negative-future-disc-sample-boost', '-0.1'])).toThrow('--onnx-negative-future-disc-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-negative-future-disc-threshold', 'abc'])).toThrow('--onnx-negative-future-disc-threshold must be a number');
        expect(() => parseArgs(['--onnx-tactical-miss-sample-boost', '-0.1'])).toThrow('--onnx-tactical-miss-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-tactical-miss-threshold', '-0.1'])).toThrow('--onnx-tactical-miss-threshold must be >= 0');
        expect(() => parseArgs(['--onnx-hand-pressure-sample-boost', '-0.1'])).toThrow('--onnx-hand-pressure-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-pending-target-sample-boost', '-0.1'])).toThrow('--onnx-pending-target-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-corner-balance-sample-boost', '-0.1'])).toThrow('--onnx-corner-balance-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-edge-balance-sample-boost', '-0.1'])).toThrow('--onnx-edge-balance-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-economy-balance-sample-boost', '-0.1'])).toThrow('--onnx-economy-balance-sample-boost must be >= 0');
        expect(() => parseArgs(['--onnx-value-target-corner-weight', '1.1'])).toThrow('--onnx-value-target-corner-weight must be in [0,1]');
        expect(() => parseArgs(['--onnx-value-target-edge-weight', '-0.1'])).toThrow('--onnx-value-target-edge-weight must be in [0,1]');
        expect(() => parseArgs(['--onnx-value-target-economy-weight', '1.1'])).toThrow('--onnx-value-target-economy-weight must be in [0,1]');
        expect(() => parseArgs(['--onnx-value-target-corner-emergency-weight', '1.1'])).toThrow('--onnx-value-target-corner-emergency-weight must be in [0,1]');
        expect(() => parseArgs([
            '--onnx-value-target-corner-weight', '0.2',
            '--onnx-value-target-edge-weight', '0.2',
            '--onnx-value-target-economy-weight', '0.11'
        ])).toThrow('onnx value-target auxiliary weights must sum to <= 0.5');
        expect(() => parseArgs(['--shape-immediate', '-0.1'])).toThrow('--shape-immediate must be in [0,1]');
        expect(() => parseArgs(['--threshold', '2'])).toThrow('--threshold must be in [0,1]');
        expect(() => parseArgs(['--adoption-seed-count', '0'])).toThrow('--adoption-seed-count must be >= 1');
        expect(() => parseArgs(['--adoption-seed-stride', '0'])).toThrow('--adoption-seed-stride must be >= 1');
        expect(() => parseArgs(['--adoption-final-seed-offset', '0'])).toThrow('--adoption-final-seed-offset must be >= 1');
        expect(() => parseArgs(['--adoption-confidence-level', '1'])).toThrow('--adoption-confidence-level must be in [0.5,1)');
        expect(() => parseArgs(['--adoption-min-lower-bound', '2'])).toThrow('--adoption-min-lower-bound must be in [-1,1]');
        expect(() => parseArgs(['--quality-gate-games', '0'])).toThrow('--quality-gate-games must be >= 1');
        expect(() => parseArgs(['--quality-gate-seed-count', '0'])).toThrow('--quality-gate-seed-count must be >= 1');
        expect(() => parseArgs(['--quality-gate-seed-stride', '0'])).toThrow('--quality-gate-seed-stride must be >= 1');
        expect(() => parseArgs(['--quality-gate-seed-offset', '0'])).toThrow('--quality-gate-seed-offset must be >= 1');
        expect(() => parseArgs(['--quality-gate-threshold', '2'])).toThrow('--quality-gate-threshold must be in [-1,1]');
        expect(() => parseArgs(['--quality-gate-confidence-level', '1'])).toThrow('--quality-gate-confidence-level must be in [0.5,1)');
        expect(() => parseArgs(['--quality-gate-min-lower-bound', '2'])).toThrow('--quality-gate-min-lower-bound must be in [-1,1]');
        expect(() => parseArgs(['--quality-gate-min-seed-uplift', '-2'])).toThrow('--quality-gate-min-seed-uplift must be in [-1,1]');
        expect(() => parseArgs(['--quality-gate-min-seed-pass-count', '-1'])).toThrow('--quality-gate-min-seed-pass-count must be >= 0');
        expect(() => parseArgs(['--quality-gate-seed-count', '3', '--quality-gate-min-seed-pass-count', '4'])).toThrow('--quality-gate-min-seed-pass-count must be <= --quality-gate-seed-count');
        expect(() => parseArgs(['--quick-adoption-threshold', '2'])).toThrow('--quick-adoption-threshold must be in [0,1]');
        expect(() => parseArgs(['--quick-adoption-seed-offset', '-1'])).toThrow('--quick-adoption-seed-offset must be >= 0');
        expect(() => parseArgs(['--quick-adoption-seed-count', '0'])).toThrow('--quick-adoption-seed-count must be >= 1');
        expect(() => parseArgs(['--quick-adoption-seed-stride', '0'])).toThrow('--quick-adoption-seed-stride must be >= 1');
        expect(() => parseArgs(['--quick-adoption-confidence-level', '1'])).toThrow('--quick-adoption-confidence-level must be in [0.5,1)');
        expect(() => parseArgs(['--quick-adoption-min-lower-bound', '2'])).toThrow('--quick-adoption-min-lower-bound must be in [-1,1]');
        expect(() => parseArgs(['--quick-adoption-min-seed-uplift', '-2'])).toThrow('--quick-adoption-min-seed-uplift must be in [-1,1]');
        expect(() => parseArgs(['--quick-adoption-min-seed-pass-count', '-1'])).toThrow('--quick-adoption-min-seed-pass-count must be >= 0');
        expect(() => parseArgs(['--quick-adoption-seed-count', '3', '--quick-adoption-min-seed-pass-count', '4'])).toThrow('--quick-adoption-min-seed-pass-count must be <= quick adoption seed count');
        expect(() => parseArgs(['--final-adoption-threshold', '2'])).toThrow('--final-adoption-threshold must be in [0,1]');
        expect(() => parseArgs(['--final-adoption-seed-count', '0'])).toThrow('--final-adoption-seed-count must be >= 1');
        expect(() => parseArgs(['--final-adoption-seed-stride', '0'])).toThrow('--final-adoption-seed-stride must be >= 1');
        expect(() => parseArgs(['--final-adoption-confidence-level', '1'])).toThrow('--final-adoption-confidence-level must be in [0.5,1)');
        expect(() => parseArgs(['--final-adoption-min-lower-bound', '2'])).toThrow('--final-adoption-min-lower-bound must be in [-1,1]');
        expect(() => parseArgs(['--final-adoption-min-seed-uplift', '-2'])).toThrow('--final-adoption-min-seed-uplift must be in [-1,1]');
        expect(() => parseArgs(['--final-adoption-min-seed-pass-count', '-1'])).toThrow('--final-adoption-min-seed-pass-count must be >= 0');
        expect(() => parseArgs(['--final-adoption-seed-count', '3', '--final-adoption-min-seed-pass-count', '4'])).toThrow('--final-adoption-min-seed-pass-count must be <= final adoption seed count');
        expect(() => parseArgs(['--adoption-min-seed-uplift', '-2'])).toThrow('--adoption-min-seed-uplift must be in [-1,1]');
        expect(() => parseArgs(['--adoption-min-seed-pass-count', '-1'])).toThrow('--adoption-min-seed-pass-count must be >= 0');
        expect(() => parseArgs(['--adoption-tactical-weight', '-1'])).toThrow('--adoption-tactical-weight must be >= 0');
        expect(() => parseArgs(['--adoption-tactical-depth-opening', '-1'])).toThrow('--adoption-tactical-depth-opening must be >= 0');
        expect(() => parseArgs(['--adoption-tactical-depth-mid', '-1'])).toThrow('--adoption-tactical-depth-mid must be >= 0');
        expect(() => parseArgs(['--adoption-tactical-depth-end', '-1'])).toThrow('--adoption-tactical-depth-end must be >= 0');
        expect(() => parseArgs(['--adoption-tactical-beam-width', '-1'])).toThrow('--adoption-tactical-beam-width must be >= 0');
        expect(() => parseArgs(['--adoption-policy-score-weight', '-1'])).toThrow('--adoption-policy-score-weight must be >= 0');
        expect(() => parseArgs(['--adoption-heuristic-weight', '-1'])).toThrow('--adoption-heuristic-weight must be >= 0');
        expect(() => parseArgs(['--adoption-white-priority', '2'])).toThrow('--adoption-white-priority must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-corner', '2'])).toThrow('--adoption-quality-weight-corner must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-edge', '2'])).toThrow('--adoption-quality-weight-edge must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-corner-recovery', '-1'])).toThrow('--adoption-quality-weight-corner-recovery must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-corner-recapture', '2'])).toThrow('--adoption-quality-weight-corner-recapture must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-edge-recovery', '2'])).toThrow('--adoption-quality-weight-edge-recovery must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-corner-hold', '-1'])).toThrow('--adoption-quality-weight-corner-hold must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-corner-hold-turns', '2'])).toThrow('--adoption-quality-weight-corner-hold-turns must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-edge-hold', '2'])).toThrow('--adoption-quality-weight-edge-hold must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-final-corner-share', '-1'])).toThrow('--adoption-quality-weight-final-corner-share must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-final-edge-share', '2'])).toThrow('--adoption-quality-weight-final-edge-share must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-bonus', '-1'])).toThrow('--adoption-quality-weight-bonus must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-card-immediate', '2'])).toThrow('--adoption-quality-weight-card-immediate must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-card-future', '-1'])).toThrow('--adoption-quality-weight-card-future must be in [0,1]');
        expect(() => parseArgs(['--adoption-quality-weight-place-delta', '-1'])).toThrow('--adoption-quality-weight-place-delta must be in [0,1]');
        expect(() => parseArgs(['--adoption-use-guide-baseline', '--adoption-use-anchor-baseline'])).toThrow('--adoption-use-guide-baseline and --adoption-use-anchor-baseline cannot be combined');
        expect(() => parseArgs(['--onnx-gate-threshold', '2'])).toThrow('--onnx-gate-threshold must be in [0,1]');
        expect(() => parseArgs(['--onnx-gate-min-seed-score', '-1'])).toThrow('--onnx-gate-min-seed-score must be in [0,1]');
        expect(() => parseArgs(['--onnx-gate-seed-count', '0'])).toThrow('--onnx-gate-seed-count must be >= 1');
        expect(() => parseArgs(['--onnx-gate-max-average-latency-ms', '-1'])).toThrow('--onnx-gate-max-average-latency-ms must be >= 0');
        expect(() => parseArgs(['--onnx-gate-max-p95-latency-ms', '-1'])).toThrow('--onnx-gate-max-p95-latency-ms must be >= 0');
        expect(() => parseArgs(['--onnx-gate-max-max-latency-ms', '-1'])).toThrow('--onnx-gate-max-max-latency-ms must be >= 0');
        expect(() => parseArgs(['--onnx-gate-timeout-ms', '999'])).toThrow('--onnx-gate-timeout-ms must be >= 1000');
        expect(() => parseArgs(['--onnx-gate-candidate-color-mode', 'black'])).toThrow('--onnx-gate-candidate-color-mode must be one of: both, white');
        expect(() => parseArgs(['--promotion-mode', 'unknown'])).toThrow('--promotion-mode must be strict, onnx-primary, or quick-only');
        expect(() => parseArgs(['--onnx-primary-max-quick-regression', '-0.1'])).toThrow('--onnx-primary-max-quick-regression must be in [0,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-core-delta', '2'])).toThrow('--onnx-primary-min-quick-core-delta must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-white-delta', '-2'])).toThrow('--onnx-primary-min-quick-white-delta must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-quality-delta', '2'])).toThrow('--onnx-primary-min-quick-quality-delta must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-uplift', '2'])).toThrow('--onnx-primary-min-quick-uplift must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-lower-bound', '-2'])).toThrow('--onnx-primary-min-quick-lower-bound must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-onnx-gate-avg', '-0.1'])).toThrow('--onnx-primary-min-onnx-gate-avg must be in [0,1]');
        expect(() => parseArgs(['--onnx-primary-min-onnx-gate-min-seed', '2'])).toThrow('--onnx-primary-min-onnx-gate-min-seed must be in [0,1]');
        expect(() => parseArgs(['--promotion-mode', 'onnx-primary'])).toThrow('--promotion-mode onnx-primary requires --onnx-gate');
        expect(() => parseArgs(['--restart-from-step', 'bad-step'])).toThrow('--restart-from-step must be one of:');
    });

    test('parseArgs accepts quick-only promotion mode without onnx gate', () => {
        const args = parseArgs(['--promotion-mode', 'quick-only']);

        expect(args.promotionMode).toBe('quick-only');
        expect(args.onnxGateEnabled).toBe(false);
    });

    test('parseArgs accepts strategic sample and value-target blend overrides', () => {
        const args = parseArgs([
            '--onnx-corner-balance-sample-boost', '0.18',
            '--onnx-edge-balance-sample-boost', '0.09',
            '--onnx-economy-balance-sample-boost', '0.14',
            '--onnx-value-target-corner-weight', '0.05',
            '--onnx-value-target-edge-weight', '0.03',
            '--onnx-value-target-economy-weight', '0.02',
            '--onnx-value-target-corner-emergency-weight', '0.04'
        ]);

        expect(args.onnxCornerBalanceSampleBoost).toBeCloseTo(0.18, 6);
        expect(args.onnxEdgeBalanceSampleBoost).toBeCloseTo(0.09, 6);
        expect(args.onnxEconomyBalanceSampleBoost).toBeCloseTo(0.14, 6);
        expect(args.onnxValueTargetCornerWeight).toBeCloseTo(0.05, 6);
        expect(args.onnxValueTargetEdgeWeight).toBeCloseTo(0.03, 6);
        expect(args.onnxValueTargetEconomyWeight).toBeCloseTo(0.02, 6);
        expect(args.onnxValueTargetCornerEmergencyWeight).toBeCloseTo(0.04, 6);
    });

    test('parseArgs accepts selfplay card usage schedule and resolves step schedule per iteration', () => {
        const args = parseArgs([
            '--card-usage-rate', '0.60',
            '--selfplay-card-usage-rate-schedule', '0.30@1,0.40@3,0.50@6,0.60@10'
        ]);

        expect(args.selfplayCardUsageRateScheduleSpec).toBe('0.30@1,0.40@3,0.50@6,0.60@10');
        expect(args.selfplayCardUsageRateSchedule).toEqual([
            { rate: 0.30, iteration: 1 },
            { rate: 0.40, iteration: 3 },
            { rate: 0.50, iteration: 6 },
            { rate: 0.6, iteration: 10 }
        ]);
        expect(resolveSelfplayCardUsageRateForIteration(args, 1)).toBeCloseTo(0.30, 6);
        expect(resolveSelfplayCardUsageRateForIteration(args, 2)).toBeCloseTo(0.30, 6);
        expect(resolveSelfplayCardUsageRateForIteration(args, 3)).toBeCloseTo(0.40, 6);
        expect(resolveSelfplayCardUsageRateForIteration(args, 6)).toBeCloseTo(0.50, 6);
        expect(resolveSelfplayCardUsageRateForIteration(args, 9)).toBeCloseTo(0.50, 6);
        expect(resolveSelfplayCardUsageRateForIteration(args, 10)).toBeCloseTo(0.6, 6);
    });

    test('parseArgs maps legacy resume checkpoint into compatible head slot', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-cycle-resume-'));
        const valueCheckpointPath = path.join(tempDir, 'policy-value.candidate.resume.checkpoint.pt');
        fs.writeFileSync(valueCheckpointPath, 'resume\n', 'utf8');

        try {
            const args = parseArgs(['--resume-checkpoint', valueCheckpointPath]);
            expect(args.resumeCheckpointPath).toBeNull();
            expect(args.resumeCheckpointPaths).toMatchObject({
                policy: null,
                value: valueCheckpointPath
            });
            expect(getPrimaryResumeCheckpointPath(args.resumeCheckpointPaths)).toBeNull();
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('parseArgs accepts head-specific resume checkpoints', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-cycle-resume-'));
        const policyCheckpointPath = path.join(tempDir, 'custom-policy.pt');
        const cardCheckpointPath = path.join(tempDir, 'custom-card.pt');
        fs.writeFileSync(policyCheckpointPath, 'policy\n', 'utf8');
        fs.writeFileSync(cardCheckpointPath, 'card\n', 'utf8');

        try {
            const args = parseArgs([
                '--resume-policy-checkpoint', policyCheckpointPath,
                '--resume-card-checkpoint', cardCheckpointPath,
                '--quality-gate-strength-first'
            ]);
            expect(args.resumeCheckpointPath).toBe(policyCheckpointPath);
            expect(args.resumeCheckpointPaths).toMatchObject({
                policy: policyCheckpointPath,
                card: cardCheckpointPath
            });
            expect(resolveResumeCheckpointPathsFromArgs(args)).toMatchObject({
                policy: policyCheckpointPath,
                card: cardCheckpointPath
            });
            expect(args.qualityGateStrengthFirst).toBe(true);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('resolvePromotionEligibility promotes on quick-only pass without final or onnx gate', () => {
        const args = parseArgs(['--promotion-mode', 'quick-only']);
        const eligibility = resolvePromotionEligibility(args, {
            quickPassed: true,
            qualityGatePassed: true,
            finalPassed: false,
            onnxGatePassed: false,
            quickRegressionWithinOnnxPrimaryLimit: false,
            quickNonRegressionWithinOnnxPrimaryLimit: false,
            quickUplift: 0.001,
            quickUpliftLowerBound: -0.5,
            onnxGateDecision: null
        });

        expect(eligibility.quickOnlyPromoteEligible).toBe(true);
        expect(eligibility.strictPromoteEligible).toBe(false);
        expect(eligibility.onnxPrimaryPromoteEligible).toBe(false);
        expect(eligibility.promoteEligible).toBe(true);
    });

    test('restart helpers reuse only steps before the requested restart point', () => {
        expect(TRAINING_CYCLE_STEP_ORDER).toContain('adoption-quick');
        expect(normalizeRestartFromStep('ADOPTION-final')).toBe('adoption-final');
        expect(shouldReuseStepArtifacts({ reuseExistingArtifacts: true, restartFromStep: 'adoption-quality-gate' }, 'train-policy')).toBe(true);
        expect(shouldReuseStepArtifacts({ reuseExistingArtifacts: true, restartFromStep: 'adoption-quality-gate' }, 'adoption-quality-gate')).toBe(false);
        expect(shouldReuseStepArtifacts({ reuseExistingArtifacts: true, restartFromStep: 'adoption-quality-gate' }, 'adoption-final')).toBe(false);
        expect(shouldReuseStepArtifacts({ reuseExistingArtifacts: false, restartFromStep: 'adoption-quality-gate' }, 'train-policy')).toBe(false);
    });

    test('parseArgs accepts selfplay resume chunk overrides', () => {
        expect(parseArgs(['--selfplay-resume-chunk-size', '0']).selfplayResumeChunkSize).toBe(0);
        expect(() => parseArgs(['--selfplay-resume-chunk-size', '-1'])).toThrow('--selfplay-resume-chunk-size must be >= 0');
    });

    test('anchor baseline helpers resolve final-only gate control', () => {
        const args = parseArgs([
            '--iterations', '3',
            '--adoption-use-anchor-baseline',
            '--gate-final-iteration-only'
        ]);

        expect(resolveAdoptionBaselineMode(args)).toBe('anchor');
        expect(shouldRunGateForIteration(args, 1)).toBe(false);
        expect(shouldRunGateForIteration(args, 3)).toBe(true);

        const control = resolveIterationGateControl(args, 3, 'guide.json', 'anchor.json');
        expect(control).toEqual({
            gateIterationAllowed: true,
            baselineMode: 'anchor',
            baselineModelPath: path.resolve('anchor.json')
        });
    });

    test('guide baseline helper still resolves current guide when requested', () => {
        const args = parseArgs(['--adoption-use-guide-baseline']);
        const control = resolveIterationGateControl(args, 1, 'guide.json', null);

        expect(resolveAdoptionBaselineMode(args)).toBe('guide');
        expect(control).toEqual({
            gateIterationAllowed: true,
            baselineMode: 'guide',
            baselineModelPath: path.resolve('guide.json')
        });
    });

    test('buildPromotionCommandArgs scopes promotion outputs under modelsDir', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-promotion-'));
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });

        try {
            const args = parseArgs([
                '--models-dir', modelsDir,
                '--with-cards'
            ]);
            const promoteArgs = buildPromotionCommandArgs(args, {
                candidateModelPath: path.join(modelsDir, 'policy-table.candidate.test.it01.json'),
                onnxModelPath: path.join(modelsDir, 'policy-net.candidate.test.it01.onnx'),
                onnxMetaPath: path.join(modelsDir, 'policy-net.candidate.test.it01.onnx.meta.json'),
                cardOnnxModelPath: path.join(modelsDir, 'policy-card.candidate.test.it01.onnx'),
                cardOnnxMetaPath: path.join(modelsDir, 'policy-card.candidate.test.it01.onnx.meta.json'),
                targetOnnxModelPath: path.join(modelsDir, 'policy-target.candidate.test.it01.onnx'),
                targetOnnxMetaPath: path.join(modelsDir, 'policy-target.candidate.test.it01.onnx.meta.json'),
                valueOnnxModelPath: path.join(modelsDir, 'policy-value.candidate.test.it01.onnx'),
                valueOnnxMetaPath: path.join(modelsDir, 'policy-value.candidate.test.it01.onnx.meta.json')
            }, path.join(tempDir, 'adoption.quick.test.it01.json'), true);

            expect(promoteArgs).toEqual(expect.arrayContaining([
                '--target-model', path.join(modelsDir, 'policy-table.json'),
                '--target-onnx', path.join(modelsDir, 'policy-net.onnx'),
                '--target-onnx-meta', path.join(modelsDir, 'policy-net.onnx.meta.json'),
                '--target-card-onnx', path.join(modelsDir, 'policy-card.onnx'),
                '--target-card-onnx-meta', path.join(modelsDir, 'policy-card.onnx.meta.json'),
                '--target-target-onnx', path.join(modelsDir, 'policy-target.onnx'),
                '--target-target-onnx-meta', path.join(modelsDir, 'policy-target.onnx.meta.json'),
                '--target-value-onnx', path.join(modelsDir, 'policy-value.onnx'),
                '--target-value-onnx-meta', path.join(modelsDir, 'policy-value.onnx.meta.json'),
                '--promoted-dir', path.join(modelsDir, 'promoted'),
                '--archive-dir', path.join(modelsDir, 'archive'),
                '--manifest', path.join(modelsDir, 'promoted', 'promotion-manifest.json')
            ]));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('resolveNextCarryOverState keeps promoted-only guide while carrying checkpoint when candidate is not promoted', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-carry-over-'));
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        const currentGuidePath = path.join(modelsDir, 'policy-table.json');
        const previousCheckpointPath = path.join(modelsDir, 'policy-net.prev.checkpoint.pt');
        const previousCardCheckpointPath = path.join(modelsDir, 'policy-card.prev.checkpoint.pt');
        const candidateModelPath = path.join(modelsDir, 'policy-table.candidate.test.it01.json');
        const candidateCheckpointPath = path.join(modelsDir, 'policy-net.candidate.test.it01.checkpoint.pt');
        const candidateCardCheckpointPath = path.join(modelsDir, 'policy-card.candidate.test.it01.checkpoint.pt');
        fs.writeFileSync(currentGuidePath, '{}\n', 'utf8');
        fs.writeFileSync(previousCheckpointPath, 'prev\n', 'utf8');
        fs.writeFileSync(previousCardCheckpointPath, 'prev-card\n', 'utf8');
        fs.writeFileSync(candidateModelPath, '{}\n', 'utf8');
        fs.writeFileSync(candidateCheckpointPath, 'candidate\n', 'utf8');
        fs.writeFileSync(candidateCardCheckpointPath, 'candidate-card\n', 'utf8');

        try {
            const args = parseArgs([
                '--models-dir', modelsDir,
                '--selfplay-use-promoted-model-only',
                '--selfplay-policy-model-pool-size', '1'
            ]);
            const nextState = resolveNextCarryOverState(args, {
                guideModelPath: currentGuidePath,
                guideModelPoolPaths: [currentGuidePath],
                resumeCheckpointPath: previousCheckpointPath,
                resumeCheckpointPaths: {
                    policy: previousCheckpointPath,
                    card: previousCardCheckpointPath
                }
            }, {
                promoted: false,
                paths: {
                    candidateModelPath,
                    checkpointPath: candidateCheckpointPath,
                    cardCheckpointPath: candidateCardCheckpointPath
                }
            });

            expect(nextState.guideModelPath).toBe(currentGuidePath);
            expect(nextState.guideModelPoolPaths).toEqual([currentGuidePath]);
            expect(nextState.resumeCheckpointPath).toBe(candidateCheckpointPath);
            expect(nextState.resumeCheckpointPaths).toMatchObject({
                policy: candidateCheckpointPath,
                card: candidateCardCheckpointPath
            });
            expect(nextState.checkpointCarryOverSkipped).toBe(false);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('resolveNextCarryOverState advances guide and checkpoint after promotion', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-carry-over-'));
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        const previousGuidePath = path.join(modelsDir, 'policy-table.previous.json');
        const previousCheckpointPath = path.join(modelsDir, 'policy-net.prev.checkpoint.pt');
        const previousValueCheckpointPath = path.join(modelsDir, 'policy-value.prev.checkpoint.pt');
        const promotedGuidePath = path.join(modelsDir, 'policy-table.json');
        const candidateModelPath = path.join(modelsDir, 'policy-table.candidate.test.it02.json');
        const candidateCheckpointPath = path.join(modelsDir, 'policy-net.candidate.test.it02.checkpoint.pt');
        const candidateValueCheckpointPath = path.join(modelsDir, 'policy-value.candidate.test.it02.checkpoint.pt');
        fs.writeFileSync(previousGuidePath, '{}\n', 'utf8');
        fs.writeFileSync(previousCheckpointPath, 'prev\n', 'utf8');
        fs.writeFileSync(previousValueCheckpointPath, 'prev-value\n', 'utf8');
        fs.writeFileSync(promotedGuidePath, '{}\n', 'utf8');
        fs.writeFileSync(candidateModelPath, '{}\n', 'utf8');
        fs.writeFileSync(candidateCheckpointPath, 'candidate\n', 'utf8');
        fs.writeFileSync(candidateValueCheckpointPath, 'candidate-value\n', 'utf8');

        try {
            const args = parseArgs([
                '--models-dir', modelsDir,
                '--selfplay-use-promoted-model-only',
                '--selfplay-policy-model-pool-size', '1'
            ]);
            const nextState = resolveNextCarryOverState(args, {
                guideModelPath: previousGuidePath,
                guideModelPoolPaths: [previousGuidePath],
                resumeCheckpointPath: previousCheckpointPath,
                resumeCheckpointPaths: {
                    policy: previousCheckpointPath,
                    value: previousValueCheckpointPath
                }
            }, {
                promoted: true,
                paths: {
                    candidateModelPath,
                    checkpointPath: candidateCheckpointPath,
                    valueCheckpointPath: candidateValueCheckpointPath
                }
            });

            expect(nextState.guideModelPath).toBe(promotedGuidePath);
            expect(nextState.guideModelPoolPaths).toEqual([promotedGuidePath]);
            expect(nextState.resumeCheckpointPath).toBe(candidateCheckpointPath);
            expect(nextState.resumeCheckpointPaths).toMatchObject({
                policy: candidateCheckpointPath,
                value: candidateValueCheckpointPath
            });
            expect(nextState.checkpointCarryOverSkipped).toBe(false);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('buildInitialGuideModelPoolPaths excludes stale candidates in promoted-only restart', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-guide-pool-'));
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        const guideModelPath = path.join(modelsDir, 'policy-table.json');
        const staleCandidatePath = path.join(modelsDir, 'policy-table.candidate.old.json');
        const newerCandidatePath = path.join(modelsDir, 'policy-table.candidate.new.json');
        fs.writeFileSync(guideModelPath, '{}\n', 'utf8');
        fs.writeFileSync(staleCandidatePath, '{}\n', 'utf8');
        fs.writeFileSync(newerCandidatePath, '{}\n', 'utf8');

        try {
            const pool = buildInitialGuideModelPoolPaths(modelsDir, guideModelPath, 4, {
                includeCandidateFiles: false
            });

            expect(pool).toEqual([guideModelPath]);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('buildInitialGuideModelPoolPaths keeps recent candidates when candidate lane is enabled', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-guide-pool-'));
        const modelsDir = path.join(tempDir, 'models');
        fs.mkdirSync(modelsDir, { recursive: true });
        const guideModelPath = path.join(modelsDir, 'policy-table.json');
        const staleCandidatePath = path.join(modelsDir, 'policy-table.candidate.old.json');
        const newerCandidatePath = path.join(modelsDir, 'policy-table.candidate.new.json');
        fs.writeFileSync(guideModelPath, '{}\n', 'utf8');
        fs.writeFileSync(staleCandidatePath, '{}\n', 'utf8');
        fs.writeFileSync(newerCandidatePath, '{}\n', 'utf8');
        const now = new Date();
        fs.utimesSync(staleCandidatePath, new Date(now.getTime() - 5000), new Date(now.getTime() - 5000));
        fs.utimesSync(newerCandidatePath, now, now);

        try {
            const pool = buildInitialGuideModelPoolPaths(modelsDir, guideModelPath, 3, {
                includeCandidateFiles: true
            });

            expect(pool).toEqual([guideModelPath, newerCandidatePath, staleCandidatePath]);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('buildInitialGuideModelPoolPaths keeps recent archived promoted guides for promoted-only restart', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-guide-pool-'));
        const modelsDir = path.join(tempDir, 'models');
        const archiveDir = path.join(modelsDir, 'archive');
        fs.mkdirSync(archiveDir, { recursive: true });
        const guideModelPath = path.join(modelsDir, 'policy-table.json');
        const staleCandidatePath = path.join(modelsDir, 'policy-table.candidate.old.json');
        const olderArchivePath = path.join(archiveDir, '2026-03-19T00-00-00Z', 'policy-table.json');
        const newerArchivePath = path.join(archiveDir, '2026-03-20T00-00-00Z', 'policy-table.json');
        fs.mkdirSync(path.dirname(olderArchivePath), { recursive: true });
        fs.mkdirSync(path.dirname(newerArchivePath), { recursive: true });
        fs.writeFileSync(guideModelPath, '{}\n', 'utf8');
        fs.writeFileSync(staleCandidatePath, '{}\n', 'utf8');
        fs.writeFileSync(olderArchivePath, '{}\n', 'utf8');
        fs.writeFileSync(newerArchivePath, '{}\n', 'utf8');
        const now = new Date();
        fs.utimesSync(olderArchivePath, new Date(now.getTime() - 5000), new Date(now.getTime() - 5000));
        fs.utimesSync(newerArchivePath, now, now);

        try {
            const pool = buildInitialGuideModelPoolPaths(modelsDir, guideModelPath, 3, {
                includeCandidateFiles: false,
                includeArchiveFiles: true
            });

            expect(pool).toEqual([guideModelPath, newerArchivePath, olderArchivePath]);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('resolveNextCarryOverState rebuilds promoted-only pool from archived champions after promotion', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-carry-over-'));
        const modelsDir = path.join(tempDir, 'models');
        const archiveDir = path.join(modelsDir, 'archive');
        fs.mkdirSync(archiveDir, { recursive: true });
        const previousGuidePath = path.join(modelsDir, 'policy-table.previous.json');
        const previousCheckpointPath = path.join(modelsDir, 'policy-net.prev.checkpoint.pt');
        const previousTargetCheckpointPath = path.join(modelsDir, 'policy-target.prev.checkpoint.pt');
        const promotedGuidePath = path.join(modelsDir, 'policy-table.json');
        const archivedGuidePath = path.join(archiveDir, '2026-03-20T00-00-00Z', 'policy-table.json');
        const candidateModelPath = path.join(modelsDir, 'policy-table.candidate.test.it03.json');
        const candidateCheckpointPath = path.join(modelsDir, 'policy-net.candidate.test.it03.checkpoint.pt');
        const candidateTargetCheckpointPath = path.join(modelsDir, 'policy-target.candidate.test.it03.checkpoint.pt');
        fs.mkdirSync(path.dirname(archivedGuidePath), { recursive: true });
        fs.writeFileSync(previousGuidePath, '{}\n', 'utf8');
        fs.writeFileSync(previousCheckpointPath, 'prev\n', 'utf8');
        fs.writeFileSync(previousTargetCheckpointPath, 'prev-target\n', 'utf8');
        fs.writeFileSync(promotedGuidePath, '{}\n', 'utf8');
        fs.writeFileSync(archivedGuidePath, '{}\n', 'utf8');
        fs.writeFileSync(candidateModelPath, '{}\n', 'utf8');
        fs.writeFileSync(candidateCheckpointPath, 'candidate\n', 'utf8');
        fs.writeFileSync(candidateTargetCheckpointPath, 'candidate-target\n', 'utf8');

        try {
            const args = parseArgs([
                '--models-dir', modelsDir,
                '--selfplay-use-promoted-model-only',
                '--selfplay-policy-model-pool-size', '3'
            ]);
            const nextState = resolveNextCarryOverState(args, {
                guideModelPath: previousGuidePath,
                guideModelPoolPaths: [previousGuidePath],
                resumeCheckpointPath: previousCheckpointPath,
                resumeCheckpointPaths: {
                    policy: previousCheckpointPath,
                    target: previousTargetCheckpointPath
                }
            }, {
                promoted: true,
                paths: {
                    candidateModelPath,
                    checkpointPath: candidateCheckpointPath,
                    targetCheckpointPath: candidateTargetCheckpointPath
                }
            });

            expect(nextState.guideModelPath).toBe(promotedGuidePath);
            expect(nextState.guideModelPoolPaths).toEqual([promotedGuidePath, archivedGuidePath]);
            expect(nextState.resumeCheckpointPath).toBe(candidateCheckpointPath);
            expect(nextState.resumeCheckpointPaths).toMatchObject({
                policy: candidateCheckpointPath,
                target: candidateTargetCheckpointPath
            });
            expect(nextState.checkpointCarryOverSkipped).toBe(false);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('parseArgs keeps explicit run tag and paths', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-parse-args-'));
        const bootstrapPath = path.join(tempDir, 'bootstrap-policy.json');
        const policyCheckpointPath = path.join(tempDir, 'policy-net.resume.checkpoint.pt');
        const cardCheckpointPath = path.join(tempDir, 'policy-card.resume.checkpoint.pt');
        const targetCheckpointPath = path.join(tempDir, 'policy-target.resume.checkpoint.pt');
        const valueCheckpointPath = path.join(tempDir, 'policy-value.resume.checkpoint.pt');
        fs.writeFileSync(bootstrapPath, '{}\n', 'utf8');
        fs.writeFileSync(policyCheckpointPath, 'policy\n', 'utf8');
        fs.writeFileSync(cardCheckpointPath, 'card\n', 'utf8');
        fs.writeFileSync(targetCheckpointPath, 'target\n', 'utf8');
        fs.writeFileSync(valueCheckpointPath, 'value\n', 'utf8');

        try {
            const args = parseArgs([
                '--run-tag', 'testtag',
                '--max-hours', '6',
                '--bootstrap-policy-model', bootstrapPath,
                '--resume-policy-checkpoint', policyCheckpointPath,
                '--resume-card-checkpoint', cardCheckpointPath,
                '--resume-target-checkpoint', targetCheckpointPath,
                '--resume-value-checkpoint', valueCheckpointPath,
                '--adoption-seed-count', '3',
                '--adoption-seed-stride', '2000',
                '--adoption-final-seed-offset', '500000',
                '--adoption-confidence-level', '0.95',
                '--adoption-min-lower-bound', '0.01',
                '--adoption-min-seed-uplift', '-0.01',
                '--adoption-min-seed-pass-count', '2',
                '--quality-gate',
                '--quality-gate-games', '900',
                '--quality-gate-seed-count', '4',
                '--quality-gate-seed-stride', '600',
                '--quality-gate-seed-offset', '250000',
                '--quality-gate-threshold', '0.004',
                '--quality-gate-confidence-level', '0.9',
                '--quality-gate-min-lower-bound', '-0.02',
                '--quality-gate-min-seed-uplift', '-0.04',
                '--quality-gate-min-seed-pass-count', '2',
                '--quality-gate-strength-first',
                '--selfplay-policy-model-pool-size', '6',
                '--selfplay-policy-pool-sampling', 'uniform',
                '--selfplay-policy-pool-recency-decay', '3',
                '--selfplay-policy-current-anchor-rate', '0.4',
                '--quick-adoption-threshold', '0.003',
                '--quick-adoption-seed-offset', '200000',
                '--quick-adoption-seed-count', '5',
                '--quick-adoption-seed-stride', '777',
                '--quick-adoption-confidence-level', '0.9',
                '--quick-adoption-min-lower-bound', '-0.02',
                '--quick-adoption-min-seed-uplift', '-0.08',
                '--quick-adoption-min-seed-pass-count', '1',
                '--final-adoption-threshold', '0.02',
                '--final-adoption-seed-count', '7',
                '--final-adoption-seed-stride', '999',
                '--final-adoption-confidence-level', '0.95',
                '--final-adoption-min-lower-bound', '0.005',
                '--final-adoption-min-seed-uplift', '-0.03',
                '--final-adoption-min-seed-pass-count', '2',
                '--onnx-gate',
                '--onnx-gate-games', '8',
                '--onnx-gate-seed-count', '3',
                '--onnx-gate-seed-stride', '1000',
                '--onnx-gate-seed-offset', '800000',
                '--onnx-gate-threshold', '0.52',
                '--onnx-gate-min-seed-score', '0.45',
                '--onnx-gate-min-seed-pass-count', '2',
                '--onnx-gate-max-average-latency-ms', '14',
                '--onnx-gate-max-p95-latency-ms', '22',
                '--onnx-gate-max-max-latency-ms', '35',
                '--onnx-gate-timeout-ms', '200000',
                '--onnx-gate-black-level', '6',
                '--onnx-gate-white-level', '5',
                '--onnx-gate-candidate-color-mode', 'white',
                '--onnx-corner-emergency-sample-boost', '0.4',
                '--onnx-negative-future-disc-sample-boost', '0.3',
                '--onnx-negative-future-disc-threshold', '-3',
                '--onnx-tactical-miss-sample-boost', '0.5',
                '--onnx-tactical-miss-threshold', '0.06',
                '--onnx-hand-pressure-sample-boost', '0.25',
                '--onnx-pending-target-sample-boost', '0.35',
                '--onnx-early-stop-smoothing-window', '4',
                '--promotion-mode', 'onnx-primary',
                '--onnx-primary-max-quick-regression', '0.06',
                '--onnx-primary-require-quick-regression',
                '--onnx-primary-require-quick-non-regression',
                '--onnx-primary-min-quick-core-delta', '0.01',
                '--onnx-primary-min-quick-white-delta', '-0.02',
                '--onnx-primary-min-quick-quality-delta', '-0.03',
                '--onnx-primary-min-quick-uplift', '0.005',
                '--onnx-primary-min-quick-lower-bound', '-0.01',
                '--onnx-primary-min-onnx-gate-avg', '0.52',
                '--onnx-primary-min-onnx-gate-min-seed', '0.45',
                '--adoption-use-guide-baseline',
                '--runs-dir', 'data/runs',
                '--models-dir', 'data/models',
                '--summary-out', 'data/runs/out.json'
            ]);
            expect(args.runTag).toBe('testtag');
            expect(args.maxHours).toBe(6);
            expect(args.bootstrapPolicyModelPath).toBe(bootstrapPath);
            expect(args.resumeCheckpointPath).toBe(policyCheckpointPath);
            expect(args.resumeCheckpointPaths).toMatchObject({
                policy: policyCheckpointPath,
                card: cardCheckpointPath,
                target: targetCheckpointPath,
                value: valueCheckpointPath
            });
            expect(args.adoptionSeedCount).toBe(3);
            expect(args.adoptionSeedStride).toBe(2000);
            expect(args.adoptionFinalSeedOffset).toBe(500000);
            expect(args.adoptionConfidenceLevel).toBeCloseTo(0.95, 6);
            expect(args.adoptionMinLowerBound).toBeCloseTo(0.01, 6);
            expect(args.adoptionMinSeedUplift).toBeCloseTo(-0.01, 6);
            expect(args.adoptionMinSeedPassCount).toBe(2);
            expect(args.qualityGateEnabled).toBe(true);
            expect(args.qualityGateGames).toBe(900);
            expect(args.qualityGateSeedCount).toBe(4);
            expect(args.qualityGateSeedStride).toBe(600);
            expect(args.qualityGateSeedOffset).toBe(250000);
            expect(args.qualityGateThreshold).toBeCloseTo(0.004, 6);
            expect(args.qualityGateConfidenceLevel).toBeCloseTo(0.9, 6);
            expect(args.qualityGateMinLowerBound).toBeCloseTo(-0.02, 6);
            expect(args.qualityGateMinSeedUplift).toBeCloseTo(-0.04, 6);
            expect(args.qualityGateMinSeedPassCount).toBe(2);
            expect(args.qualityGateStrengthFirst).toBe(true);
            expect(args.selfplayPolicyModelPoolSize).toBe(6);
            expect(args.selfplayPolicyPoolSampling).toBe('uniform');
            expect(args.selfplayPolicyPoolRecencyDecay).toBeCloseTo(3, 6);
            expect(args.selfplayPolicyCurrentAnchorRate).toBeCloseTo(0.4, 6);
            expect(args.quickAdoptionThreshold).toBeCloseTo(0.003, 6);
            expect(args.quickAdoptionSeedOffset).toBe(200000);
            expect(args.quickAdoptionSeedCount).toBe(5);
            expect(args.quickAdoptionSeedStride).toBe(777);
            expect(args.quickAdoptionConfidenceLevel).toBeCloseTo(0.9, 6);
            expect(args.quickAdoptionMinLowerBound).toBeCloseTo(-0.02, 6);
            expect(args.quickAdoptionMinSeedUplift).toBeCloseTo(-0.08, 6);
            expect(args.quickAdoptionMinSeedPassCount).toBe(1);
            expect(args.finalAdoptionThreshold).toBeCloseTo(0.02, 6);
            expect(args.finalAdoptionSeedCount).toBe(7);
            expect(args.finalAdoptionSeedStride).toBe(999);
            expect(args.finalAdoptionConfidenceLevel).toBeCloseTo(0.95, 6);
            expect(args.finalAdoptionMinLowerBound).toBeCloseTo(0.005, 6);
            expect(args.finalAdoptionMinSeedUplift).toBeCloseTo(-0.03, 6);
            expect(args.finalAdoptionMinSeedPassCount).toBe(2);
            expect(args.onnxGateEnabled).toBe(true);
            expect(args.onnxGateGames).toBe(8);
            expect(args.onnxGateSeedCount).toBe(3);
            expect(args.onnxGateThreshold).toBeCloseTo(0.52, 6);
            expect(args.onnxGateMinSeedScore).toBeCloseTo(0.45, 6);
            expect(args.onnxGateMinSeedPassCount).toBe(2);
            expect(args.onnxGateMaxAverageLatencyMs).toBe(14);
            expect(args.onnxGateMaxP95LatencyMs).toBe(22);
            expect(args.onnxGateMaxMaxLatencyMs).toBe(35);
            expect(args.onnxGateCandidateColorMode).toBe('white');
            expect(args.onnxCornerEmergencySampleBoost).toBeCloseTo(0.4, 6);
            expect(args.onnxNegativeFutureDiscSampleBoost).toBeCloseTo(0.3, 6);
            expect(args.onnxNegativeFutureDiscThreshold).toBeCloseTo(-3, 6);
            expect(args.onnxTacticalMissSampleBoost).toBeCloseTo(0.5, 6);
            expect(args.onnxTacticalMissThreshold).toBeCloseTo(0.06, 6);
            expect(args.onnxHandPressureSampleBoost).toBeCloseTo(0.25, 6);
            expect(args.onnxPendingTargetSampleBoost).toBeCloseTo(0.35, 6);
            expect(args.onnxEarlyStopSmoothingWindow).toBe(4);
            expect(args.adoptionUseGuideBaseline).toBe(true);
            expect(args.promotionMode).toBe('onnx-primary');
            expect(args.onnxPrimaryMaxQuickRegression).toBeCloseTo(0.06, 6);
            expect(args.onnxPrimaryRequireQuickRegression).toBe(true);
            expect(args.onnxPrimaryRequireQuickNonRegression).toBe(true);
            expect(args.onnxPrimaryMinQuickCoreDelta).toBeCloseTo(0.01, 6);
            expect(args.onnxPrimaryMinQuickWhiteDelta).toBeCloseTo(-0.02, 6);
            expect(args.onnxPrimaryMinQuickQualityDelta).toBeCloseTo(-0.03, 6);
            expect(args.onnxPrimaryMinQuickUplift).toBeCloseTo(0.005, 6);
            expect(args.onnxPrimaryMinQuickLowerBound).toBeCloseTo(-0.01, 6);
            expect(args.onnxPrimaryMinOnnxGateAvg).toBeCloseTo(0.52, 6);
            expect(args.onnxPrimaryMinOnnxGateMinSeed).toBeCloseTo(0.45, 6);
            expect(args.summaryOut).toBe(path.resolve(process.cwd(), 'data/runs/out.json'));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('parseArgs rejects missing bootstrap/resume paths', () => {
        expect(() => parseArgs(['--bootstrap-policy-model', 'missing.json'])).toThrow('--bootstrap-policy-model not found:');
        expect(() => parseArgs(['--resume-checkpoint', 'missing.pt'])).toThrow('--resume-checkpoint not found:');
    });

    test('iterationTag and buildIterationPaths create stable filenames', () => {
        const args = parseArgs(['--run-tag', 'abc123']);
        const tag = iterationTag(args.runTag, 3);
        expect(tag).toBe('abc123.it03');
        const p = buildIterationPaths(args, 3);
        expect(p.tag).toBe('abc123.it03');
        expect(p.trainDataPath.endsWith(path.join('data', 'runs', 'selfplay.train.abc123.it03.ndjson'))).toBe(true);
        expect(p.trainHardcaseDataPath.endsWith(path.join('data', 'runs', 'selfplay.train.hardcase.abc123.it03.ndjson'))).toBe(true);
        expect(p.evalDataPath.endsWith(path.join('data', 'runs', 'selfplay.eval.abc123.it03.ndjson'))).toBe(true);
        expect(p.evalHardcaseDataPath.endsWith(path.join('data', 'runs', 'selfplay.eval.hardcase.abc123.it03.ndjson'))).toBe(true);
        expect(p.onnxModelPath.endsWith(path.join('data', 'models', 'policy-net.candidate.abc123.it03.onnx'))).toBe(true);
        expect(p.onnxMetaPath.endsWith(path.join('data', 'models', 'policy-net.candidate.abc123.it03.onnx.meta.json'))).toBe(true);
        expect(p.checkpointPath.endsWith(path.join('data', 'models', 'policy-net.candidate.abc123.it03.checkpoint.pt'))).toBe(true);
        expect(p.cardOnnxModelPath.endsWith(path.join('data', 'models', 'policy-card.candidate.abc123.it03.onnx'))).toBe(true);
        expect(p.cardOnnxMetaPath.endsWith(path.join('data', 'models', 'policy-card.candidate.abc123.it03.onnx.meta.json'))).toBe(true);
        expect(p.cardCheckpointPath.endsWith(path.join('data', 'models', 'policy-card.candidate.abc123.it03.checkpoint.pt'))).toBe(true);
        expect(p.onnxMetricsPath.endsWith(path.join('data', 'runs', 'train.metrics.abc123.it03.jsonl'))).toBe(true);
        expect(p.cardMetricsPath.endsWith(path.join('data', 'runs', 'train.card.metrics.abc123.it03.jsonl'))).toBe(true);
        expect(p.candidateModelPath.endsWith(path.join('data', 'models', 'policy-table.candidate.abc123.it03.json'))).toBe(true);
        expect(p.quickAdoptionPath.endsWith(path.join('data', 'runs', 'adoption.quick.abc123.it03.json'))).toBe(true);
        expect(p.finalAdoptionPath.endsWith(path.join('data', 'runs', 'adoption.final.abc123.it03.json'))).toBe(true);
        expect(p.qualityGatePath.endsWith(path.join('data', 'runs', 'adoption.quality.abc123.it03.json'))).toBe(true);
        expect(p.onnxGatePath.endsWith(path.join('data', 'runs', 'adoption.onnx.abc123.it03.json'))).toBe(true);
    });

    test('hasCoordinatePendingSelectionRecords scans ndjson incrementally', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'training-cycle-'));
        const positivePath = path.join(tempDir, 'positive.ndjson');
        const negativePath = path.join(tempDir, 'negative.ndjson');
        const filler = JSON.stringify({ pendingSelection: null, filler: 'x'.repeat(96) });
        const target = JSON.stringify({
            pendingSelection: {
                kind: 'board_cell',
                row: 8,
                col: 0
            }
        });

        try {
            fs.writeFileSync(positivePath, [filler, filler, filler, target, filler].join('\n'), 'utf8');
            fs.writeFileSync(negativePath, [filler, filler, filler].join('\n'), 'utf8');

            expect(hasCoordinatePendingSelectionRecords(positivePath, { chunkSizeBytes: 64 })).toBe(true);
            expect(hasCoordinatePendingSelectionRecords(negativePath, { chunkSizeBytes: 64 })).toBe(false);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('resolveQuickComponentDelta uses decision-level values when available', () => {
        const quickPayload = {
            perSeed: [
                {
                    decision: {
                        baselineCoreScore: 0.1,
                        candidateCoreScore: 0.4
                    }
                }
            ]
        };
        const quickDecision = {
            baselineCoreScore: 0.2,
            candidateCoreScore: 0.5
        };
        expect(resolveQuickComponentDelta(quickPayload, quickDecision, 'baselineCoreScore', 'candidateCoreScore'))
            .toBeCloseTo(0.3, 6);
    });

    test('resolveQuickComponentDelta falls back to per-seed average when decision-level values are missing', () => {
        const quickPayload = {
            perSeed: [
                {
                    decision: {
                        baselineCoreScore: 0.4,
                        candidateCoreScore: 0.5
                    }
                },
                {
                    decision: {
                        baselineCoreScore: 0.2,
                        candidateCoreScore: 0.4
                    }
                }
            ]
        };
        const quickDecision = {
            uplift: 0.01
        };
        expect(resolveQuickComponentDelta(quickPayload, quickDecision, 'baselineCoreScore', 'candidateCoreScore'))
            .toBeCloseTo(0.15, 6);
    });

    test('resolveQuickComponentDelta returns -Infinity when no usable values exist', () => {
        const quickPayload = {
            perSeed: [{ decision: { baselineCoreScore: 0.2 } }]
        };
        const quickDecision = {};
        expect(resolveQuickComponentDelta(quickPayload, quickDecision, 'baselineCoreScore', 'candidateCoreScore'))
            .toBe(-Infinity);
    });

    test('annotates failed step with iteration and exit metadata', () => {
        const baseError = new Error('command failed (exit=1): python train_card_onnx.py');
        baseError.code = 'COMMAND_FAILED';
        baseError.exitCode = 1;
        baseError.command = 'python train_card_onnx.py';

        const annotated = annotateTrainingCycleError(baseError, {
            iteration: 4,
            step: 'train-card-policy',
            runTag: 'production_v3_test',
            iterationTag: 'production_v3_test.it04',
            summaryOut: 'C:/tmp/training-cycle.summary.json',
            stepOutputs: ['C:/tmp/train.card.metrics.jsonl']
        });

        expect(annotated.message).toContain('iteration=4');
        expect(annotated.message).toContain('step=train-card-policy');
        expect(annotated.message).toContain('exit=1');
        expect(annotated.trainingCycle).toMatchObject({
            iteration: 4,
            step: 'train-card-policy',
            runTag: 'production_v3_test',
            iterationTag: 'production_v3_test.it04',
            summaryOut: 'C:/tmp/training-cycle.summary.json',
            exitCode: 1,
            command: 'python train_card_onnx.py'
        });
    });

    test('extracts failure detail from annotated errors', () => {
        const detail = extractTrainingCycleFailureDetail({
            trainingCycle: {
                iteration: 3,
                step: 'adoption-onnx-gate',
                exitCode: 2,
                command: 'node benchmark-policy-onnx-gate.js'
            }
        });

        expect(detail).toEqual({
            iteration: 3,
            step: 'adoption-onnx-gate',
            exitCode: 2,
            command: 'node benchmark-policy-onnx-gate.js'
        });
    });
});
