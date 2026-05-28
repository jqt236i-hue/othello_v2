import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
    OPTIONAL_FILES,
    GENERATED_OPTIONAL_ASSETS,
    ROOT_FILES,
    VERIFY_DIRS,
    VERIFY_ROOT_FILES,
    createPrepareConfig,
    prepareWorkerAssets,
    verifyMirrors,
    shouldMirrorRelativePath
} = require('../scripts/prepare-worker-assets');

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

describe('prepare-worker-assets', () => {
    const cleanupDirs = [];

    afterEach(() => {
        while (cleanupDirs.length > 0) {
            const dirPath = cleanupDirs.pop();
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    });

    test('verifies index.html as part of mirrored root files', () => {
        expect(ROOT_FILES).toContain('index.html');
        expect(VERIFY_ROOT_FILES).toContain('index.html');
    });

    test('verifies assets as part of mirrored directories', () => {
        expect(VERIFY_DIRS).toContain('assets');
    });

    test('verifies worker runtime root files are mirrored', () => {
        expect(ROOT_FILES).toContain('entry-browser.js');
        expect(ROOT_FILES).toContain('public/runtime.js');
        expect(ROOT_FILES).toContain('public/module-registry.js');
        expect(VERIFY_ROOT_FILES).toContain('entry-browser.js');
        expect(VERIFY_ROOT_FILES).toContain('public/runtime.js');
        expect(VERIFY_ROOT_FILES).toContain('public/module-registry.js');
    });

    test('excludes temp, AGENTS, ts/types files from worker mirror', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-filter-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: [],
            verifyRootFiles: [],
            dirs: ['assets'],
            verifyDirs: ['assets'],
            optionalFiles: [],
            generatedOptionalAssets: []
        };
        const config = createPrepareConfig(options);

        writeFile(path.join(rootDir, 'assets', 'keep.js'), 'ok');
        writeFile(path.join(rootDir, 'assets', 'AGENTS.md'), 'skip');
        writeFile(path.join(rootDir, 'assets', 'asset-manifest.json.tmp-1-2'), 'skip');
        writeFile(path.join(rootDir, 'assets', '__tests__', 'sample.test.js'), 'skip');
        writeFile(path.join(rootDir, 'assets', 'src', 'types', 'index.js'), 'skip');
        writeFile(path.join(rootDir, 'assets', 'src', 'runtime.ts'), 'skip');

        prepareWorkerAssets(options);

        expect(fs.existsSync(path.join(outDir, 'assets', 'keep.js'))).toBe(true);
        expect(fs.existsSync(path.join(outDir, 'assets', 'AGENTS.md'))).toBe(false);
        expect(fs.existsSync(path.join(outDir, 'assets', 'asset-manifest.json.tmp-1-2'))).toBe(false);
        expect(fs.existsSync(path.join(outDir, 'assets', '__tests__', 'sample.test.js'))).toBe(false);
        expect(fs.existsSync(path.join(outDir, 'assets', 'src', 'types', 'index.js'))).toBe(false);
        expect(fs.existsSync(path.join(outDir, 'assets', 'src', 'runtime.ts'))).toBe(false);

        expect(() => verifyMirrors([], [], config)).not.toThrow();
        expect(shouldMirrorRelativePath('assets/keep.js')).toBe(true);
        expect(shouldMirrorRelativePath('assets/AGENTS.md')).toBe(false);
        expect(shouldMirrorRelativePath('assets/file.ts')).toBe(false);
        expect(shouldMirrorRelativePath('assets/asset-manifest.json.tmp-1-2')).toBe(false);
        expect(shouldMirrorRelativePath('game/logic/module-resolver.js')).toBe(false);
    });

    test('detects worker-public index.html drift in a temp mirror', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-root-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: ['index.html'],
            verifyRootFiles: ['index.html'],
            dirs: [],
            verifyDirs: [],
            optionalFiles: [],
            generatedOptionalAssets: []
        };
        const config = createPrepareConfig(options);

        writeFile(path.join(rootDir, 'index.html'), '<!doctype html><html><body>root</body></html>');
        prepareWorkerAssets(options);

        writeFile(path.join(outDir, 'index.html'), '<!doctype html><html><body>drift</body></html>');

        expect(() => verifyMirrors([], [], config)).toThrow(/(size|content) mismatch: index\.html/);
    });

    test('detects worker-public asset drift in a temp mirror', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-assets-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: [],
            verifyRootFiles: [],
            dirs: ['assets'],
            verifyDirs: ['assets'],
            optionalFiles: [],
            generatedOptionalAssets: []
        };
        const config = createPrepareConfig(options);

        writeFile(path.join(rootDir, 'assets', 'sample.txt'), 'root-asset');
        prepareWorkerAssets(options);

        writeFile(path.join(outDir, 'assets', 'sample.txt'), 'drift-asset');

        expect(() => verifyMirrors([], [], config)).toThrow(/(size|content) mismatch: assets[\\/]sample\.txt/);
    });

    test('writes chunk manifest for optional assets over worker size limit', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-chunks-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const sourceRelativePath = 'data/models/othello/policy-table.json';
        const options = {
            rootDir,
            outDir,
            rootFiles: [],
            verifyRootFiles: [],
            dirs: [],
            verifyDirs: [],
            optionalFiles: [],
            generatedOptionalAssets: [{
                sourceRelativePath,
                compressedRelativePath: 'data/models/othello/policy-table.json.chunk.',
                manifestRelativePath: sourceRelativePath,
                compression: 'split',
                chunkSizeBytes: 5,
                splitThresholdBytes: 10
            }]
        };

        writeFile(path.join(rootDir, sourceRelativePath), 'abcdefghijkl');
        prepareWorkerAssets(options);

        const manifestPath = path.join(outDir, sourceRelativePath);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        expect(manifest.assetType).toBe('policy_table.chunks.v1');
        expect(manifest.sourceBytes).toBe(12);
        expect(manifest.chunks).toEqual([
            { url: 'data/models/othello/policy-table.json.chunk.000', bytes: 5 },
            { url: 'data/models/othello/policy-table.json.chunk.001', bytes: 5 },
            { url: 'data/models/othello/policy-table.json.chunk.002', bytes: 2 }
        ]);
        expect(fs.readFileSync(path.join(outDir, manifest.chunks[0].url), 'utf8')).toBe('abcde');
        expect(fs.readFileSync(path.join(outDir, manifest.chunks[2].url), 'utf8')).toBe('kl');
    });

    test('copies split-capable optional assets directly when under threshold', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-direct-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const sourceRelativePath = 'data/models/othello/policy-value.onnx';
        const options = {
            rootDir,
            outDir,
            rootFiles: [],
            verifyRootFiles: [],
            dirs: [],
            verifyDirs: [],
            optionalFiles: [],
            generatedOptionalAssets: [{
                sourceRelativePath,
                compressedRelativePath: 'data/models/othello/policy-value.onnx.chunk.',
                manifestRelativePath: sourceRelativePath,
                compression: 'split',
                chunkSizeBytes: 5,
                splitThresholdBytes: 12
            }]
        };

        writeFile(path.join(rootDir, sourceRelativePath), 'abc');
        prepareWorkerAssets(options);

        expect(fs.readFileSync(path.join(outDir, sourceRelativePath), 'utf8')).toBe('abc');
        expect(fs.existsSync(path.join(outDir, 'data/models/othello/policy-value.onnx.chunk.000'))).toBe(false);
    });

    test('routes ONNX binaries through generated split assets instead of raw optional copies', () => {
        const generatedPaths = GENERATED_OPTIONAL_ASSETS.map((one) => one.sourceRelativePath);
        expect(generatedPaths).toEqual(expect.arrayContaining([
            'data/models/policy-net.onnx',
            'data/models/policy-card.onnx',
            'data/models/policy-target.onnx',
            'data/models/policy-value.onnx',
            'data/models/othello/policy-value.onnx'
        ]));
        expect(OPTIONAL_FILES).not.toEqual(expect.arrayContaining(generatedPaths));
    });
});
