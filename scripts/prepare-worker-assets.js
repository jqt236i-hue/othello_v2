const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { generateManifest } = require('./generate-asset-manifest');
const { generateObservationGachaCatalogs } = require('./generate-observation-gacha-catalog');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'worker-public');
const WORKER_ASSET_MAX_BYTES = 25 * 1024 * 1024;

const ROOT_FILES = Object.freeze([
    'index.html',
    'story-deck-lab.html',
    'is-env-capable.js',
    'shared-constants.js',
    'card-system.js',
    'game-events.js',
    'sound-engine.js',
    'ui.js',
    'styles-animations.css',
    'styles-base.css',
    'styles-board.css',
    'styles-cards.css',
    'styles-layout.css',
    'styles-responsive.css',
    'styles-story-deck-lab.css',
    'styles-stone-shadows.css',
    'styles-variables.css'
]);

const DIRS = Object.freeze([
    'assets',
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils'
]);

const VERIFY_DIRS = Object.freeze([
    'assets',
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils'
]);

const VERIFY_ROOT_FILES = Object.freeze(ROOT_FILES.slice());

const OPTIONAL_FILES = Object.freeze([
    'data/dialogue/fixed-commentary-data.js',
    'data/models/policy-net.onnx',
    'data/models/policy-net.onnx.meta.json',
    'data/models/policy-card.onnx',
    'data/models/policy-card.onnx.meta.json',
    'data/models/policy-target.onnx',
    'data/models/policy-target.onnx.meta.json',
    'data/models/policy-value.onnx',
    'data/models/policy-value.onnx.meta.json',
    'node_modules/onnxruntime-web/dist/ort.min.js',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs',
    'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm'
]);

const GENERATED_OPTIONAL_ASSETS = Object.freeze([
    {
        sourceRelativePath: 'data/models/policy-table.json',
        manifestRelativePath: 'data/models/policy-table.json',
        compressedRelativePath: 'data/models/policy-table.json.gz',
        compression: 'gzip'
    }
]);

function cloneList(list) {
    return Array.isArray(list) ? list.slice() : [];
}

function createPrepareConfig(options) {
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

function toMiBString(bytes) {
    return (Number(bytes) / (1024 * 1024)).toFixed(1);
}

function rmDirSafe(targetPath) {
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

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileByRelative(relativePath, config) {
    const settings = createPrepareConfig(config);
    const src = path.join(settings.rootDir, relativePath);
    if (!fs.existsSync(src)) return;
    const dst = path.join(settings.outDir, relativePath);
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
}

function resolveCopyableOptionalFiles(config) {
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

function buildCompressedAssetManifest(task, compressedBytes, sourceBytes) {
    return Buffer.from(JSON.stringify({
        assetType: 'policy_table.redirect.v1',
        compression: task.compression,
        url: task.compressedRelativePath.replace(/\\/g, '/'),
        sourceBytes,
        compressedBytes
    }), 'utf8');
}

function resolveGeneratedOptionalAssets(config) {
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

function writeGeneratedOptionalAssets(generatedAssets, config) {
    const settings = createPrepareConfig(config);
    for (const asset of Array.isArray(generatedAssets) ? generatedAssets : []) {
        const dst = path.join(settings.outDir, asset.relativePath);
        ensureDir(path.dirname(dst));
        fs.writeFileSync(dst, asset.content);
    }
}

function copyDirectoryRecursive(srcDir, dstDir) {
    if (!fs.existsSync(srcDir)) return;
    ensureDir(dstDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
            copyDirectoryRecursive(srcPath, dstPath);
        } else if (entry.isFile()) {
            ensureDir(path.dirname(dstPath));
            fs.copyFileSync(srcPath, dstPath);
        }
    }
}

function listFilesRecursive(baseDir, relativePrefix) {
    if (!fs.existsSync(baseDir)) return [];

    const out = [];
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        const nextRelative = relativePrefix ? path.join(relativePrefix, entry.name) : entry.name;
        const nextFull = path.join(baseDir, entry.name);
        if (entry.isDirectory()) {
            out.push(...listFilesRecursive(nextFull, nextRelative));
            continue;
        }
        if (entry.isFile()) {
            out.push(nextRelative);
        }
    }
    return out;
}

function verifyMirroredFile(relativePath, issues, config) {
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

function verifyMirrors(optionalFiles, generatedAssets, config) {
    const settings = createPrepareConfig(config);
    const issues = [];
    const verifyFiles = new Set();
    const optionals = Array.isArray(optionalFiles) ? optionalFiles : [];
    const generated = Array.isArray(generatedAssets) ? generatedAssets : [];

    settings.verifyRootFiles.forEach((one) => verifyFiles.add(one));
    optionals.forEach((one) => verifyFiles.add(one));

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

function prepareWorkerAssets(options) {
    const settings = createPrepareConfig(options);
    refreshGeneratedCatalogArtifacts(settings);
    rmDirSafe(settings.outDir);
    ensureDir(settings.outDir);
    const copyableOptionalFiles = resolveCopyableOptionalFiles(settings);
    const generatedOptionalAssets = resolveGeneratedOptionalAssets(settings);

    settings.rootFiles.forEach((relativePath) => copyFileByRelative(relativePath, settings));

    for (const dir of settings.dirs) {
        const srcDir = path.join(settings.rootDir, dir);
        const dstDir = path.join(settings.outDir, dir);
        copyDirectoryRecursive(srcDir, dstDir);
    }

    copyableOptionalFiles.forEach((relativePath) => copyFileByRelative(relativePath, settings));
    writeGeneratedOptionalAssets(generatedOptionalAssets, settings);

    verifyMirrors(copyableOptionalFiles, generatedOptionalAssets, settings);

    console.log(`[worker-prepare] output=${settings.outDir}`);
    return settings;
}

function refreshGeneratedCatalogArtifacts(settings) {
    const rootDir = settings && settings.rootDir ? settings.rootDir : ROOT;
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

module.exports = {
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
    listFilesRecursive
};
