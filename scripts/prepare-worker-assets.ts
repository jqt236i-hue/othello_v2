import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import _generate_asset_manifest from './generate-asset-manifest';
const { generateManifest } = _generate_asset_manifest;
import _generate_observation_gacha_catalog from './generate-observation-gacha-catalog';
const { generateObservationGachaCatalogs } = _generate_observation_gacha_catalog;
import _build_module_registry from './build-module-registry';
const { buildRegistry } = _build_module_registry;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface PrepareWorkerAssetsOptions {
    rootDir?: string;
    outDir?: string;
    rootFiles?: string[];
    dirs?: string[];
    verifyDirs?: string[];
    verifyRootFiles?: string[];
    optionalFiles?: string[];
    generatedOptionalAssets?: GeneratedOptionalAssetTask[];
    cleanOutDir?: boolean;
}

interface PrepareWorkerAssetsConfig {
    rootDir: string;
    outDir: string;
    rootFiles: string[];
    dirs: string[];
    verifyDirs: string[];
    verifyRootFiles: string[];
    optionalFiles: string[];
    generatedOptionalAssets: GeneratedOptionalAssetTask[];
    cleanOutDir: boolean;
}

interface GeneratedOptionalAssetTask {
    sourceRelativePath: string;
    compressedRelativePath: string;
    manifestRelativePath: string;
    compression: string;
    chunkSizeBytes?: number;
    splitThresholdBytes?: number;
}

interface CopyFileRetryOptions {
    maxAttempts?: number;
    copyFile?: (sourcePath: string, destinationPath: string) => void;
    wait?: (delayMs: number) => void;
}

const TRANSIENT_COPY_ERROR_CODES = new Set(['UNKNOWN', 'EBUSY', 'EPERM']);
const DEFAULT_COPY_MAX_ATTEMPTS = 8;
const COPY_RETRY_WAIT_SIGNAL = new Int32Array(new SharedArrayBuffer(4));

function waitForCopyRetry(delayMs: number) {
    Atomics.wait(COPY_RETRY_WAIT_SIGNAL, 0, 0, delayMs);
}

function copyFileWithTransientRetry(
    sourcePath: string,
    destinationPath: string,
    options: CopyFileRetryOptions = {}
) {
    const maxAttempts = Math.max(1, Math.floor(options.maxAttempts || DEFAULT_COPY_MAX_ATTEMPTS));
    const copyFile = options.copyFile || fs.copyFileSync;
    const wait = options.wait || waitForCopyRetry;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            copyFile(sourcePath, destinationPath);
            return;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException | undefined)?.code || '';
            if (!TRANSIENT_COPY_ERROR_CODES.has(code) || attempt >= maxAttempts) {
                throw error;
            }
            wait(Math.min(500, 25 * (2 ** (attempt - 1))));
        }
    }
}

function findRepoRoot(startDir: string): string {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    return startDir;
}
const ROOT = findRepoRoot(path.resolve(__dirname, '..'));
const OUT_DIR = path.join(ROOT, 'worker-public');
const WORKER_ASSET_MAX_BYTES = 25 * 1024 * 1024;
const MODEL_ASSET_MANIFEST_PATH = 'data/models/model-assets.json';

const ROOT_FILES: readonly string[] = Object.freeze([
    '.assetsignore',
    'index.html',
    'index.classic.html',
    'mobile-preview.html',
    'entry-browser.js',
    'shared-constants.js',
    'styles-animations.css',
    'styles-base.css',
    'styles-board.css',
    'styles-board-dom-compat.css',
    'styles-cards.css',
    'styles-layout.css',
    'styles-charge-hud.css',
    'styles-layout-controls.css',
    'styles-layout-info.css',
    'styles-layout-result.css',
    'styles-layout-characters.css',
    'styles-feature-deck-builder.css',
    'styles-feature-deck-builder-responsive.css',
    'styles-feature-gacha.css',
    'styles-feature-network-layout-controls.css',
    'styles-feature-network.css',
    'styles-feature-network-responsive.css',
    'styles-feature-rules-help-layout-info.css',
    'styles-feature-rules-help-cards.css',
    'styles-feature-rules-help-responsive.css',
    'styles-leaderboard.css',
    'styles-profile.css',
    'styles-responsive.css',
    'styles-stone-shadows.css',
    'styles-mobile-command-surface.css',
    'styles-variables.css',
    'public/vendor/pixi-8.18.1.min.js',
    'public/vendor/pixi-unsafe-eval-8.18.1.min.js',
    'public/runtime.js',
    'public/module-registry.js',
    'public/module-registry.optional.js',
    'public/module-registry.optional.gacha.js',
    'public/module-registry.optional.cosmetic.js',
    'public/module-registry.optional.leaderboard.js',
    'public/module-registry.optional.commentary.js',
    'public/module-registry.optional.cpu.js',
    'public/module-registry.optional.onnx.js'
]);

