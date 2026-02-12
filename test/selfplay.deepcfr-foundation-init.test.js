const path = require('path');
const {
    parseArgs,
    makeDefaultManifestPath,
    buildDirectoryList
} = require('../scripts/init-deepcfr-foundation');

describe('deepcfr foundation init script', () => {
    test('parseArgs accepts explicit locations and flags', () => {
        const args = parseArgs([
            '--runs-dir', 'data/runs-x',
            '--deepcfr-dir', 'data/deepcfr-x',
            '--config-template', 'ai/train/deepcfr_config.base.yaml',
            '--config-out', 'data/deepcfr-x/deepcfr_config.active.yaml',
            '--manifest-out', 'data/runs-x/deepcfr.foundation.custom.json',
            '--no-copy-config',
            '--force-config'
        ]);
        expect(args.runsDir.endsWith(path.join('data', 'runs-x'))).toBe(true);
        expect(args.deepcfrDir.endsWith(path.join('data', 'deepcfr-x'))).toBe(true);
        expect(args.copyConfig).toBe(false);
        expect(args.forceConfig).toBe(true);
        expect(args.configOutPath.endsWith(path.join('data', 'deepcfr-x', 'deepcfr_config.active.yaml'))).toBe(true);
        expect(args.manifestOut.endsWith(path.join('data', 'runs-x', 'deepcfr.foundation.custom.json'))).toBe(true);
    });

    test('buildDirectoryList contains expected deepcfr folders', () => {
        const dirs = buildDirectoryList(path.resolve(process.cwd(), 'data', 'deepcfr'));
        expect(Array.isArray(dirs)).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'buffers')))).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'checkpoints')))).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'datasets')))).toBe(true);
        expect(dirs.some((p) => p.endsWith(path.join('data', 'deepcfr', 'reports')))).toBe(true);
    });

    test('makeDefaultManifestPath points under runs dir', () => {
        const runsDir = path.resolve(process.cwd(), 'data', 'runs');
        const out = makeDefaultManifestPath(runsDir);
        expect(out.startsWith(runsDir)).toBe(true);
        expect(out.includes('deepcfr.foundation.')).toBe(true);
        expect(out.endsWith('.json')).toBe(true);
    });
});
