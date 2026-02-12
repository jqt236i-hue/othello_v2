const path = require('path');
const {
    parseArgs,
    safeParseJson,
    makeDefaultOutputPath,
    isIgnorableArtifactForDeepcfr
} = require('../scripts/preflight-deepcfr-training');

describe('deepcfr preflight script', () => {
    test('parseArgs supports strict and allow-artifacts', () => {
        const args = parseArgs([
            '--python', '.venv/Scripts/python.exe',
            '--check-script', 'ai/train/check_deepcfr_env.py',
            '--allow-artifacts',
            '--skip-check-window',
            '--strict',
            '--deepcfr-dir', 'data/deepcfr-x',
            '--config', 'data/deepcfr-x/deepcfr_config.active.yaml',
            '--out', 'data/runs/deepcfr.preflight.custom.json'
        ]);
        expect(args.pythonPath.endsWith(path.join('.venv', 'Scripts', 'python.exe'))).toBe(true);
        expect(args.checkScriptPath.endsWith(path.join('ai', 'train', 'check_deepcfr_env.py'))).toBe(true);
        expect(args.requireCleanData).toBe(false);
        expect(args.checkWindow).toBe(false);
        expect(args.strict).toBe(true);
        expect(args.deepcfrDir.endsWith(path.join('data', 'deepcfr-x'))).toBe(true);
        expect(args.configPath.endsWith(path.join('data', 'deepcfr-x', 'deepcfr_config.active.yaml'))).toBe(true);
        expect(args.out.endsWith(path.join('data', 'runs', 'deepcfr.preflight.custom.json'))).toBe(true);
    });

    test('safeParseJson returns null on invalid json', () => {
        expect(safeParseJson('{"x":1}')).toEqual({ x: 1 });
        expect(safeParseJson('{oops')).toBeNull();
    });

    test('makeDefaultOutputPath points under runs dir', () => {
        const runsDir = path.resolve(process.cwd(), 'data', 'runs');
        const out = makeDefaultOutputPath(runsDir);
        expect(out.startsWith(runsDir)).toBe(true);
        expect(out.includes('deepcfr.preflight.')).toBe(true);
        expect(out.endsWith('.json')).toBe(true);
    });

    test('isIgnorableArtifactForDeepcfr ignores foundation reports only', () => {
        expect(isIgnorableArtifactForDeepcfr('data/runs/deepcfr.foundation.20260212.json')).toBe(true);
        expect(isIgnorableArtifactForDeepcfr('data/runs/deepcfr.preflight.20260212.json')).toBe(true);
        expect(isIgnorableArtifactForDeepcfr('data/runs/selfplay.train.sample.ndjson')).toBe(false);
    });
});