const DIRS: readonly string[] = Object.freeze([
    'assets',
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils',
    'vite-dist'
]);

const VERIFY_DIRS: readonly string[] = Object.freeze([
    'assets',
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils',
    'vite-dist'
]);

const VERIFY_ROOT_FILES: readonly string[] = Object.freeze(ROOT_FILES.slice());

const OPTIONAL_FILES: readonly string[] = Object.freeze([
    'game/ai/commentary-data.js',
    'data/models/policy-net.onnx.meta.json',
    'data/models/policy-target.onnx.meta.json',
    'data/models/policy-value.onnx.meta.json',
    'data/models/policy-table.json',
    'data/models/othello/policy-value.onnx.meta.json',
    'node_modules/onnxruntime-web/dist/ort.min.js',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'
]);

const GENERATED_OPTIONAL_ASSETS: readonly GeneratedOptionalAssetTask[] = Object.freeze([
    {
        sourceRelativePath: 'data/models/policy-net.onnx',
        compressedRelativePath: 'data/models/policy-net.onnx.chunk.',
        manifestRelativePath: 'data/models/policy-net.onnx',
        compression: 'split',
        chunkSizeBytes: 8 * 1024 * 1024
    },
    {
        sourceRelativePath: 'data/models/policy-target.onnx',
        compressedRelativePath: 'data/models/policy-target.onnx.chunk.',
        manifestRelativePath: 'data/models/policy-target.onnx',
        compression: 'split',
        chunkSizeBytes: 8 * 1024 * 1024
    },
    {
        sourceRelativePath: 'data/models/policy-value.onnx',
        compressedRelativePath: 'data/models/policy-value.onnx.chunk.',
        manifestRelativePath: 'data/models/policy-value.onnx',
        compression: 'split',
        chunkSizeBytes: 8 * 1024 * 1024
    },
    {
        sourceRelativePath: 'data/models/othello/policy-value.onnx',
        compressedRelativePath: 'data/models/othello/policy-value.onnx.chunk.',
        manifestRelativePath: 'data/models/othello/policy-value.onnx',
        compression: 'split',
        chunkSizeBytes: 8 * 1024 * 1024
    }
]);

const EXCLUDED_MIRROR_RELATIVE_PATHS = new Set([
    'game/logic/card-usage-prechecks.js',
    'game/logic/charge-ledger.js',
    'game/logic/module-resolver.js',
    'game/logic/presentation-helpers.js',
    'game/logic/random-source.js'
]);

const EXCLUDED_MIRROR_DIRECTORY_PREFIXES = Object.freeze([
    // Source models and Blender work files are authoring-only. Runtime-ready
    // character art lives under assets/images and remains deployable.
    'assets/models/',
    // Authoring references; the playable character art is stored alongside this
    // directory and remains deployable.
    'assets/images/special-cards/characters/observer_will_reference/',
    // Unpublished story material (novel, story map, MV storyboards). The game
    // does not load these, and they must not be publicly served.
    'assets/ラノベ/',
    'assets/Reversi Destiny ～黒白の運命～v1/',
    'assets/mv-storyboards-2026-09-12/'
]);

function normalizeRelativePath(relativePath: string) {
    return String(relativePath || '').split(path.sep).join('/');
}

