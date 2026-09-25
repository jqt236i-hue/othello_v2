import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface ManifestFile {
    path: string;
    sha256: string;
}

interface Manifest {
    version: string;
    generatedAt: string;
    files: ManifestFile[];
}

interface GenerateManifestResult {
    manifest: Manifest;
    outPath: string;
    wroteFile: boolean;
}

interface GenerateManifestOptions {
    root?: string;
    write?: boolean;
    persist?: boolean;
}

function hashFile(filePath: string): string {
    const data = fs.readFileSync(filePath);
    const h = crypto.createHash('sha256');
    h.update(data);
    return h.digest('hex');
}

// Authoring-only Blender work directories (models, renders, verification frames)
// live next to the deployable reference sheets but are not game assets.
const EXCLUDED_DIRECTORY_NAME_PATTERN = /^blender_model/;

function collectFiles(rootDir: string, relDir: string): string[] {
    const results: string[] = [];
    const dir = path.join(rootDir, relDir);
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.join(relDir, e.name).replace(/\\/g, '/');
        if (e.isDirectory()) {
            if (EXCLUDED_DIRECTORY_NAME_PATTERN.test(e.name)) continue;
            results.push(...collectFiles(rootDir, rel));
        } else {
            results.push(rel);
        }
    }
    return results;
}

function writeManifestFile(outPath: string, payload: string) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    if (fs.existsSync(outPath)) {
        const current = fs.readFileSync(outPath, 'utf8');
        if (current === payload) return false;
    }
    const tempPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, payload, 'utf8');
    try { fs.rmSync(outPath, { force: true }); } catch (e) { /* ignore */ }
    fs.renameSync(tempPath, outPath);
    return true;
}

function readExistingManifest(outPath: string): Manifest | null {
    if (!fs.existsSync(outPath)) return null;
    try {
        const parsed = JSON.parse(fs.readFileSync(outPath, 'utf8'));
        if (!parsed || !Array.isArray(parsed.files)) return null;
        return parsed as Manifest;
    } catch (e) {
        return null;
    }
}

function sameManifestFiles(a: ManifestFile[], b: ManifestFile[]): boolean {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (!a[i] || !b[i]) return false;
        if (a[i].path !== b[i].path || a[i].sha256 !== b[i].sha256) return false;
    }
    return true;
}

function generateManifest(options: GenerateManifestOptions = {}): GenerateManifestResult {
    const projectRoot = options.root || path.resolve(__dirname, '..');
    const assetsRoot = path.join(projectRoot, 'assets');
    const assetDirs = [
        'images/special-stones',
        'images/stone-skin',
        'images/other',
        'images/special-cards',
        'images/background',
        'images/background-skin',
        'images/hand-skin',
        'images/Gacha',
        'audio/sound-effect',
        'audio/bgm/manifest-stones'
    ];

    const files = assetDirs
        .flatMap((relDir) => collectFiles(assetsRoot, relDir))
        .map(p => ({ path: `assets/${p}`, sha256: hashFile(path.join(assetsRoot, p)) }));

    const outPath = path.join(projectRoot, 'assets', 'asset-manifest.json');
    const existing = readExistingManifest(outPath);
    const filesUnchanged = !!existing && sameManifestFiles(existing.files, files);
    const now = new Date().toISOString();
    const manifest: Manifest = {
        version: filesUnchanged && existing && existing.version ? existing.version : now.slice(0, 10),
        generatedAt: filesUnchanged && existing && existing.generatedAt ? existing.generatedAt : now,
        files
    };
    const payload = JSON.stringify(manifest, null, 2);
    const shouldWrite = options.write !== false && options.persist !== false;
    let wroteFile = false;
    if (shouldWrite) {
        wroteFile = writeManifestFile(outPath, payload);
    }
    return { manifest, outPath, wroteFile };
}

if (require.main === module) {
    try {
        const res = generateManifest();
        console.log('[asset-manifest] generated', res.outPath);
        process.exit(0);
    } catch (e) {
        console.error('[asset-manifest] failed', e);
        process.exit(2);
    }
}

export = {  generateManifest  } as any;
