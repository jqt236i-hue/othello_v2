const path = require('path');
const {
    parseArgs,
    buildIterationPaths,
    iterationTag,
    resolveQuickComponentDelta
} = require('../scripts/run-selfplay-training-cycle');

describe('selfplay training cycle script', () => {
    test('parseArgs uses long-run defaults', () => {
        const args = parseArgs([]);
        expect(args.maxHours).toBe(100);
        expect(args.onnxEpochs).toBe(9999);
        expect(args.selfplayJobs).toBe(10);
        expect(args.adoptionJobs).toBe(10);
        expect(args.onnxGateJobs).toBe(10);
        expect(args.cardUsageRate).toBeCloseTo(0.2, 6);
        expect(args.selfplayPolicyMixRate).toBeCloseTo(1, 6);
        expect(args.selfplayPolicyModelPoolSize).toBe(4);
        expect(args.selfplayPolicyPoolSampling).toBe('recency');
        expect(args.selfplayPolicyPoolRecencyDecay).toBeCloseTo(2.5, 6);
        expect(args.selfplayPolicyCurrentAnchorRate).toBeCloseTo(0.35, 6);
        expect(args.selfplayCardUsageRateJitter).toBeCloseTo(0, 6);
        expect(args.selfplayTacticalWeightMin).toBeCloseTo(1, 6);
        expect(args.selfplayTacticalWeightMax).toBeCloseTo(1, 6);
        expect(args.selfplayTacticalDepthOpening).toBe(4);
        expect(args.selfplayTacticalDepthMid).toBe(6);
        expect(args.selfplayTacticalDepthEnd).toBe(8);
        expect(args.selfplayTacticalBeamWidth).toBe(12);
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
        expect(args.quickAdoptionThreshold).toBeNull();
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
        expect(() => parseArgs(['--selfplay-tactical-weight-min', '-1'])).toThrow('--selfplay-tactical-weight-min must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-weight-max', '-1'])).toThrow('--selfplay-tactical-weight-max must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-weight-min', '1.2', '--selfplay-tactical-weight-max', '0.9'])).toThrow('--selfplay-tactical-weight-max must be >= --selfplay-tactical-weight-min');
        expect(() => parseArgs(['--selfplay-tactical-depth-opening', '-1'])).toThrow('--selfplay-tactical-depth-opening must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-depth-mid', '-1'])).toThrow('--selfplay-tactical-depth-mid must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-depth-end', '-1'])).toThrow('--selfplay-tactical-depth-end must be >= 0');
        expect(() => parseArgs(['--selfplay-tactical-beam-width', '-1'])).toThrow('--selfplay-tactical-beam-width must be >= 0');
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
        expect(() => parseArgs(['--shape-immediate', '-0.1'])).toThrow('--shape-immediate must be in [0,1]');
        expect(() => parseArgs(['--threshold', '2'])).toThrow('--threshold must be in [0,1]');
        expect(() => parseArgs(['--adoption-seed-count', '0'])).toThrow('--adoption-seed-count must be >= 1');
        expect(() => parseArgs(['--adoption-seed-stride', '0'])).toThrow('--adoption-seed-stride must be >= 1');
        expect(() => parseArgs(['--adoption-final-seed-offset', '0'])).toThrow('--adoption-final-seed-offset must be >= 1');
        expect(() => parseArgs(['--adoption-confidence-level', '1'])).toThrow('--adoption-confidence-level must be in [0.5,1)');
        expect(() => parseArgs(['--adoption-min-lower-bound', '2'])).toThrow('--adoption-min-lower-bound must be in [-1,1]');
        expect(() => parseArgs(['--quick-adoption-threshold', '2'])).toThrow('--quick-adoption-threshold must be in [0,1]');
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
        expect(() => parseArgs(['--onnx-gate-threshold', '2'])).toThrow('--onnx-gate-threshold must be in [0,1]');
        expect(() => parseArgs(['--onnx-gate-min-seed-score', '-1'])).toThrow('--onnx-gate-min-seed-score must be in [0,1]');
        expect(() => parseArgs(['--onnx-gate-seed-count', '0'])).toThrow('--onnx-gate-seed-count must be >= 1');
        expect(() => parseArgs(['--onnx-gate-timeout-ms', '999'])).toThrow('--onnx-gate-timeout-ms must be >= 1000');
        expect(() => parseArgs(['--onnx-gate-candidate-color-mode', 'black'])).toThrow('--onnx-gate-candidate-color-mode must be one of: both, white');
        expect(() => parseArgs(['--promotion-mode', 'unknown'])).toThrow('--promotion-mode must be strict or onnx-primary');
        expect(() => parseArgs(['--onnx-primary-max-quick-regression', '-0.1'])).toThrow('--onnx-primary-max-quick-regression must be in [0,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-core-delta', '2'])).toThrow('--onnx-primary-min-quick-core-delta must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-white-delta', '-2'])).toThrow('--onnx-primary-min-quick-white-delta must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-quality-delta', '2'])).toThrow('--onnx-primary-min-quick-quality-delta must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-uplift', '2'])).toThrow('--onnx-primary-min-quick-uplift must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-quick-lower-bound', '-2'])).toThrow('--onnx-primary-min-quick-lower-bound must be in [-1,1]');
        expect(() => parseArgs(['--onnx-primary-min-onnx-gate-avg', '-0.1'])).toThrow('--onnx-primary-min-onnx-gate-avg must be in [0,1]');
        expect(() => parseArgs(['--onnx-primary-min-onnx-gate-min-seed', '2'])).toThrow('--onnx-primary-min-onnx-gate-min-seed must be in [0,1]');
        expect(() => parseArgs(['--promotion-mode', 'onnx-primary'])).toThrow('--promotion-mode onnx-primary requires --onnx-gate');
    });

    test('parseArgs keeps explicit run tag and paths', () => {
        const existingPath = __filename;
        const args = parseArgs([
            '--run-tag', 'testtag',
            '--max-hours', '6',
            '--bootstrap-policy-model', existingPath,
            '--resume-checkpoint', existingPath,
            '--adoption-seed-count', '3',
            '--adoption-seed-stride', '2000',
            '--adoption-final-seed-offset', '500000',
            '--adoption-confidence-level', '0.95',
            '--adoption-min-lower-bound', '0.01',
            '--adoption-min-seed-uplift', '-0.01',
            '--adoption-min-seed-pass-count', '2',
            '--selfplay-policy-model-pool-size', '6',
            '--selfplay-policy-pool-sampling', 'uniform',
            '--selfplay-policy-pool-recency-decay', '3',
            '--selfplay-policy-current-anchor-rate', '0.4',
            '--quick-adoption-threshold', '0.003',
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
            '--onnx-gate-timeout-ms', '200000',
            '--onnx-gate-black-level', '6',
            '--onnx-gate-white-level', '5',
            '--onnx-gate-candidate-color-mode', 'white',
            '--onnx-corner-emergency-sample-boost', '0.4',
            '--onnx-negative-future-disc-sample-boost', '0.3',
            '--onnx-negative-future-disc-threshold', '-3',
            '--onnx-tactical-miss-sample-boost', '0.5',
            '--onnx-tactical-miss-threshold', '0.06',
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
        expect(args.bootstrapPolicyModelPath).toBe(path.resolve(process.cwd(), existingPath));
        expect(args.resumeCheckpointPath).toBe(path.resolve(process.cwd(), existingPath));
        expect(args.adoptionSeedCount).toBe(3);
        expect(args.adoptionSeedStride).toBe(2000);
        expect(args.adoptionFinalSeedOffset).toBe(500000);
        expect(args.adoptionConfidenceLevel).toBeCloseTo(0.95, 6);
        expect(args.adoptionMinLowerBound).toBeCloseTo(0.01, 6);
        expect(args.adoptionMinSeedUplift).toBeCloseTo(-0.01, 6);
        expect(args.adoptionMinSeedPassCount).toBe(2);
        expect(args.selfplayPolicyModelPoolSize).toBe(6);
        expect(args.selfplayPolicyPoolSampling).toBe('uniform');
        expect(args.selfplayPolicyPoolRecencyDecay).toBeCloseTo(3, 6);
        expect(args.selfplayPolicyCurrentAnchorRate).toBeCloseTo(0.4, 6);
        expect(args.quickAdoptionThreshold).toBeCloseTo(0.003, 6);
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
        expect(args.onnxGateCandidateColorMode).toBe('white');
        expect(args.onnxCornerEmergencySampleBoost).toBeCloseTo(0.4, 6);
        expect(args.onnxNegativeFutureDiscSampleBoost).toBeCloseTo(0.3, 6);
        expect(args.onnxNegativeFutureDiscThreshold).toBeCloseTo(-3, 6);
        expect(args.onnxTacticalMissSampleBoost).toBeCloseTo(0.5, 6);
        expect(args.onnxTacticalMissThreshold).toBeCloseTo(0.06, 6);
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
        expect(p.onnxMetricsPath.endsWith(path.join('data', 'runs', 'train.metrics.abc123.it03.jsonl'))).toBe(true);
        expect(p.candidateModelPath.endsWith(path.join('data', 'models', 'policy-table.candidate.abc123.it03.json'))).toBe(true);
        expect(p.quickAdoptionPath.endsWith(path.join('data', 'runs', 'adoption.quick.abc123.it03.json'))).toBe(true);
        expect(p.finalAdoptionPath.endsWith(path.join('data', 'runs', 'adoption.final.abc123.it03.json'))).toBe(true);
        expect(p.onnxGatePath.endsWith(path.join('data', 'runs', 'adoption.onnx.abc123.it03.json'))).toBe(true);
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
});