function shouldMirrorRelativePath(relativePath: string) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) return false;
    if (EXCLUDED_MIRROR_RELATIVE_PATHS.has(normalized)) return false;
    if (EXCLUDED_MIRROR_DIRECTORY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;

    const baseName = path.posix.basename(normalized);
    if (baseName === 'AGENTS.md') return false;
    if (baseName.includes('.tmp-')) return false;

    if (/\.(ts|tsx|d\.ts)$/i.test(baseName)) return false;
    if (normalized.startsWith('assets/') && /\.md$/i.test(baseName)) return false;
    if (/\.test\.(js|ts|tsx)$/i.test(baseName)) return false;
    if (baseName.endsWith('.map')) return false;

    if (normalized.includes('/__tests__/')) return false;
    if (normalized.includes('/src/types/')) return false;

    return true;
}

function cloneList<T>(list: readonly T[] | undefined): T[] {
    return Array.isArray(list) ? list.slice() : [];
}

function createPrepareConfig(options?: PrepareWorkerAssetsOptions): PrepareWorkerAssetsConfig {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootDir = path.resolve(String(opts.rootDir || ROOT));
    const outDir = path.resolve(String(opts.outDir || path.join(rootDir, 'worker-public')));
    const rootFiles = cloneList(opts.rootFiles || ROOT_FILES);
    const dirs = cloneList(opts.dirs || DIRS);
    return {
        rootDir,
        outDir,
        rootFiles,
        dirs,
        verifyDirs: cloneList(opts.verifyDirs || (opts.dirs ? dirs : VERIFY_DIRS)),
        verifyRootFiles: cloneList(opts.verifyRootFiles || (opts.rootFiles ? rootFiles : VERIFY_ROOT_FILES)),
        optionalFiles: cloneList(opts.optionalFiles || OPTIONAL_FILES),
        generatedOptionalAssets: cloneList(opts.generatedOptionalAssets || GENERATED_OPTIONAL_ASSETS),
        cleanOutDir: opts.cleanOutDir !== false
    };
}

function toMiBString(bytes: number) {
    return (Number(bytes) / (1024 * 1024)).toFixed(1);
}

function rmDirSafe(targetPath: string) {
    if (!fs.existsSync(targetPath)) return;

    const stat = fs.lstatSync(targetPath);
    if (!stat.isDirectory()) {
        fs.rmSync(targetPath, { force: true, maxRetries: 5, retryDelay: 50 });
        return;
    }

    // Windows can keep the directory handle itself busy even when its children are removable.
    // Clear the contents in place so prepare still works if worker-public is the current cwd elsewhere.
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(targetPath, entry.name);
        fs.rmSync(entryPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    }
}

function ensureDir(dirPath: string) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileByRelative(relativePath: any, config: any) {
    const settings = createPrepareConfig(config);
    if (!shouldMirrorRelativePath(relativePath)) return;
    const src = path.join(settings.rootDir, relativePath);
    if (!fs.existsSync(src)) return;
    const dst = path.join(settings.outDir, relativePath);
    ensureDir(path.dirname(dst));
    copyFileWithTransientRetry(src, dst);
}

function resolveCopyableOptionalFiles(config: any) {
    const settings = createPrepareConfig(config);
    const out = [];
    for (const relativePath of settings.optionalFiles) {
        const src = path.join(settings.rootDir, relativePath);
        if (!fs.existsSync(src)) continue;

        const stat = fs.statSync(src);
        if (stat.size > WORKER_ASSET_MAX_BYTES) {
            console.warn(
                `[worker-prepare] optional-skip-too-large ${relativePath} size=${toMiBString(stat.size)}MiB limit=${toMiBString(WORKER_ASSET_MAX_BYTES)}MiB`
            );
            continue;
        }

        out.push(relativePath);
    }
    return out;
}

function buildCompressedAssetManifest(task: any, compressedBytes: any, sourceBytes: any) {
    return Buffer.from(JSON.stringify({
        assetType: 'policy_table.redirect.v1',
        compression: task.compression,
        url: task.compressedRelativePath.replace(/\\/g, '/'),
        sourceBytes,
        compressedBytes
    }), 'utf8');
}

function buildSplitAssetManifest(chunks: any[], sourceBytes: number) {
    return Buffer.from(JSON.stringify({
        assetType: 'policy_table.chunks.v1',
        chunks,
        sourceBytes
    }), 'utf8');
}

