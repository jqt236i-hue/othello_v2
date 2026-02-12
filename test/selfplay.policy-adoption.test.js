const path = require('path');
const fs = require('fs');
const {
    parseArgs,
    computeAdoptionDecision,
    computeAdoptionDecisionAverage,
    buildSeedList,
    runAdoptionCheck
} = require('../scripts/benchmark-policy-adoption');

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
            '--min-seed-uplift', '-0.01',
            '--min-seed-pass-count', '2',
            '--a-rate', '0.4',
            '--b-rate', '0.35',
            '--candidate-model', 'data/models/policy-table.json'
        ]);
        expect(args.games).toBe(20);
        expect(args.seed).toBe(11);
        expect(args.seedCount).toBe(3);
        expect(args.seedStride).toBe(500);
        expect(args.minSeedUplift).toBeCloseTo(-0.01, 6);
        expect(args.minSeedPassCount).toBe(2);
        expect(args.aRate).toBeCloseTo(0.4, 6);
        expect(args.bRate).toBeCloseTo(0.35, 6);
    });

    test('computeAdoptionDecision applies threshold', () => {
        const baseline = { result: { score: { APercent: 0.50 } } };
        const candidate = { result: { score: { APercent: 0.57 } } };
        const out = computeAdoptionDecision(baseline, candidate, 0.05);
        expect(out.passed).toBe(true);
        expect(out.uplift).toBeCloseTo(0.07, 5);
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

    test('buildSeedList creates deterministic seed sequence', () => {
        expect(buildSeedList(100, 3, 7)).toEqual([100, 107, 114]);
    });

    test('runAdoptionCheck returns decision payload', () => {
        const modelPath = path.resolve(__dirname, '..', 'data', 'models', 'policy-table.adoption.test.json');
        fs.mkdirSync(path.dirname(modelPath), { recursive: true });
        fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v1', states: {} }), 'utf8');
        const out = runAdoptionCheck({
            games: 1,
            seed: 1,
            seedCount: 2,
            seedStride: 100,
            maxPlies: 40,
            threshold: 0.05,
            aRate: 0.4,
            bRate: 0.4,
            candidateModelPath: modelPath
        });
        expect(out).toHaveProperty('decision');
        expect(out.decision).toHaveProperty('passed');
        expect(out.config.seedCount).toBe(2);
        expect(out.perSeed.length).toBe(2);
        expect(out.config.aRate).toBeCloseTo(0.4, 6);
        expect(out.config.bRate).toBeCloseTo(0.4, 6);
        fs.unlinkSync(modelPath);
    });
});
