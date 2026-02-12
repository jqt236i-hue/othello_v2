const { parseArgs } = require('../scripts/run-ui-level-match');

describe('ui level match script args', () => {
    test('parseArgs accepts seed and levels', () => {
        const args = parseArgs([
            '--black', '6',
            '--white', '5',
            '--seed', '12345',
            '--timeout-ms', '200000',
            '--out', 'data/runs/level-match.test.json'
        ]);
        expect(args.black).toBe(6);
        expect(args.white).toBe(5);
        expect(args.seed).toBe(12345);
        expect(args.timeoutMs).toBe(200000);
    });

    test('parseArgs validates seed and timeout', () => {
        expect(() => parseArgs(['--seed', 'nan'])).toThrow('--seed must be a number');
        expect(() => parseArgs(['--timeout-ms', '999'])).toThrow('--timeout-ms must be >= 1000');
    });
});
