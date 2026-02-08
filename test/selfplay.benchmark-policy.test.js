const {
    parseArgs,
    runBenchmark
} = require('../scripts/benchmark-selfplay-policy');
const fs = require('fs');
const path = require('path');

describe('selfplay benchmark policy script', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('parseArgs parses policy flags', () => {
        const args = parseArgs([
            '--games', '8',
            '--seed', '9',
            '--max-plies', '77',
            '--a-no-cards',
            '--a-rate', '0.1',
            '--b-with-cards',
            '--b-rate', '0.3',
            '--a-model', 'data/models/policy-table.json'
        ]);

        expect(args.games).toBe(8);
        expect(args.seed).toBe(9);
        expect(args.maxPlies).toBe(77);
        expect(args.policyA).toEqual({ allowCardUsage: false, cardUsageRate: 0.1 });
        expect(args.policyB).toEqual({ allowCardUsage: true, cardUsageRate: 0.3 });
        expect(args.modelAPath).toContain(path.join('data', 'models', 'policy-table.json'));
    });

    test('runBenchmark is deterministic and mirrored-fair for identical policies', () => {
        const options = {
            games: 2,
            seed: 14,
            maxPlies: 80,
            policyA: { allowCardUsage: false, cardUsageRate: 0 },
            policyB: { allowCardUsage: false, cardUsageRate: 0 }
        };
        const a = runBenchmark(options);
        const b = runBenchmark(options);

        expect(a).toEqual(b);
        expect(a.schemaVersion).toBe('selfplay.v1');
        expect(a.result.totalGames).toBe(4);
        expect(a.result.totals.A + a.result.totals.B + a.result.totals.draw).toBe(4);
        expect(a.result.totals.A).toBe(a.result.totals.B);
    });

    test('runBenchmark accepts model path options', () => {
        const tmpDir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(tmpDir, { recursive: true });
        const modelPath = path.join(tmpDir, 'policy-table.bench.test.json');
        const model = {
            schemaVersion: 'policy_table.v1',
            states: {}
        };
        fs.writeFileSync(modelPath, JSON.stringify(model), 'utf8');

        const out = runBenchmark({
            games: 1,
            seed: 1,
            maxPlies: 40,
            modelAPath: modelPath
        });

        expect(out.config.policyA.hasModel).toBe(true);
        expect(out.config.policyB.hasModel).toBe(false);
        expect(out.result.totalGames).toBe(2);
        fs.unlinkSync(modelPath);
    });
});
