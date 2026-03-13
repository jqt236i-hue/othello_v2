const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'worker-public');
const WORKER_ASSET_MAX_BYTES = 25 * 1024 * 1024;

const ROOT_FILES = [
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
];

const DIRS = [
    'assets',
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils'
];

const VERIFY_DIRS = [
    'cards',
    'constants',
    'game',
    'shared',
    'ui',
    'utils'
];

const VERIFY_ROOT_FILES = ROOT_FILES.filter((one) => one !== 'index.html');

const OPTIONAL_FILES = [
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
];

const GENERATED_OPTIONAL_ASSETS = [
    {
        sourceRelativePath: 'data/models/policy-table.json',
        manifestRelativePath: 'data/models/policy-table.json',
        compressedRelativePath: 'data/models/policy-table.json.gz',
        compression: 'gzip'
    }
];

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

function copyFileByRelative(relativePath) {
    const src = path.join(ROOT, relativePath);
    if (!fs.existsSync(src)) return;
    const dst = path.join(OUT_DIR, relativePath);
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
}

function resolveCopyableOptionalFiles() {
    const out = [];
    for (const relativePath of OPTIONAL_FILES) {
        const src = path.join(ROOT, relativePath);
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

function resolveGeneratedOptionalAssets() {
    const out = [];
    for (const task of GENERATED_OPTIONAL_ASSETS) {
        const src = path.join(ROOT, task.sourceRelativePath);
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

function writeGeneratedOptionalAssets(generatedAssets) {
    for (const asset of Array.isArray(generatedAssets) ? generatedAssets : []) {
        const dst = path.join(OUT_DIR, asset.relativePath);
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

function verifyMirroredFile(relativePath, issues) {
    const src = path.join(ROOT, relativePath);
    const dst = path.join(OUT_DIR, relativePath);

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

function verifyMirrors(optionalFiles, generatedAssets) {
    const issues = [];
    const verifyFiles = new Set();
    const optionals = Array.isArray(optionalFiles) ? optionalFiles : [];
    const generated = Array.isArray(generatedAssets) ? generatedAssets : [];

    VERIFY_ROOT_FILES.forEach((one) => verifyFiles.add(one));
    optionals.forEach((one) => verifyFiles.add(one));

    for (const dir of VERIFY_DIRS) {
        const srcDir = path.join(ROOT, dir);
        const files = listFilesRecursive(srcDir, dir);
        for (const relativePath of files) {
            verifyFiles.add(relativePath);
        }
    }

    const sorted = Array.from(verifyFiles).sort();
    for (const relativePath of sorted) {
        verifyMirroredFile(relativePath, issues);
    }

    for (const asset of generated) {
        const dst = path.join(OUT_DIR, asset.relativePath);
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

function main() {
    rmDirSafe(OUT_DIR);
    ensureDir(OUT_DIR);
    const copyableOptionalFiles = resolveCopyableOptionalFiles();
    const generatedOptionalAssets = resolveGeneratedOptionalAssets();

    ROOT_FILES.forEach(copyFileByRelative);

    for (const dir of DIRS) {
        const srcDir = path.join(ROOT, dir);
        const dstDir = path.join(OUT_DIR, dir);
        copyDirectoryRecursive(srcDir, dstDir);
    }

    copyableOptionalFiles.forEach(copyFileByRelative);
    writeGeneratedOptionalAssets(generatedOptionalAssets);

    verifyMirrors(copyableOptionalFiles, generatedOptionalAssets);

    console.log(`[worker-prepare] output=${OUT_DIR}`);
}

main();
