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
    copyFileWithTransientRetry,
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
        expect(VERIFY_DIRS).toContain('vite-dist');
    });

    test('retries only bounded transient copy failures before succeeding', () => {
        const waits = [];
        let attempts = 0;

        copyFileWithTransientRetry('source', 'destination', {
            maxAttempts: 4,
            copyFile: () => {
                attempts += 1;
                if (attempts < 3) {
                    const error = Object.assign(new Error('temporarily locked'), { code: 'UNKNOWN' });
                    throw error;
                }
            },
            wait: (delayMs) => waits.push(delayMs)
        });

        expect(attempts).toBe(3);
        expect(waits).toEqual([25, 50]);
    });

    test('does not retry a non-transient copy failure', () => {
        let attempts = 0;
        const missingSource = Object.assign(new Error('source missing'), { code: 'ENOENT' });

        expect(() => copyFileWithTransientRetry('source', 'destination', {
            copyFile: () => {
                attempts += 1;
                throw missingSource;
            },
            wait: () => {
                throw new Error('wait must not run');
            }
        })).toThrow(missingSource);
        expect(attempts).toBe(1);
    });

    test('mirrors only the deployable WASM runtime used by the CPU Worker', () => {
        expect(OPTIONAL_FILES).toEqual(expect.arrayContaining([
            'node_modules/onnxruntime-web/dist/ort.min.js',
            'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
            'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'
        ]));
        expect(OPTIONAL_FILES).not.toEqual(expect.arrayContaining([
            'node_modules/onnxruntime-web/dist/ort.webgpu.min.js',
            'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm',
            'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm'
        ]));
    });

    test('verifies worker runtime root files are mirrored', () => {
        expect(ROOT_FILES).toContain('entry-browser.js');
        expect(ROOT_FILES).toContain('public/vendor/pixi-8.18.1.min.js');
        expect(ROOT_FILES).toContain('public/vendor/pixi-unsafe-eval-8.18.1.min.js');
        expect(ROOT_FILES).toContain('public/runtime.js');
        expect(ROOT_FILES).toContain('public/module-registry.js');
        expect(ROOT_FILES).toContain('public/module-registry.optional.js');
        for (const group of ['gacha', 'cosmetic', 'leaderboard', 'commentary', 'cpu', 'onnx']) {
            expect(ROOT_FILES).toContain(`public/module-registry.optional.${group}.js`);
            expect(VERIFY_ROOT_FILES).toContain(`public/module-registry.optional.${group}.js`);
        }
        expect(ROOT_FILES).toContain('styles-leaderboard.css');
        expect(ROOT_FILES).toEqual(expect.arrayContaining([
            'styles-feature-deck-builder.css',
            'styles-feature-gacha.css',
            'styles-feature-network.css'
        ]));
        expect(ROOT_FILES).toContain('styles-board-dom-compat.css');
        expect(VERIFY_ROOT_FILES).toContain('entry-browser.js');
        expect(VERIFY_ROOT_FILES).toContain('public/vendor/pixi-8.18.1.min.js');
        expect(VERIFY_ROOT_FILES).toContain('public/vendor/pixi-unsafe-eval-8.18.1.min.js');
        expect(VERIFY_ROOT_FILES).toContain('public/runtime.js');
        expect(VERIFY_ROOT_FILES).toContain('public/module-registry.js');
        expect(VERIFY_ROOT_FILES).toContain('styles-leaderboard.css');
        expect(VERIFY_ROOT_FILES).toEqual(expect.arrayContaining([
            'styles-feature-deck-builder.css',
            'styles-feature-gacha.css',
            'styles-feature-network.css'
        ]));
        expect(VERIFY_ROOT_FILES).toContain('styles-board-dom-compat.css');
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
        expect(shouldMirrorRelativePath('assets/character-notes.md')).toBe(false);
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

    test.each([
        'public/vendor/pixi-8.18.1.min.js',
        'public/vendor/pixi-unsafe-eval-8.18.1.min.js'
    ])('mirrors the versioned Pixi vendor %s and detects nested-file drift', (vendorPath) => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-pixi-vendor-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: [vendorPath],
            verifyRootFiles: [vendorPath],
            dirs: [],
            verifyDirs: [],
            optionalFiles: [],
            generatedOptionalAssets: []
        };
        const config = createPrepareConfig(options);
        writeFile(path.join(rootDir, vendorPath), 'pixi-vendor-fixture');

        prepareWorkerAssets(options);
        expect(fs.readFileSync(path.join(outDir, vendorPath), 'utf8')).toBe('pixi-vendor-fixture');
        expect(() => verifyMirrors([], [], config)).not.toThrow();

        writeFile(path.join(outDir, vendorPath), 'drift');
        expect(() => verifyMirrors([], [], config)).toThrow(/(size|content) mismatch: public[\\/]vendor[\\/]pixi(?:-unsafe-eval)?-8\.18\.1\.min\.js/);
    });

    test('can sync selected root files without deleting unrelated mirror files', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-incremental-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: ['public/module-registry.js', 'public/module-registry.optional.js'],
            verifyRootFiles: ['public/module-registry.js', 'public/module-registry.optional.js'],
            dirs: [],
            verifyDirs: [],
            optionalFiles: [],
            generatedOptionalAssets: [],
            cleanOutDir: false
        };
        const config = createPrepareConfig(options);

        writeFile(path.join(rootDir, 'public', 'module-registry.js'), 'startup');
        writeFile(path.join(rootDir, 'public', 'module-registry.optional.js'), 'optional');
        writeFile(path.join(outDir, 'styles-layout-result.css'), 'unrelated-user-work');

        prepareWorkerAssets(options);

        expect(fs.readFileSync(path.join(outDir, 'public', 'module-registry.js'), 'utf8')).toBe('startup');
        expect(fs.readFileSync(path.join(outDir, 'public', 'module-registry.optional.js'), 'utf8')).toBe('optional');
        expect(fs.readFileSync(path.join(outDir, 'styles-layout-result.css'), 'utf8')).toBe('unrelated-user-work');
        expect(() => verifyMirrors([], [], config)).not.toThrow();
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

    test('rejects a manual-only file when strict mirror verification is requested', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-strict-'));
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
        expect(() => verifyMirrors([], [], config, { rejectExtraFiles: true })).not.toThrow();

        writeFile(path.join(outDir, 'manual-only.txt'), 'do not source-edit mirrors');
        expect(() => verifyMirrors([], [], config, { rejectExtraFiles: true }))
            .toThrow(/unexpected mirror file: manual-only\.txt/);
    });

    test('ignores generatedAt/version-only drift for asset manifest mirror verification even when byte size changes', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-manifest-'));
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

        const rootManifestPath = path.join(rootDir, 'assets', 'asset-manifest.json');
        writeFile(rootManifestPath, JSON.stringify({
            version: 1,
            generatedAt: '2026-05-30T00:00:00.000Z',
            files: [{ path: 'assets/example.png', hash: 'abc' }]
        }, null, 2));
        prepareWorkerAssets(options);

        const mirroredManifestPath = path.join(outDir, 'assets', 'asset-manifest.json');
        const files = [{ path: 'assets/example.png', hash: 'abc' }];
        fs.writeFileSync(rootManifestPath, JSON.stringify({
            version: 1,
            generatedAt: '2026-05-30T00:00:00.000Z',
            files
        }, null, 2), 'utf8');
        fs.writeFileSync(mirroredManifestPath, JSON.stringify({
            version: 22,
            generatedAt: '2026-05-31T00:00:00Z',
            files
        }, null, 2), 'utf8');

        expect(() => verifyMirrors([], [], config)).not.toThrow();
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
            'data/models/policy-target.onnx',
            'data/models/policy-value.onnx',
            'data/models/othello/policy-value.onnx'
        ]));
        expect(OPTIONAL_FILES).not.toEqual(expect.arrayContaining(generatedPaths));
    });

    test('writes model asset availability manifest for browser probes', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-model-manifest-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: [],
            verifyRootFiles: [],
            dirs: [],
            verifyDirs: [],
            optionalFiles: ['data/models/policy-table.json'],
            generatedOptionalAssets: [{
                sourceRelativePath: 'data/models/othello/policy-value.onnx',
                compressedRelativePath: 'data/models/othello/policy-value.onnx.chunk.',
                manifestRelativePath: 'data/models/othello/policy-value.onnx',
                compression: 'split',
                chunkSizeBytes: 5,
                splitThresholdBytes: 12
            }]
        };

        writeFile(path.join(rootDir, 'data/models/policy-table.json'), '{"schemaVersion":"policy_table.v2","states":{}}');
        writeFile(path.join(rootDir, 'data/models/othello/policy-value.onnx'), 'abc');
        prepareWorkerAssets(options);

        const manifestPath = path.join(outDir, 'data/models/model-assets.json');
        const firstManifestBytes = fs.readFileSync(manifestPath, 'utf8');
        const manifest = JSON.parse(firstManifestBytes);
        expect(manifest.schemaVersion).toBe('model_assets.v1');
        expect(manifest.generatedAt).toBeUndefined();
        expect(manifest.files).toEqual(expect.arrayContaining([
            'data/models/policy-table.json',
            'data/models/othello/policy-value.onnx'
        ]));
        expect(manifest.files).not.toContain('data/models/policy-target.onnx');

        prepareWorkerAssets(options);
        expect(fs.readFileSync(manifestPath, 'utf8')).toBe(firstManifestBytes);
    });
});
