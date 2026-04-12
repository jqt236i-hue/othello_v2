const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    DEFAULT_QUALITY_WEIGHTS,
    parseArgs,
    buildQualitySeedDecision,
    buildStrengthFirstSourceDecision,
    buildQualityGatePayload
} = require('../scripts/benchmark-policy-quality-gate');
const { POLICY_GATE_PAYLOAD_SCHEMA_VERSION } = require('../scripts/policy-gate-result-utils');

describe('selfplay policy quality gate', () => {
    test('parseArgs applies default quality weights when none are specified', () => {
        const args = parseArgs([
            '--candidate-model', 'data/models/candidate.json'
        ]);

        expect(args.candidateModelPath).toContain(path.join('data', 'models', 'candidate.json'));
        expect(args.gatePhase).toBe('quality');
        for (const [key, value] of Object.entries(DEFAULT_QUALITY_WEIGHTS)) {
            expect(args[key]).toBe(value);
        }
    });

    test('parseArgs allows negative threshold for quality gate', () => {
        const args = parseArgs([
            '--candidate-model', 'data/models/candidate.json',
            '--threshold', '-1'
        ]);

        expect(args.threshold).toBe(-1);
        expect(args.gatePhase).toBe('quality');
    });

    test('parseArgs enables strength-first quality gate when requested', () => {
        const args = parseArgs([
            '--candidate-model', 'data/models/candidate.json',
            '--quality-gate-strength-first'
        ]);

        expect(args.qualityGateStrengthFirst).toBe(true);
    });

    test('buildQualitySeedDecision uses quality uplift only', () => {
        const out = buildQualitySeedDecision({
            baselineQualityScore: 0.11,
            candidateQualityScore: 0.29,
            baselineScore: 0.90,
            candidateScore: 0.91
        }, 0.15);

        expect(out.baselineScore).toBeCloseTo(0.11);
        expect(out.candidateScore).toBeCloseTo(0.29);
        expect(out.uplift).toBeCloseTo(0.18);
        expect(out.passed).toBe(true);
    });

    test('buildStrengthFirstSourceDecision clamps source requirements to non-negative strength', () => {
        const sourceDecision = buildStrengthFirstSourceDecision([
            {
                decision: { baselineScore: 0.52, candidateScore: 0.53, uplift: 0.01, passed: true }
            },
            {
                decision: { baselineScore: 0.51, candidateScore: 0.49, uplift: -0.02, passed: false }
            }
        ], {
            threshold: -0.01,
            confidenceLevel: 0.95,
            minLowerBound: -0.05,
            minSeedUplift: -0.05,
            minSeedPassCount: 1
        });

        expect(sourceDecision.threshold).toBe(0);
        expect(sourceDecision.requiredMinLowerBound).toBe(0);
        expect(sourceDecision.requiredMinSeedUplift).toBe(0);
        expect(sourceDecision.passed).toBe(false);
    });

    test('buildQualityGatePayload aggregates per-seed quality decisions', () => {
        const payload = buildQualityGatePayload({
            schemaVersion: 'selfplay.v2',
            baseline: { marker: 'baseline' },
            candidate: { marker: 'candidate' },
            decision: { passed: false, uplift: 0.01 },
            perSeed: [
                {
                    seed: 11,
                    decision: {
                        baselineQualityScore: 0.10,
                        candidateQualityScore: 0.22,
                        qualityWeights: { corner: 0.2 }
                    }
                },
                {
                    seed: 19,
                    decision: {
                        baselineQualityScore: 0.08,
                        candidateQualityScore: 0.18,
                        qualityWeights: { corner: 0.2 }
                    }
                }
            ]
        }, {
            games: 20,
            seed: 11,
            seedCount: 2,
            seedStride: 8,
            jobs: 1,
            maxPlies: 220,
            threshold: 0.09,
            confidenceLevel: 0.95,
            minLowerBound: -1,
            minSeedUplift: -1,
            minSeedPassCount: 0,
            qualityGateStrengthFirst: true,
            candidateModelPath: path.join('data', 'models', 'candidate.json'),
            baselineModelPath: null,
            opponentModelPath: null,
            ...DEFAULT_QUALITY_WEIGHTS
        });

        expect(payload.gateType).toBe('quality');
        expect(payload.schemaVersion).toBe('selfplay.v2');
        expect(payload.payloadSchemaVersion).toBe(POLICY_GATE_PAYLOAD_SCHEMA_VERSION);
        expect(payload.perSeed).toHaveLength(2);
        expect(payload.seedSchedule).toEqual({
            baseSeed: 11,
            seedCount: 2,
            seedStride: 8,
            scheduledSeeds: [11, 19],
            completedSeeds: [11, 19]
        });
        expect(payload.perSeed[0].qualityDecision.uplift).toBeCloseTo(0.12);
        expect(payload.decision.uplift).toBeCloseTo(0.11);
        expect(payload.decision.passedByQuality).toBe(true);
        expect(payload.decision.passedBySourceStrength).toBe(false);
        expect(payload.decision.passed).toBe(false);
        expect(payload.decision.failureReasons).toContain('source-strength');
        expect(payload.sourceDecision.passed).toBe(false);
        expect(payload.config.qualityWeights.qualityWeightCorner).toBe(DEFAULT_QUALITY_WEIGHTS.qualityWeightCorner);
        expect(payload.config.qualityGateStrengthFirst).toBe(true);
    });

    test('buildQualityGatePayload preserves early-stop failure state', () => {
        const payload = buildQualityGatePayload({
            schemaVersion: 'selfplay.v2',
            decision: { passed: true, uplift: 0.05 },
            perSeed: [
                {
                    seed: 11,
                    decision: {
                        baselineQualityScore: 0.10,
                        candidateQualityScore: 0.08,
                        qualityWeights: { corner: 0.2 }
                    }
                },
                {
                    seed: 19,
                    decision: {
                        baselineQualityScore: 0.11,
                        candidateQualityScore: 0.09,
                        qualityWeights: { corner: 0.2 }
                    }
                }
            ]
        }, {
            games: 20,
            seed: 11,
            seedCount: 4,
            seedStride: 8,
            jobs: 1,
            maxPlies: 220,
            threshold: 0.09,
            confidenceLevel: 0.95,
            minLowerBound: -1,
            minSeedUplift: -1,
            minSeedPassCount: 3,
            candidateModelPath: path.join('data', 'models', 'candidate.json'),
            baselineModelPath: null,
            opponentModelPath: null,
            ...DEFAULT_QUALITY_WEIGHTS
        }, {
            reason: 'min-seed-pass-count-impossible',
            completedSeedCount: 2,
            remainingSeedCount: 2,
            seedPassCount: 0,
            remainingPossibleSeedPassCount: 2,
            maxAchievableAverageUplift: 0,
            maxPossibleSeedUplift: 1
        });

        expect(payload.decision.passed).toBe(false);
        expect(payload.decision.earlyStop).toBe(true);
        expect(payload.decision.earlyStopReason).toBe('min-seed-pass-count-impossible');
        expect(payload.decision.primaryFailureReason).toBe('min-seed-pass-count-impossible');
        expect(payload.decision.seedCount).toBe(4);
        expect(payload.earlyStop.reason).toBe('min-seed-pass-count-impossible');
    });

    test('parseArgs applies quality defaults from resolved config', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-quality-gate-'));
        const baselineModelPath = path.join(tempDir, 'bootstrap-policy.json');
        const resolvedConfigPath = path.join(tempDir, 'resolved-config.json');
        fs.writeFileSync(baselineModelPath, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        fs.writeFileSync(resolvedConfigPath, JSON.stringify({
            bootstrap: {
                bootstrapPolicyModelPath: baselineModelPath
            },
            command: {
                args: [
                    'scripts/run-selfplay-training-cycle.js',
                    '--quality-gate-games', '88',
                    '--quality-gate-seed-count', '4',
                    '--quality-gate-seed-stride', '444',
                    '--quality-gate-threshold', '0.015',
                    '--quality-gate-confidence-level', '0.9',
                    '--quality-gate-min-lower-bound', '-0.02',
                    '--quality-gate-min-seed-uplift', '-0.03',
                    '--quality-gate-min-seed-pass-count', '2',
                    '--quality-gate-strength-first',
                    '--adoption-jobs', '3',
                    '--max-plies', '140',
                    '--card-usage-rate', '0.33',
                    '--adoption-tactical-weight', '0.2',
                    '--adoption-policy-score-weight', '1.8',
                    '--adoption-white-priority', '0.6'
                ]
            }
        }, null, 2), 'utf8');

        try {
            const args = parseArgs([
                '--resolved-config', resolvedConfigPath,
                '--candidate-model', 'data/models/policy-table.json'
            ]);
            expect(args.games).toBe(88);
            expect(args.seedCount).toBe(4);
            expect(args.seedStride).toBe(444);
            expect(args.threshold).toBeCloseTo(0.015, 6);
            expect(args.confidenceLevel).toBeCloseTo(0.9, 6);
            expect(args.minLowerBound).toBeCloseTo(-0.02, 6);
            expect(args.minSeedUplift).toBeCloseTo(-0.03, 6);
            expect(args.minSeedPassCount).toBe(2);
            expect(args.jobs).toBe(3);
            expect(args.maxPlies).toBe(140);
            expect(args.aRate).toBeCloseTo(0.33, 6);
            expect(args.bRate).toBeCloseTo(0.33, 6);
            expect(args.qualityGateStrengthFirst).toBe(true);
            expect(args.tacticalWeight).toBeCloseTo(0.2, 6);
            expect(args.policyScoreWeight).toBeCloseTo(1.8, 6);
            expect(args.whitePriority).toBeCloseTo(0.6, 6);
            expect(args.baselineModelPath).toBe(path.resolve(process.cwd(), baselineModelPath));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