function resolveGeneratedOptionalAssets(config: any) {
    const settings = createPrepareConfig(config);
    const out = [];
    for (const task of settings.generatedOptionalAssets) {
        const src = path.join(settings.rootDir, task.sourceRelativePath);
        if (!fs.existsSync(src)) continue;

        const raw = fs.readFileSync(src);
        let compressed = null;
        if (task.compression === 'gzip') {
            compressed = zlib.gzipSync(raw, { level: 9 });
        } else if (task.compression === 'split') {
            const splitThreshold = Math.max(1, Math.min(WORKER_ASSET_MAX_BYTES, Math.floor(Number(task.splitThresholdBytes) || WORKER_ASSET_MAX_BYTES)));
            if (raw.length <= splitThreshold) {
                out.push({
                    relativePath: task.manifestRelativePath,
                    content: raw
                });
                console.log(
                    `[worker-prepare] generated-copy ${task.sourceRelativePath} raw=${toMiBString(raw.length)}MiB threshold=${toMiBString(splitThreshold)}MiB`
                );
                continue;
            }
            const chunkSize = Math.max(1, Math.min(WORKER_ASSET_MAX_BYTES, Math.floor(Number(task.chunkSizeBytes) || (8 * 1024 * 1024))));
            const chunks = [];
            for (let offset = 0, index = 0; offset < raw.length; offset += chunkSize, index += 1) {
                const part = raw.subarray(offset, Math.min(raw.length, offset + chunkSize));
                const relativePath = `${task.compressedRelativePath}${String(index).padStart(3, '0')}`;
                chunks.push({
                    url: relativePath.replace(/\\/g, '/'),
                    bytes: part.length
                });
                out.push({
                    relativePath,
                    content: part
                });
            }
            out.push({
                relativePath: task.manifestRelativePath,
                content: buildSplitAssetManifest(chunks, raw.length)
            });
            console.log(
                `[worker-prepare] generated-split ${task.sourceRelativePath} -> ${chunks.length} chunks raw=${toMiBString(raw.length)}MiB chunk=${toMiBString(chunkSize)}MiB`
            );
            continue;
        } else {
            console.warn(`[worker-prepare] generated-skip-unknown-compression ${task.compression}`);
            continue;
        }

        if (compressed.length > WORKER_ASSET_MAX_BYTES) {
            console.warn(
                `[worker-prepare] generated-skip-too-large ${task.compressedRelativePath} size=${toMiBString(compressed.length)}MiB limit=${toMiBString(WORKER_ASSET_MAX_BYTES)}MiB`
            );
            continue;
        }

        const manifest = buildCompressedAssetManifest(task, compressed.length, raw.length);
        out.push({
            relativePath: task.manifestRelativePath,
            content: manifest
        });
        out.push({
            relativePath: task.compressedRelativePath,
            content: compressed
        });
        console.log(
            `[worker-prepare] generated-compressed ${task.sourceRelativePath} -> ${task.compressedRelativePath} raw=${toMiBString(raw.length)}MiB compressed=${toMiBString(compressed.length)}MiB`
        );
    }
    return out;
}

function writeGeneratedOptionalAssets(generatedAssets: any, config: any) {
    const settings = createPrepareConfig(config);
    for (const asset of Array.isArray(generatedAssets) ? generatedAssets : []) {
        const dst = path.join(settings.outDir, asset.relativePath);
        ensureDir(path.dirname(dst));
        fs.writeFileSync(dst, asset.content);
    }
}

function writeModelAssetManifest(optionalFiles: any, generatedAssets: any, config: any) {
    const settings = createPrepareConfig(config);
    const files = new Set<string>();
    for (const relativePath of Array.isArray(optionalFiles) ? optionalFiles : []) {
        files.add(normalizeRelativePath(relativePath));
    }
    for (const asset of Array.isArray(generatedAssets) ? generatedAssets : []) {
        files.add(normalizeRelativePath(asset.relativePath));
    }
    const payload = {
        schemaVersion: 'model_assets.v1',
        files: Array.from(files).filter(Boolean).sort()
    };
    const dst = path.join(settings.outDir, MODEL_ASSET_MANIFEST_PATH);
    ensureDir(path.dirname(dst));
    fs.writeFileSync(dst, JSON.stringify(payload, null, 2), 'utf8');
}

