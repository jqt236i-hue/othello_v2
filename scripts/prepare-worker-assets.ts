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
}

interface GeneratedOptionalAssetTask {
    sourceRelativePath: string;
    compressedRelativePath: string;
    manifestRelativePath: string;
    compression: string;
}

interface GeneratedOptionalAsset {
    relativePath: string;
    content: Buffer;
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

const ROOT_FILES: readonly string[] = Object.freeze([
    '.assetsignore',
    'index.html',
    'entry-browser.js',
    'shared-constants.js',
    'styles-animations.css',
    'styles-base.css',
    'styles-board.css',
    'styles-cards.css',
    'styles-layout.css',
    'styles-responsive.css',
    'styles-stone-shadows.css',
    'styles-variables.css',
    'public/runtime.js',
    'public/module-registry.js'
]);

const DIRS: readonly string[] = Object.freeze([
    'assets',
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils'
]);

const VERIFY_DIRS: readonly string[] = Object.freeze([
    'assets',
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils'
]);

const VERIFY_ROOT_FILES: readonly string[] = Object.freeze(ROOT_FILES.slice());

const OPTIONAL_FILES: readonly string[] = Object.freeze([
    'game/ai/commentary-data.js',
    'data/models/policy-net.onnx',
    'data/models/policy-net.onnx.meta.json',
    'data/models/policy-card.onnx',
    'data/models/policy-card.onnx.meta.json',
    'data/models/policy-target.onnx',
    'data/models/policy-target.onnx.meta.json',
    'data/models/policy-value.onnx',
    'data/models/policy-value.onnx.meta.json',
    'data/models/policy-table.json',
    'data/models/othello/policy-table.json',
    'data/models/othello/value-table.json',
    'story/ui/story.css',
    'node_modules/onnxruntime-web/dist/ort.min.js',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'
]);

const GENERATED_OPTIONAL_ASSETS: readonly GeneratedOptionalAssetTask[] = Object.freeze([]);

const EXCLUDED_MIRROR_RELATIVE_PATHS = new Set([
    'game/logic/card-usage-prechecks.js',
    'game/logic/charge-ledger.js',
    'game/logic/module-resolver.js',
    'game/logic/presentation-helpers.js',
    'game/logic/random-source.js'
]);

function normalizeRelativePath(relativePath: string) {
    return String(relativePath || '').split(path.sep).join('/');
}

function shouldMirrorRelativePath(relativePath: string) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) return false;
    if (EXCLUDED_MIRROR_RELATIVE_PATHS.has(normalized)) return false;

    const baseName = path.posix.basename(normalized);
    if (baseName === 'AGENTS.md') return false;
    if (baseName.includes('.tmp-')) return false;

    if (/\.(ts|tsx|d\.ts)$/i.test(baseName)) return false;
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
        generatedOptionalAssets: cloneList(opts.generatedOptionalAssets || GENERATED_OPTIONAL_ASSETS)
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
    fs.copyFileSync(src, dst);
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
            fs.copyFileSync(srcPath, dstPath);
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
    if (srcStat.size !== dstStat.size) {
        issues.push(`size mismatch: ${relativePath}`);
        return;
    }

    const srcBuf = fs.readFileSync(src);
    const dstBuf = fs.readFileSync(dst);
    if (!srcBuf.equals(dstBuf)) {
        issues.push(`content mismatch: ${relativePath}`);
    }
}

function verifyMirrors(optionalFiles: any, generatedAssets: any, config: any) {
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

    if (issues.length > 0) {
        const preview = issues.slice(0, 8).join('; ');
        throw new Error(`[worker-prepare] mirror verification failed (${issues.length}): ${preview}`);
    }

    console.log(`[worker-prepare] mirror-verified files=${sorted.length}`);
}

function prepareWorkerAssets(options?: PrepareWorkerAssetsOptions) {
    const settings = createPrepareConfig(options);
    refreshGeneratedCatalogArtifacts(settings);
    rmDirSafe(settings.outDir);
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
    shouldMirrorRelativePath
};
