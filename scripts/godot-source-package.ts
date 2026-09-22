import fs = require('fs');
import path = require('path');
import cp = require('child_process');
import { buildAssetInventory, forbiddenAsset, listFiles, mediaPattern, sha256 } from './godot-source/assets';
import { collectDependencyNotices } from './build-battle-package';
import generateAssetManifest from './generate-asset-manifest';

const MANIFEST = 'SOURCE-MANIFEST.json';
const MODEL_MANIFEST = 'data/models/model-assets.json';
const SOURCE_DIRS = new Set(['browser-vite', 'cards', 'constants', 'cpu', 'docs', 'examples', 'game', 'othello-ai', 'public', 'scripts', 'shared', 'src',
    'test', 'tests', 'training', 'ui', 'utils', 'workers', '正本', '.github']);
const textOrSource = /\.(?:[cm]?[jt]sx?|json|jsonc|css|html|md|txt|ya?ml|py|ps1|sh|toml|ttf)$/i;

export interface OverlayFile { path: string; sha256?: string; fromFile?: string; }
export interface SourcePackageOptions { root?: string; ref: string; out: string; modelsFrom: string; overlayFiles?: (string | OverlayFile)[]; }
export function safeRelative(value: string): string {
    if (!value || value.includes('\\') || value.includes('\n') || value.includes('\r') || path.posix.isAbsolute(value)
        || value.split('/').some(segment => segment === '..' || segment === '.' || segment === '') || /^[A-Za-z]:/.test(value)) {
        throw new Error(`Unsafe collection path: ${value}`);
    }
    return value;
}

export function isSourcePath(relative: string): boolean {
    safeRelative(relative);
    if (/(?:^|\/)(?:\.env(?:\.[^/]*)?|credentials[^/]*|secrets?[^/]*|__pycache__|node_modules|\.git|output|artifacts|coverage)(?:\/|$)/i.test(relative)
        || /\.(?:pem|key|pfx|p12|log|jsonl|bak|blend|psd|kra)$/i.test(relative)) return false;
    if (relative.startsWith('assets/')) return /^assets\/(?:images|audio|fonts)\//.test(relative)
        && !forbiddenAsset.test(relative) && (mediaPattern.test(relative) || /(?:OFL\.txt|font-build-manifest\.json)$/.test(relative));
    if (!relative.includes('/')) return textOrSource.test(relative) || ['.gitignore', '.gitattributes', '.assetsignore', '.wranglerignore', '.node-version', 'LICENSE'].includes(relative);
    if (!SOURCE_DIRS.has(relative.split('/')[0])) return false;
    if (/^docs\/archive\//.test(relative)) return false;
    if (/^training\/(?:runs|data|models|output|artifacts)\//.test(relative)) return false;
    return textOrSource.test(relative);
}

const git = (root: string, args: string[]): string => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
function write(root: string, relative: string, value: Buffer | string): void {
    safeRelative(relative);
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), value);
}
function json(root: string, relative: string, value: any): void { write(root, relative, JSON.stringify(value, null, 2) + '\n'); }