function copyDirectoryRecursive(srcDir: any, dstDir: any, relativePrefix: string = '') {
    if (!fs.existsSync(srcDir)) return;
    ensureDir(dstDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);
        const nextRelative = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
        if (entry.isDirectory()) {
            copyDirectoryRecursive(srcPath, dstPath, nextRelative);
        } else if (entry.isFile()) {
            if (!shouldMirrorRelativePath(nextRelative)) continue;
            ensureDir(path.dirname(dstPath));
            copyFileWithTransientRetry(srcPath, dstPath);
        }
    }
}

function listFilesRecursive(baseDir: string, relativePrefix: string): string[] {
    if (!fs.existsSync(baseDir)) return [];

    const out: string[] = [];
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        const nextRelative = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
        const nextFull = path.join(baseDir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listFilesRecursive(nextFull, nextRelative));
            continue;
        }
        if (entry.isFile()) {
            if (!shouldMirrorRelativePath(nextRelative)) continue;
            out.push(nextRelative);
        }
    }
    return out;
}

function listAllFilesRecursive(baseDir: string, relativePrefix: string): string[] {
    if (!fs.existsSync(baseDir)) return [];

    const out: string[] = [];
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        const nextRelative = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
        const nextFull = path.join(baseDir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listAllFilesRecursive(nextFull, nextRelative));
            continue;
        }
        if (entry.isFile()) {
            out.push(nextRelative);
        }
    }
    return out;
}

function isAssetManifestMetadataOnlyDrift(relativePath: string, srcBuf: Buffer, dstBuf: Buffer): boolean {
    if (normalizeRelativePath(relativePath) !== 'assets/asset-manifest.json') return false;
    try {
        const srcJson = JSON.parse(srcBuf.toString('utf8'));
        const dstJson = JSON.parse(dstBuf.toString('utf8'));
        if (srcJson && typeof srcJson === 'object') delete srcJson.generatedAt;
        if (dstJson && typeof dstJson === 'object') delete dstJson.generatedAt;
        if (srcJson && typeof srcJson === 'object') delete srcJson.version;
        if (dstJson && typeof dstJson === 'object') delete dstJson.version;
        return JSON.stringify(srcJson) === JSON.stringify(dstJson);
    } catch (_error) {
        void _error;
        return false;
    }
}

function verifyMirroredFile(relativePath: string, issues: string[], config: any) {
    const settings = createPrepareConfig(config);
    const src = path.join(settings.rootDir, relativePath);
    const dst = path.join(settings.outDir, relativePath);

    if (!fs.existsSync(src)) {
        issues.push(`source missing: ${relativePath}`);
        return;
    }
    if (!fs.existsSync(dst)) {
        issues.push(`worker-public missing: ${relativePath}`);
        return;
    }

    const srcStat = fs.statSync(src);
    const dstStat = fs.statSync(dst);
    const srcBuf = fs.readFileSync(src);
    const dstBuf = fs.readFileSync(dst);
    if (srcStat.size !== dstStat.size) {
        if (isAssetManifestMetadataOnlyDrift(relativePath, srcBuf, dstBuf)) return;
        issues.push(`size mismatch: ${relativePath}`);
        return;
    }

    if (!srcBuf.equals(dstBuf)) {
        if (isAssetManifestMetadataOnlyDrift(relativePath, srcBuf, dstBuf)) return;
        issues.push(`content mismatch: ${relativePath}`);
    }
}

