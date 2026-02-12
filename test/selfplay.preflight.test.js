const path = require('path');
const {
    parseArgs,
    safeParseJson,
    makeDefaultOutputPath
} = require('../scripts/preflight-selfplay-training');

describe('selfplay preflight script', () => {
    test('parseArgs supports strict and allow-artifacts', () => {
        const args = parseArgs([
            '--python', '.venv/Scripts/python.exe',
            '--allow-artifacts',
            '--skip-check-window',
            '--strict',
            '--out', 'data/runs/preflight.custom.json'
        ]);
        expect(args.pythonPath.endsWith(path.join('.venv', 'Scripts', 'python.exe'))).toBe(true);
        expect(args.requireCleanData).toBe(false);
        expect(args.checkWindow).toBe(false);
        expect(args.strict).toBe(true);
        expect(args.out.endsWith(path.join('data', 'runs', 'preflight.custom.json'))).toBe(true);
    });

    test('safeParseJson returns null on invalid json', () => {
        expect(safeParseJson('{"x":1}')).toEqual({ x: 1 });
        expect(safeParseJson('{oops')).toBeNull();
    });

    test('makeDefaultOutputPath points under runs dir', () => {
        const runsDir = path.resolve(process.cwd(), 'data', 'runs');
        const out = makeDefaultOutputPath(runsDir);
        expect(out.startsWith(runsDir)).toBe(true);
        expect(out.includes('preflight.')).toBe(true);
        expect(out.endsWith('.json')).toBe(true);
    });
});