/** Git's batch reader exports the selected commit bytes, independent of index, working tree, LFS smudge, or file mode. */
function exportCommitFiles(root: string, ref: string, files: string[], out: string): void {
    for (let start = 0; start < files.length; start += 128) {
        const chunk = files.slice(start, start + 128);
        const buffer = cp.execFileSync('git', ['cat-file', '--batch'], { cwd: root,
            input: chunk.map(file => `${ref}:${file}\n`).join(''), maxBuffer: 512 * 1024 * 1024 });
        let offset = 0;
        for (const relative of chunk) {
            const end = buffer.indexOf(10, offset);
            const header = buffer.subarray(offset, end).toString('utf8');
            const match = /^[0-9a-f]+ blob (\d+)$/.exec(header);
            if (!match) throw new Error(`Unable to export regular Git blob ${relative}: ${header}`);
            const bytes = Number(match[1]); offset = end + 1;
            const data = buffer.subarray(offset, offset + bytes);
            if (data.subarray(0, 43).toString().startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error(`Unresolved Git LFS pointer: ${relative}`);
            write(out, relative, data); offset += bytes + 1;
        }
    }
}

export function collectModels(modelRoot: string, destination: string): { path: string; sha256: string; bytes: number }[] {
    const source = path.resolve(modelRoot);
    if (!fs.existsSync(path.join(source, MODEL_MANIFEST))) throw new Error(`Missing runtime model manifest: ${MODEL_MANIFEST} (explicit --models-from required)`);
    const manifest = JSON.parse(fs.readFileSync(path.join(source, MODEL_MANIFEST), 'utf8'));
    if (manifest.schemaVersion !== 'model_assets.v1' || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid or empty runtime model manifest');
    const rows = [];
    for (const relative of [...new Set<string>([MODEL_MANIFEST, ...manifest.files])].sort()) {
        safeRelative(relative);
        if (!relative.startsWith('data/models/') || /(?:^|\/)(?:logs?|runs?|secret[^/]*|credentials[^/]*)(?:\/|$)/i.test(relative)
            || !/\.(?:json|onnx(?:\.gz|\.chunk\.\d+)?)$/.test(relative)) throw new Error(`Invalid runtime model path: ${relative}`);
        if (!fs.existsSync(path.join(source, relative)) || !fs.lstatSync(path.join(source, relative)).isFile()) throw new Error(`Missing required regular runtime model: ${relative}`);
        const data = fs.readFileSync(path.join(source, relative));
        write(destination, relative, data);
        rows.push({ path: relative, bytes: data.length, sha256: sha256(data) });
    }
    // Every ONNX needs its training/feature metadata. Do not relabel fallback-only packages as inference-ready.
    for (const relative of manifest.files as string[]) if (relative.endsWith('.onnx') && !manifest.files.includes(relative + '.meta.json')) {
        throw new Error(`Missing ONNX metadata in runtime manifest: ${relative}.meta.json`);
    }
    return rows;
}

export async function createGodotSourcePackage(options: SourcePackageOptions): Promise<any> {
    const root = path.resolve(options.root || process.cwd());
    if (!options.ref) throw new Error('Explicit adopted --ref is required; working-tree adoption is never implicit');
    const ref = git(root, ['rev-parse', '--verify', `${options.ref}^{commit}`]).trim();
    const out = path.resolve(root, options.out);
    if (!out.startsWith(path.join(root, 'output') + path.sep)) throw new Error('Collection output must be a new child of repository output/');
    if (fs.existsSync(out)) throw new Error(`Output already exists; use a new collection directory: ${out}`);
    const tree = git(root, ['ls-tree', '-r', '-z', ref]).split('\0').filter(Boolean).map(row => {
        const separator = row.indexOf('\t');
        const [mode, type] = row.slice(0, separator).split(' ');
        return { mode, type, path: row.slice(separator + 1) };
    });
    const selectedRows = tree.filter(row => isSourcePath(row.path));
    for (const row of selectedRows) if (row.type !== 'blob' || !/^100(?:644|755)$/.test(row.mode)) throw new Error(`Not a regular Git source file: ${row.path}`);
    const selected = selectedRows.map(row => row.path);
    const overlays = (options.overlayFiles || []).map(row => typeof row === 'string' ? { path: row } : row);
    const adoptedOverlays = [];
    for (const overlay of overlays) {
        if (!isSourcePath(overlay.path)) throw new Error(`Overlay path outside permitted source set: ${overlay.path}`);
        const sourceFile = overlay.fromFile ? path.resolve(root, overlay.fromFile) : path.join(root, overlay.path);
        const stat = fs.lstatSync(sourceFile);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Overlay must be a regular file: ${overlay.path}`);
        const actualHash = sha256(fs.readFileSync(sourceFile));
        if (overlay.sha256 && actualHash !== overlay.sha256) throw new Error(`Overlay changed since selection: ${overlay.path}`);
        adoptedOverlays.push({ path: overlay.path, sha256: actualHash, ...(overlay.fromFile ? { fromFile: overlay.fromFile } : {}) });
    }
    const snapshotRoot = path.join(out, 'source');
    fs.mkdirSync(snapshotRoot, { recursive: true });
    json(out, 'INCOMPLETE.json', { phase: 'exporting', sourceCommit: ref });
    exportCommitFiles(root, ref, selected, snapshotRoot);
    for (const overlay of adoptedOverlays) {
        const data = fs.readFileSync(overlay.fromFile ? path.resolve(root, overlay.fromFile) : path.join(root, overlay.path));
        if (sha256(data) !== overlay.sha256) throw new Error(`Overlay changed during collection: ${overlay.path}`);
        write(snapshotRoot, overlay.path, data);
    }
    const models = collectModels(options.modelsFrom, snapshotRoot);
    // Rebuild the existing runtime index from the preserved runtime-format assets; an old index can name excluded archives.
    const generatedManifest = generateAssetManifest.generateManifest({ root: snapshotRoot, write: false }).manifest;
    const sourceDate = git(root, ['show', '-s', '--format=%cI', ref]).trim();
    generatedManifest.generatedAt = sourceDate;
    generatedManifest.version = sourceDate.slice(0, 10);
    json(snapshotRoot, 'assets/asset-manifest.json', generatedManifest);
    const inventory = await buildAssetInventory(snapshotRoot);
    const runtimePaths = new Set<string>(inventory.files.map((file: any) => file.path));
    generatedManifest.files = generatedManifest.files.filter((file: any) => runtimePaths.has(file.path));
    json(snapshotRoot, 'assets/asset-manifest.json', generatedManifest);
    json(out, 'ASSET-INVENTORY.json', inventory);
    // Source preservation includes unreferenced runtime-format originals. The actual transfer directory includes only references.
    for (const asset of inventory.files) write(out, `runtime-assets/${asset.path}`, fs.readFileSync(path.join(snapshotRoot, asset.path)));
    for (const relative of ['assets/fonts/OFL.txt', 'assets/fonts/font-build-manifest.json', 'docs/asset-provenance.md']) {
        if (!fs.existsSync(path.join(snapshotRoot, relative))) throw new Error(`Required provenance/license document missing: ${relative}`);
        write(out, `licenses/${path.basename(relative)}`, fs.readFileSync(path.join(snapshotRoot, relative)));
    }
    write(out, 'licenses/THIRD-PARTY-NOTICES.txt', collectDependencyNotices(root, snapshotRoot));
    const packageMetadata = JSON.parse(fs.readFileSync(path.join(snapshotRoot, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(snapshotRoot, 'package-lock.json'), 'utf8'));
    const sourceFiles = listFiles(snapshotRoot);
    const sourceMetadata = { schemaVersion: 1, sourceCommit: ref, sourceDirty: adoptedOverlays.length > 0,
        trackedFiles: sourceFiles, runtimeAssets: [...inventory.files.map((file: any) => file.path), 'assets/fonts/OFL.txt', 'assets/fonts/font-build-manifest.json'],
        adoptedOverlays, modelOrigin: 'explicit external runtime model manifest, not asserted to belong to the Git commit' };
    json(snapshotRoot, '.godot-source.json', sourceMetadata);
    const manifest: any = { schemaVersion: 1, status: 'complete', sourceCommit: ref, adoptedOverlays,
        excludedWorkingTreeChanges: git(root, ['status', '--porcelain=v1', '-uall']).split('\n').filter(Boolean),
        adoptionPolicy: 'Only the named commit and listed whole-file overlays are adopted. Other working-tree edits, CPU Lv13 experiments, perf outputs, production reference material and training logs are not adopted.',
        externalModels: models, modelOrigin: sourceMetadata.modelOrigin,
        environment: { node: process.version, platform: process.platform, arch: process.arch,
            npm: process.env.npm_config_user_agent || 'use package-lock.json with npm ci', lockfileVersion: lock.lockfileVersion },
        dependencies: packageMetadata.dependencies, devDependencies: packageMetadata.devDependencies,
        generatedSourceFiles: { 'assets/asset-manifest.json': 'existing generate-asset-manifest implementation over selected originals; timestamp anchored to adopted commit time' },
        regeneration: ['cd source', 'npm ci', 'npm run build:vite', 'node dist/scripts/build-battle-package.js'],
        outputIdentity: 'This SOURCE-MANIFEST.json identifies the adopted porting source; output/battle-package elsewhere is not adopted automatically.',
        exclusions: ['.git', 'environment secrets', 'worker-public mirror', 'dist/vite-dist generated bundles', 'unrelated data/logs/runs', 'asset _reference/archive/blender/PSD/BLEND/BAK material'],
        assetInventory: 'ASSET-INVENTORY.json', files: {} };
    for (const relative of listFiles(out).filter(file => file !== 'INCOMPLETE.json' && file !== MANIFEST)) {
        const data = fs.readFileSync(path.join(out, relative));
        manifest.files[relative] = { sha256: sha256(data), bytes: data.length };
    }
    json(out, MANIFEST, manifest);
    fs.unlinkSync(path.join(out, 'INCOMPLETE.json'));
    return { out, sourceCommit: ref, files: Object.keys(manifest.files).length, assets: inventory.files.length, models: models.length };
}

export function verifyGodotSourcePackage(out: string): { ok: boolean; checked: number; issues: string[] } {
    const directory = path.resolve(out);
    if (fs.existsSync(path.join(directory, 'INCOMPLETE.json'))) throw new Error('Source collection did not finish; INCOMPLETE.json is present');
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, MANIFEST), 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.status !== 'complete' || !manifest.files || typeof manifest.files !== 'object') throw new Error('Invalid source manifest');
    const issues = [];
    for (const [relative, expected] of Object.entries(manifest.files) as [string, any][]) {
        safeRelative(relative);
        const absolute = path.join(directory, relative);
        if (!fs.existsSync(absolute)) { issues.push(`missing: ${relative}`); continue; }
        if (!fs.lstatSync(absolute).isFile()) { issues.push(`not a regular file: ${relative}`); continue; }
        const data = fs.readFileSync(absolute);
        if (data.length !== expected.bytes || sha256(data) !== expected.sha256) issues.push(`hash mismatch: ${relative}`);
    }
    for (const relative of listFiles(directory)) if (relative !== MANIFEST && !(relative in manifest.files)) issues.push(`unexpected: ${relative}`);
    return { ok: issues.length === 0, checked: Object.keys(manifest.files).length, issues };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
    const mode = args.shift();
    const options: Record<string, string> = {};
    while (args.length) {
        const key = args.shift()!;
        if (!['--ref', '--out', '--models-from', '--overlay-files'].includes(key) || !args.length) throw new Error(`Unknown or missing option: ${key}`);
        options[key] = args.shift()!;
    }
    if (!options['--out']) throw new Error('--out is required');
    if (mode === 'verify') {
        const result = verifyGodotSourcePackage(options['--out']);
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) process.exitCode = 1;
    } else if (mode === 'export') {
        if (!options['--ref'] || !options['--models-from']) throw new Error('export requires explicit --ref and --models-from');
        const overlayFiles = options['--overlay-files'] ? JSON.parse(fs.readFileSync(options['--overlay-files'], 'utf8')) : [];
        if (!Array.isArray(overlayFiles)) throw new Error('--overlay-files must contain a JSON array');
        console.log(JSON.stringify(await createGodotSourcePackage({ ref: options['--ref'], out: options['--out'], modelsFrom: options['--models-from'], overlayFiles }), null, 2));
    } else throw new Error('Usage: godot-source-package.js export --ref COMMIT --models-from ROOT --out output/NEW [--overlay-files JSON] | verify --out DIRECTORY');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
