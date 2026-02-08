const path = require('path');
const fs = require('fs');
const {
    parseArgs,
    computeAdoptionDecision,
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

    test('computeAdoptionDecision applies threshold', () => {
        const baseline = { result: { score: { APercent: 0.50 } } };
        const candidate = { result: { score: { APercent: 0.57 } } };
        const out = computeAdoptionDecision(baseline, candidate, 0.05);
        expect(out.passed).toBe(true);
        expect(out.uplift).toBeCloseTo(0.07, 5);
    });

    test('runAdoptionCheck returns decision payload', () => {
        const modelPath = path.resolve(__dirname, '..', 'data', 'models', 'policy-table.adoption.test.json');
        fs.mkdirSync(path.dirname(modelPath), { recursive: true });
        fs.writeFileSync(modelPath, JSON.stringify({ schemaVersion: 'policy_table.v1', states: {} }), 'utf8');
        const out = runAdoptionCheck({
            games: 1,
            seed: 1,
            maxPlies: 40,
            threshold: 0.05,
            candidateModelPath: modelPath
        });
        expect(out).toHaveProperty('decision');
        expect(out.decision).toHaveProperty('passed');
        fs.unlinkSync(modelPath);
    });
});
