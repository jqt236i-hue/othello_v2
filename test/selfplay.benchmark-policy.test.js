const {
    parseArgs,
    runBenchmark
} = require('../scripts/benchmark-selfplay-policy');
const fs = require('fs');
const path = require('path');

function createBenchmarkPolicy(overrides) {
    return Object.assign({
        allowCardUsage: false,
        cardUsageRate: 0,
        enableTacticalLookahead: false
    }, overrides || {});
}

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
            '--jobs', '3',
            '--max-plies', '77',
            '--a-no-cards',
            '--a-rate', '0.1',
            '--b-with-cards',
            '--b-rate', '0.3',
            '--a-model', 'data/models/policy-table.json'
        ]);

        expect(args.games).toBe(8);
        expect(args.seed).toBe(9);
        expect(args.jobs).toBe(3);
        expect(args.maxPlies).toBe(77);
        expect(args.policyA).toEqual({
            allowCardUsage: false,
            cardUsageRate: 0.1,
            policyScoreWeight: 1,
            heuristicWeight: 1
        });
        expect(args.policyB).toEqual({
            allowCardUsage: true,
            cardUsageRate: 0.3,
            policyScoreWeight: 1,
            heuristicWeight: 1
        });
        expect(args.modelAPath).toContain(path.join('data', 'models', 'policy-table.json'));
    });

    test('runBenchmark is deterministic and mirrored-fair for identical policies', async () => {
        const options = {
            games: 2,
            seed: 14,
            maxPlies: 80,
            policyA: createBenchmarkPolicy(),
            policyB: createBenchmarkPolicy()
        };
        const a = await runBenchmark(options);
        const b = await runBenchmark(options);

        expect(a).toEqual(b);
        expect(a.schemaVersion).toBe('selfplay.v2');
        expect(a.result.totalGames).toBe(4);
        expect(a.result.totals.A + a.result.totals.B + a.result.totals.draw).toBe(4);
        expect(a.result.totals.A).toBe(a.result.totals.B);
        expect(a.result.quality.A).toHaveProperty('finalCornerShare');
        expect(a.result.quality.A).toHaveProperty('finalEdgeShare');
        expect(a.result.quality.A).toHaveProperty('cornerRecoveryRate');
        expect(a.result.quality.A).toHaveProperty('cornerRecaptureRate');
        expect(a.result.quality.A).toHaveProperty('edgeHoldRate');
        expect(a.result.quality.A).toHaveProperty('avgCornerHoldTurnsNext3Plies');
        expect(a.result.quality.A).toHaveProperty('avgCardFutureDiscDelta3Ply');
    });

    test('runBenchmark accepts model path options', async () => {
        const tmpDir = path.resolve(__dirname, '..', 'data', 'models');
        fs.mkdirSync(tmpDir, { recursive: true });
        const modelPath = path.join(tmpDir, 'policy-table.bench.test.json');
        const model = {
            schemaVersion: 'policy_table.v1',
            states: {}
        };
        fs.writeFileSync(modelPath, JSON.stringify(model), 'utf8');

        const out = await runBenchmark({
            games: 1,
            seed: 1,
            maxPlies: 40,
            policyA: createBenchmarkPolicy(),
            policyB: createBenchmarkPolicy(),
            modelAPath: modelPath
        });

        expect(out.config.policyA.hasModel).toBe(true);
        expect(out.config.policyB.hasModel).toBe(false);
        expect(out.result.totalGames).toBe(2);
        fs.unlinkSync(modelPath);
    });

    test('runBenchmark emits progress callbacks', async () => {
        const logs = [];
        await runBenchmark({
            games: 2,
            seed: 3,
            maxPlies: 60,
            policyA: createBenchmarkPolicy(),
            policyB: createBenchmarkPolicy(),
            onProgress: (one) => logs.push(one)
        });

        expect(logs.length).toBe(4);
        expect(logs[logs.length - 1].completed).toBe(4);
        expect(logs[logs.length - 1].total).toBe(4);
    });

    test('runBenchmark aborts when shouldStop requests early exit', async () => {
        let stopRequested = false;

        await expect(runBenchmark({
            games: 4,
            seed: 3,
            maxPlies: 60,
            policyA: createBenchmarkPolicy(),
            policyB: createBenchmarkPolicy(),
            shouldStop: () => stopRequested,
            onProgress: (one) => {
                if (one && one.completed >= 1) stopRequested = true;
            }
        })).rejects.toMatchObject({ code: 'BENCHMARK_ABORTED' });
    });

    test('runBenchmark honors card enable flags during simulation', async () => {
        const withCards = await runBenchmark({
            games: 2,
            seed: 19,
            maxPlies: 220,
            policyA: createBenchmarkPolicy({ allowCardUsage: true, cardUsageRate: 1 }),
            policyB: createBenchmarkPolicy({ allowCardUsage: true, cardUsageRate: 1 })
        });
        const noCards = await runBenchmark({
            games: 2,
            seed: 19,
            maxPlies: 220,
            policyA: createBenchmarkPolicy(),
            policyB: createBenchmarkPolicy()
        });

        expect(withCards.result.quality.A.useCardActions + withCards.result.quality.B.useCardActions).toBeGreaterThan(0);
        expect(noCards.result.quality.A.useCardActions + noCards.result.quality.B.useCardActions).toBe(0);
    });

    test('runBenchmark parallel mode preserves deterministic results', async () => {
        const options = {
            games: 2,
            seed: 21,
            maxPlies: 80,
            policyA: createBenchmarkPolicy(),
            policyB: createBenchmarkPolicy()
        };

        const sequential = await runBenchmark(Object.assign({}, options, { jobs: 1 }));
        const parallel = await runBenchmark(Object.assign({}, options, { jobs: 2 }));

        expect(parallel.result).toEqual(sequential.result);
        expect(parallel.config.jobs).toBe(2);
        expect(sequential.config.jobs).toBe(1);
    }, 60000);
});
