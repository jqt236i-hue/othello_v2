const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, splitGames, mergeNdjson } = require('../scripts/generate-selfplay-data-parallel');

describe('selfplay parallel generator', () => {
    test('splitGames balances chunks and preserves total', () => {
        expect(splitGames(10, 3)).toEqual([4, 3, 3]);
        expect(splitGames(3, 8)).toEqual([1, 1, 1]);
        expect(splitGames(1, 1)).toEqual([1]);
    });

    test('parseArgs validates numeric ranges', () => {
        expect(() => parseArgs(['--games', '0'])).toThrow('--games must be >= 1');
        expect(() => parseArgs(['--workers', '0'])).toThrow('--workers must be >= 1');
        expect(() => parseArgs(['--seed-stride', '0'])).toThrow('--seed-stride must be >= 1');
        expect(() => parseArgs(['--card-usage-rate', '2'])).toThrow('--card-usage-rate must be in [0,1]');
        expect(() => parseArgs(['--policy-mix-rate', '-0.1'])).toThrow('--policy-mix-rate must be in [0,1]');
        expect(() => parseArgs(['--card-usage-rate-jitter', '2'])).toThrow('--card-usage-rate-jitter must be in [0,1]');
        expect(() => parseArgs(['--tactical-weight-min', '-1'])).toThrow('--tactical-weight-min must be >= 0');
        expect(() => parseArgs(['--tactical-weight-max', '-1'])).toThrow('--tactical-weight-max must be >= 0');
        expect(() => parseArgs(['--tactical-weight-min', '1.3', '--tactical-weight-max', '1.2'])).toThrow('--tactical-weight-max must be >= --tactical-weight-min');
        expect(() => parseArgs(['--tactical-depth-opening', '-1'])).toThrow('--tactical-depth-opening must be >= 0');
        expect(() => parseArgs(['--tactical-depth-mid', '-1'])).toThrow('--tactical-depth-mid must be >= 0');
        expect(() => parseArgs(['--tactical-depth-end', '-1'])).toThrow('--tactical-depth-end must be >= 0');
        expect(() => parseArgs(['--tactical-beam-width', '-1'])).toThrow('--tactical-beam-width must be >= 0');
    });

    test('parseArgs validates --policy-model-pool paths', () => {
        expect(() => parseArgs(['--policy-model-pool', 'missing-policy-model.json'])).toThrow('--policy-model-pool not found:');
    });

    test('parseArgs resolves defaults and options', () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfplay-parallel-'));
        const poolPath = path.join(tempDir, 'pool.json');
        fs.writeFileSync(poolPath, JSON.stringify({ schemaVersion: 'policy_table.v2', states: {} }), 'utf8');
        try {
            const args = parseArgs([
                '--games', '120',
                '--workers', '6',
                '--seed', '100',
                '--seed-stride', '500',
                '--out', 'data/runs/out.ndjson',
                '--policy-mix-rate', '0.7',
                '--card-usage-rate-jitter', '0.2',
                '--tactical-weight-min', '0.8',
                '--tactical-weight-max', '1.5',
                '--tactical-depth-opening', '4',
                '--tactical-depth-mid', '8',
                '--tactical-depth-end', '12',
                '--tactical-beam-width', '8',
                '--policy-model-pool', poolPath
            ]);
            expect(args.games).toBe(120);
            expect(args.workers).toBe(6);
            expect(args.seed).toBe(100);
            expect(args.seedStride).toBe(500);
            expect(args.policyMixRate).toBeCloseTo(0.7, 6);
            expect(args.cardUsageRateJitter).toBeCloseTo(0.2, 6);
            expect(args.tacticalWeightMin).toBeCloseTo(0.8, 6);
            expect(args.tacticalWeightMax).toBeCloseTo(1.5, 6);
            expect(args.tacticalDepthOpening).toBe(4);
            expect(args.tacticalDepthMid).toBe(8);
            expect(args.tacticalDepthEnd).toBe(12);
            expect(args.tacticalBeamWidth).toBe(8);
            expect(args.policyModelPoolPaths).toEqual([path.resolve(process.cwd(), poolPath)]);
            expect(args.out.endsWith('data\\runs\\out.ndjson') || args.out.endsWith('data/runs/out.ndjson')).toBe(true);
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('mergeNdjson merges shard files without losing order', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'selfplay-merge-'));
        try {
            const a = path.join(dir, 'a.ndjson');
            const b = path.join(dir, 'b.ndjson');
            const out = path.join(dir, 'out.ndjson');
            fs.writeFileSync(a, '{"i":1}\n{"i":2}\n', 'utf8');
            fs.writeFileSync(b, '{"i":3}\n', 'utf8');
            mergeNdjson([a, b], out);
            const merged = fs.readFileSync(out, 'utf8');
            expect(merged).toBe('{"i":1}\n{"i":2}\n{"i":3}\n');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
