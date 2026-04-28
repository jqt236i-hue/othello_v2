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

function collectFiles(rootDir: string, relDir: string): string[] {
    const results: string[] = [];
    const dir = path.join(rootDir, relDir);
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.join(relDir, e.name).replace(/\\/g, '/');
        if (e.isDirectory()) {
            results.push(...collectFiles(rootDir, rel));
        } else {
            results.push(rel);
        }
    }
    return results;
}

function writeManifestFile(outPath: string, payload: string) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tempPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, payload, 'utf8');
    try { fs.rmSync(outPath, { force: true }); } catch (e) { /* ignore */ }
    fs.renameSync(tempPath, outPath);
}

function generateManifest(options: GenerateManifestOptions = {}): GenerateManifestResult {
    const projectRoot = options.root || path.resolve(__dirname, '..');
    const assetsRoot = path.join(projectRoot, 'assets');
    const assetDirs = [
        'images/stones',
        'images/other',
        'images/background',
        'images/background-skin',
        'images/hand-skin',
        'images/Gacha'
    ];

    const files = assetDirs
        .flatMap((relDir) => collectFiles(assetsRoot, relDir))
        .map(p => ({ path: `assets/${p}`, sha256: hashFile(path.join(assetsRoot, p)) }));

    const manifest: Manifest = {
        version: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        files
    };

    const outPath = path.join(projectRoot, 'assets', 'asset-manifest.json');
    const payload = JSON.stringify(manifest, null, 2);
    const shouldWrite = options.write !== false && options.persist !== false;
    if (shouldWrite) {
        writeManifestFile(outPath, payload);
    }
    return { manifest, outPath, wroteFile: shouldWrite };
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
