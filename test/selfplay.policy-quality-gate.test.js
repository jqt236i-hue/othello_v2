const path = require('path');
const {
    DEFAULT_QUALITY_WEIGHTS,
    parseArgs,
    buildQualitySeedDecision,
    buildQualityGatePayload
} = require('../scripts/benchmark-policy-quality-gate');

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
            candidateModelPath: path.join('data', 'models', 'candidate.json'),
            baselineModelPath: null,
            opponentModelPath: null,
            ...DEFAULT_QUALITY_WEIGHTS
        });

        expect(payload.gateType).toBe('quality');
        expect(payload.schemaVersion).toBe('selfplay.v2');
        expect(payload.perSeed).toHaveLength(2);
        expect(payload.perSeed[0].qualityDecision.uplift).toBeCloseTo(0.12);
        expect(payload.decision.uplift).toBeCloseTo(0.11);
        expect(payload.decision.passed).toBe(true);
        expect(payload.sourceDecision.passed).toBe(false);
        expect(payload.config.qualityWeights.qualityWeightCorner).toBe(DEFAULT_QUALITY_WEIGHTS.qualityWeightCorner);
    });
});
