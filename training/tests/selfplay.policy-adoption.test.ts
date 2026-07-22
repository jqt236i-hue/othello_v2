import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
const {
    parseArgs,
    computeAdoptionDecision,
    computeAdoptionDecisionAverage,
    buildEarlyStopDecision,
    buildSeedList,
    buildSeedBenchmarkJobPlan,
    evaluateEarlyFailure,
    getPolicyAdoptionWorkerRetryLimit,
    runAdoptionCheck
} = require('../scripts/benchmark-policy-adoption');
import { POLICY_GATE_PAYLOAD_SCHEMA_VERSION } from '../scripts/policy-gate-result-utils.js';

describe('selfplay policy adoption check', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('parseArgs validates required candidate model', () => {
        expect(() => parseArgs(['--games', '10'])).toThrow('--candidate-model is required');
    });

    test('parseArgs accepts --help without required args', () => {
        const args = parseArgs(['--help']);
        expect(args.help).toBe(true);
    });

    test('parseArgs parses rate and multi-seed options', () => {
        const args = parseArgs([
            '--games', '20',
            '--seed', '11',
            '--seed-count', '3',
            '--seed-stride', '500',
            '--jobs', '2',
            '--progress-every', '25',
            '--confidence-level', '0.95',
            '--min-lower-bound', '0.01',
            '--min-seed-uplift', '-0.01',
            '--min-seed-pass-count', '2',
            '--a-rate', '0.4',
            '--b-rate', '0.35',
            '--tactical-weight', '0.25',
            '--tactical-depth-opening', '4',
            '--tactical-depth-mid', '6',
            '--tactical-depth-end', '8',
            '--tactical-beam-width', '12',
            '--quality-weight-edge', '0.2',
            '--quality-weight-corner-recovery', '0.3',
            '--quality-weight-corner-recapture', '0.18',
            '--quality-weight-edge-recovery', '0.2',
            '--quality-weight-corner-hold', '0.25',
            '--quality-weight-corner-hold-turns', '0.2',
            '--quality-weight-edge-hold', '0.15',
            '--quality-weight-edge-chain', '0.22',
            '--quality-weight-final-corner-share', '0.35',
            '--quality-weight-final-edge-share', '0.1',
            '--quality-weight-final-longest-edge-run-share', '0.28',
            '--quality-weight-card-future', '0.12',
            '--baseline-model', 'data/models/policy-table.base.json',
            '--opponent-model', 'data/models/policy-table.base.json',
            '--candidate-model', 'data/models/policy-table.json'
        ]);
        expect(args.games).toBe(20);
        expect(args.seed).toBe(11);
        expect(args.seedCount).toBe(3);
        expect(args.seedStride).toBe(500);
        expect(args.jobs).toBe(2);
        expect(args.progressEvery).toBe(25);
        expect(args.confidenceLevel).toBeCloseTo(0.95, 6);
        expect(args.minLowerBound).toBeCloseTo(0.01, 6);
        expect(args.minSeedUplift).toBeCloseTo(-0.01, 6);
        expect(args.minSeedPassCount).toBe(2);
        expect(args.aRate).toBeCloseTo(0.4, 6);
        expect(args.bRate).toBeCloseTo(0.35, 6);
        expect(args.tacticalWeight).toBeCloseTo(0.25, 6);
        expect(args.tacticalDepthOpening).toBe(4);
        expect(args.tacticalDepthMid).toBe(6);
        expect(args.tacticalDepthEnd).toBe(8);
        expect(args.tacticalBeamWidth).toBe(12);
        expect(args.qualityWeightEdge).toBeCloseTo(0.2, 6);
        expect(args.qualityWeightCornerRecovery).toBeCloseTo(0.3, 6);
        expect(args.qualityWeightCornerRecapture).toBeCloseTo(0.18, 6);
        expect(args.qualityWeightEdgeRecovery).toBeCloseTo(0.2, 6);
        expect(args.qualityWeightCornerHold).toBeCloseTo(0.25, 6);
        expect(args.qualityWeightCornerHoldTurns).toBeCloseTo(0.2, 6);
        expect(args.qualityWeightEdgeHold).toBeCloseTo(0.15, 6);
        expect(args.qualityWeightEdgeChain).toBeCloseTo(0.22, 6);
        expect(args.qualityWeightFinalCornerShare).toBeCloseTo(0.35, 6);
        expect(args.qualityWeightFinalEdgeShare).toBeCloseTo(0.1, 6);
        expect(args.qualityWeightFinalLongestEdgeRunShare).toBeCloseTo(0.28, 6);
        expect(args.qualityWeightCardFuture).toBeCloseTo(0.12, 6);
        expect(args.baselineModelPath).toContain(path.join('data', 'models', 'policy-table.base.json'));
        expect(args.opponentModelPath).toContain(path.join('data', 'models', 'policy-table.base.json'));
    });

    test('parseArgs validates jobs', () => {
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--jobs', '0'
        ])).toThrow('--jobs must be >= 1');
    });

    test('parseArgs validates progress interval', () => {
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--progress-every', '-1'
        ])).toThrow('--progress-every must be >= 0');
    });

    test('parseArgs validates confidence options', () => {
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--confidence-level', '1'
        ])).toThrow('--confidence-level must be in [0.5,1)');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--min-lower-bound', '2'
        ])).toThrow('--min-lower-bound must be in [-1,1]');
    });

    test('parseArgs parses and validates white priority', () => {
        const args = parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--white-priority', '1'
        ]);
        expect(args.whitePriority).toBeCloseTo(1, 6);
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--white-priority', '1.5'
        ])).toThrow('--white-priority must be in [0,1]');
    });

    test('parseArgs validates tactical depth and new quality weights', () => {
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--tactical-depth-opening', '-1'
        ])).toThrow('--tactical-depth-opening must be >= 0');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--tactical-beam-width', '-1'
        ])).toThrow('--tactical-beam-width must be >= 0');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--quality-weight-edge', '2'
        ])).toThrow('--quality-weight-edge must be in [0,1]');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--quality-weight-final-corner-share', '-1'
        ])).toThrow('--quality-weight-final-corner-share must be in [0,1]');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--quality-weight-corner-recapture', '2'
        ])).toThrow('--quality-weight-corner-recapture must be in [0,1]');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--quality-weight-corner-hold-turns', '-1'
        ])).toThrow('--quality-weight-corner-hold-turns must be in [0,1]');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--quality-weight-card-future', '2'
        ])).toThrow('--quality-weight-card-future must be in [0,1]');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--quality-weight-edge-chain', '2'
        ])).toThrow('--quality-weight-edge-chain must be in [0,1]');
        expect(() => parseArgs([
            '--games', '2',
            '--candidate-model', 'data/models/policy-table.json',
            '--quality-weight-final-longest-edge-run-share', '-1'
        ])).toThrow('--quality-weight-final-longest-edge-run-share must be in [0,1]');
    });

    test('parseArgs applies quick gate defaults from resolved config', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-adoption-resolved-'));
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
                    '--quick-games', '77',
                    '--quick-adoption-seed-count', '4',
                    '--quick-adoption-seed-stride', '555',
                    '--quick-adoption-threshold', '0.012',
                    '--adoption-jobs', '3',
                    '--max-plies', '150',
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
                '--gate-phase', 'quick',
                '--candidate-model', 'data/models/policy-table.json'
            ]);
            expect(args.games).toBe(77);
            expect(args.seedCount).toBe(4);
            expect(args.seedStride).toBe(555);
            expect(args.threshold).toBeCloseTo(0.012, 6);
            expect(args.jobs).toBe(3);
            expect(args.maxPlies).toBe(150);
            expect(args.aRate).toBeCloseTo(0.33, 6);
            expect(args.bRate).toBeCloseTo(0.33, 6);
            expect(args.tacticalWeight).toBeCloseTo(0.2, 6);
            expect(args.policyScoreWeight).toBeCloseTo(1.8, 6);
            expect(args.whitePriority).toBeCloseTo(0.6, 6);
            expect(args.baselineModelPath).toBe(path.resolve(process.cwd(), baselineModelPath));
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('computeAdoptionDecision applies threshold', () => {
        const baseline = { result: { score: { APercent: 0.50 } } };
        const candidate = { result: { score: { APercent: 0.57 } } };
        const out = computeAdoptionDecision(baseline, candidate, 0.05);
        expect(out.passed).toBe(true);
        expect(out.uplift).toBeCloseTo(0.07, 5);
    });

    test('computeAdoptionDecision uses white-priority weighted score', () => {
        const baseline = {
            result: {
                score: { APercent: 0.50 },
                bySide: { blackB_whiteA: { A: 6, B: 2, draw: 2 } }
            }
        };
        const candidate = {
            result: {
                score: { APercent: 0.50 },
                bySide: { blackB_whiteA: { A: 4, B: 5, draw: 1 } }
            }
        };
        const out = computeAdoptionDecision(baseline, candidate, 0, 1);
        expect(out.baselineWhiteScore).toBeCloseTo(0.7, 6);
        expect(out.candidateWhiteScore).toBeCloseTo(0.45, 6);
        expect(out.uplift).toBeLessThan(0);
    });

    test('computeAdoptionDecision can reward stronger edge chains over scattered edge gain', () => {
        const baseline = {
            result: {
                score: { APercent: 0.50 },
                quality: {
                    A: {
                        edgeTakeWhenAvailableRate: 0.55,
                        avgEdgeChainSwing: 0.2,
                        finalEdgeShare: 0.52,
                        finalLongestEdgeRunShare: 0.25
                    }
                }
            }
        };
        const candidate = {
            result: {
                score: { APercent: 0.50 },
                quality: {
                    A: {
                        edgeTakeWhenAvailableRate: 0.50,
                        avgEdgeChainSwing: 2.4,
                        finalEdgeShare: 0.50,
                        finalLongestEdgeRunShare: 0.75
                    }
                }
            }
        };

        const out = computeAdoptionDecision(baseline, candidate, 0, 0, {
            edge: 0.04,
            edgeChain: 0.30,
            finalEdgeShare: 0.02,
            finalLongestEdgeRunShare: 0.24
        });

        expect(out.candidateQualityScore).toBeGreaterThan(out.baselineQualityScore);
        expect(out.passed).toBe(true);
    });

    test('computeAdoptionDecisionAverage uses average uplift', () => {
        const out = computeAdoptionDecisionAverage([
            { baselineScore: 0.50, candidateScore: 0.57, uplift: 0.07, passed: true },
            { baselineScore: 0.51, candidateScore: 0.55, uplift: 0.04, passed: false },
            { baselineScore: 0.49, candidateScore: 0.57, uplift: 0.08, passed: true }
        ], 0.06);
        expect(out.seedCount).toBe(3);
        expect(out.seedPassCount).toBe(2);
        expect(out.uplift).toBeCloseTo((0.07 + 0.04 + 0.08) / 3, 6);
        expect(out.passedByLowerBound).toBe(true);
        expect(out.passed).toBe(true);
    });

    test('computeAdoptionDecisionAverage enforces min/per-seed conditions', () => {
        const out = computeAdoptionDecisionAverage([
            { baselineScore: 0.50, candidateScore: 0.57, uplift: 0.07, passed: true },
            { baselineScore: 0.51, candidateScore: 0.48, uplift: -0.03, passed: false },
            { baselineScore: 0.49, candidateScore: 0.56, uplift: 0.07, passed: true }
        ], 0.03, -0.01, 2);
        expect(out.passedByAverage).toBe(true);
        expect(out.passedBySeedPassCount).toBe(true);
        expect(out.passedByMinSeedUplift).toBe(false);
        expect(out.minSeedUplift).toBeCloseTo(-0.03, 6);
        expect(out.passed).toBe(false);
    });

    test('computeAdoptionDecisionAverage can enforce uplift lower bound', () => {
        const out = computeAdoptionDecisionAverage([
            { baselineScore: 0.50, candidateScore: 0.57, uplift: 0.07, passed: true },
            { baselineScore: 0.50, candidateScore: 0.51, uplift: 0.01, passed: false },
            { baselineScore: 0.50, candidateScore: 0.59, uplift: 0.09, passed: true }
        ], 0.04, -1, 0, 0.95, 0.02);
        expect(out.passedByAverage).toBe(true);
        expect(out.passedByLowerBound).toBe(false);
        expect(out.requiredMinLowerBound).toBeCloseTo(0.02, 6);
        expect(out.passed).toBe(false);
    });

    test('buildSeedList creates deterministic seed sequence', () => {
        expect(buildSeedList(100, 3, 7)).toEqual([100, 107, 114]);
    });

    test('buildSeedBenchmarkJobPlan distributes extra capacity within seeds', () => {
        expect(buildSeedBenchmarkJobPlan(12, 5, 16)).toEqual({
            totalJobs: 12,
            seedWorkers: 5,
            benchmarkJobsBySeed: [3, 3, 2, 2, 2]
        });
        expect(buildSeedBenchmarkJobPlan(12, 1, 16)).toEqual({
            totalJobs: 12,
            seedWorkers: 1,
            benchmarkJobsBySeed: [12]
        });
    });

    test('getPolicyAdoptionWorkerRetryLimit defaults to one retry', () => {
        expect(getPolicyAdoptionWorkerRetryLimit({})).toBe(1);
        expect(getPolicyAdoptionWorkerRetryLimit({ workerRetryLimit: 0 })).toBe(0);
        expect(getPolicyAdoptionWorkerRetryLimit({ workerRetryLimit: 2.8 })).toBe(2);
    });

    test('evaluateEarlyFailure detects impossible remaining seed pass count', () => {
        const earlyStop = evaluateEarlyFailure([
            { uplift: -0.01, passed: false },
            { uplift: -0.02, passed: false },
            { uplift: -0.03, passed: false }
        ], 4, {
            threshold: 0.01,
            minLowerBound: -1,
            minSeedUplift: -1,
            minSeedPassCount: 2,
            maxPossibleSeedUplift: 1
        });

        expect(earlyStop).toMatchObject({
            reason: 'min-seed-pass-count-impossible',
            completedSeedCount: 3,
            remainingSeedCount: 1,
            seedPassCount: 0,
            remainingPossibleSeedPassCount: 1,
            requiredMinSeedPassCount: 2
        });
    });

    test('buildEarlyStopDecision marks decision as failed with reason', () => {
        const out = buildEarlyStopDecision([
            { baselineScore: 0.50, candidateScore: 0.48, uplift: -0.02, passed: false },
            { baselineScore: 0.50, candidateScore: 0.49, uplift: -0.01, passed: false }
        ], 4, {
            threshold: 0.02,
            confidenceLevel: 0.95,
            minLowerBound: -1,
            minSeedUplift: -1,
            minSeedPassCount: 2,
            maxPossibleSeedUplift: 1
        }, {
            reason: 'min-seed-pass-count-impossible',
            completedSeedCount: 2,
            remainingSeedCount: 2,
            seedPassCount: 0,
            remainingPossibleSeedPassCount: 2,
            maxAchievableAverageUplift: 0.4925,
            maxPossibleSeedUplift: 1
        });

        expect(out.passed).toBe(false);
        expect(out.earlyStop).toBe(true);
        expect(out.earlyStopReason).toBe('min-seed-pass-count-impossible');
        expect(out.seedCount).toBe(4);
        expect(out.completedSeedCount).toBe(2);
    });

    test('runAdoptionCheck returns decision payload', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'othello-adoption-model-'));
        const modelPath = path.join(tempDir, 'policy-table.adoption.test.json');
        const baselinePath = path.join(tempDir, 'policy-table.adoption.base.test.json');
        try {
            fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v1', states: {} }), 'utf8');
            fs.writeFileSync(baselinePath, JSON.stringify({ schemaVersion: 'policy_table.v1', states: {} }), 'utf8');
            const out = await runAdoptionCheck({
                games: 1,
                seed: 1,
                seedCount: 2,
                seedStride: 100,
                maxPlies: 40,
                threshold: 0.05,
                confidenceLevel: 0.95,
                minLowerBound: -1,
                aRate: 0.4,
                bRate: 0.4,
                tacticalWeight: 0.2,
                baselineModelPath: baselinePath,
                opponentModelPath: baselinePath,
                candidateModelPath: modelPath
            });
            expect(out).toHaveProperty('decision');
            expect(out.decision).toHaveProperty('passed');
            expect(out.payloadSchemaVersion).toBe(POLICY_GATE_PAYLOAD_SCHEMA_VERSION);
            expect(out.gateFamily).toBe('adoption');
            expect(Array.isArray(out.decision.failureReasons)).toBe(true);
            expect(out.seedSchedule).toEqual({
                baseSeed: 1,
                seedCount: 2,
                seedStride: 100,
                scheduledSeeds: [1, 101],
                completedSeeds: [1, 101]
            });
            expect(out.config.seedCount).toBe(2);
            expect(out.perSeed.length).toBe(2);
            expect(out.config.aRate).toBeCloseTo(0.4, 6);
            expect(out.config.bRate).toBeCloseTo(0.4, 6);
            expect(out.config.confidenceLevel).toBeCloseTo(0.95, 6);
            expect(out.config.minLowerBound).toBeCloseTo(-1, 6);
            expect(out.config.tacticalWeight).toBeCloseTo(0.2, 6);
            expect(out.config.baselineModelPath).toBe(baselinePath);
            expect(out.config.opponentModelPath).toBe(baselinePath);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