function verifyMirrors(
    optionalFiles: any,
    generatedAssets: any,
    config: any,
    options?: { rejectExtraFiles?: boolean }
) {
    const settings = createPrepareConfig(config);
    const issues: string[] = [];
    const verifyFiles = new Set<string>();
    const optionals = Array.isArray(optionalFiles) ? optionalFiles : [];
    const generated = Array.isArray(generatedAssets) ? generatedAssets : [];

    settings.verifyRootFiles.forEach((one: any) => verifyFiles.add(one));
    optionals.forEach((one: any) => verifyFiles.add(one));

    for (const dir of settings.verifyDirs) {
        const srcDir = path.join(settings.rootDir, dir);
        const files = listFilesRecursive(srcDir, dir);
        for (const relativePath of files) {
            verifyFiles.add(relativePath);
        }
    }

    const sorted = Array.from(verifyFiles).sort();
    for (const relativePath of sorted) {
        verifyMirroredFile(relativePath, issues, settings);
    }

    for (const asset of generated) {
        const dst = path.join(settings.outDir, asset.relativePath);
        if (!fs.existsSync(dst)) {
            issues.push(`generated missing: ${asset.relativePath}`);
            continue;
        }
        const dstBuf = fs.readFileSync(dst);
        if (!dstBuf.equals(asset.content)) {
            issues.push(`generated content mismatch: ${asset.relativePath}`);
        }
    }

    if (options && options.rejectExtraFiles) {
        const expectedFiles = new Set<string>(
            Array.from(verifyFiles).map((relativePath) => normalizeRelativePath(relativePath))
        );
        generated.forEach((asset: any) => expectedFiles.add(normalizeRelativePath(asset.relativePath)));
        expectedFiles.add(MODEL_ASSET_MANIFEST_PATH);

        const actualFiles = listAllFilesRecursive(settings.outDir, '');
        for (const relativePath of actualFiles) {
            const normalized = normalizeRelativePath(relativePath);
            if (!expectedFiles.has(normalized)) {
                issues.push(`unexpected mirror file: ${normalized}`);
            }
        }
    }

    if (issues.length > 0) {
        const preview = issues.slice(0, 8).join('; ');
        throw new Error(`[worker-prepare] mirror verification failed (${issues.length}): ${preview}`);
    }

    console.log(`[worker-prepare] mirror-verified files=${sorted.length}`);
}

function prepareWorkerAssets(options?: PrepareWorkerAssetsOptions) {
    const settings = createPrepareConfig(options);
    refreshGeneratedCatalogArtifacts(settings);
    if (settings.cleanOutDir) {
        rmDirSafe(settings.outDir);
    }
    ensureDir(settings.outDir);
    const copyableOptionalFiles = resolveCopyableOptionalFiles(settings);
    const generatedOptionalAssets = resolveGeneratedOptionalAssets(settings);

    settings.rootFiles.forEach((relativePath: any) => copyFileByRelative(relativePath, settings));

    for (const dir of settings.dirs) {
        const srcDir = path.join(settings.rootDir, dir);
        const dstDir = path.join(settings.outDir, dir);
        copyDirectoryRecursive(srcDir, dstDir, dir);
    }

    copyableOptionalFiles.forEach((relativePath: any) => copyFileByRelative(relativePath, settings));
    writeGeneratedOptionalAssets(generatedOptionalAssets, settings);
    writeModelAssetManifest(copyableOptionalFiles, generatedOptionalAssets, settings);
    copyFileByRelative(path.join('assets', 'asset-manifest.json'), settings);

    verifyMirrors(copyableOptionalFiles, generatedOptionalAssets, settings);

    console.log(`[worker-prepare] output=${settings.outDir}`);
    return settings;
}

function refreshGeneratedCatalogArtifacts(settings: any) {
    const rootDir = settings && settings.rootDir ? settings.rootDir : ROOT;
    buildRegistry({ rootDir });
    const assetsDir = path.join(rootDir, 'assets');
    if (fs.existsSync(assetsDir)) {
        generateManifest({ root: rootDir });
    }

    const gachaDir = path.join(rootDir, 'assets', 'images', 'Gacha');
    const sharedDir = path.join(rootDir, 'shared');
    if (fs.existsSync(gachaDir) && fs.existsSync(sharedDir)) {
        generateObservationGachaCatalogs({ root: rootDir });
    }
}

if (require.main === module) {
    prepareWorkerAssets();
}

export = {
    ROOT_FILES,
    DIRS,
    VERIFY_DIRS,
    VERIFY_ROOT_FILES,
    OPTIONAL_FILES,
    GENERATED_OPTIONAL_ASSETS,
    createPrepareConfig,
    refreshGeneratedCatalogArtifacts,
    prepareWorkerAssets,
    verifyMirrors,
    verifyMirroredFile,
    listFilesRecursive,
    listAllFilesRecursive,
    resolveCopyableOptionalFiles,
    resolveGeneratedOptionalAssets,
    shouldMirrorRelativePath,
    copyFileWithTransientRetry
};
