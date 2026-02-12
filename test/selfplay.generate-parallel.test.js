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
    });

    test('parseArgs resolves defaults and options', () => {
        const args = parseArgs(['--games', '120', '--workers', '6', '--seed', '100', '--seed-stride', '500', '--out', 'data/runs/out.ndjson']);
        expect(args.games).toBe(120);
        expect(args.workers).toBe(6);
        expect(args.seed).toBe(100);
        expect(args.seedStride).toBe(500);
        expect(args.out.endsWith('data\\runs\\out.ndjson') || args.out.endsWith('data/runs/out.ndjson')).toBe(true);
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
