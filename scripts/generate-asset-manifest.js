const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hashFile(filePath) {
    const data = fs.readFileSync(filePath);
    const h = crypto.createHash('sha256');
    h.update(data);
    return h.digest('hex');
}

function collectFiles(rootDir, relDir) {
    const results = [];
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

function generateManifest(options = {}) {
    const projectRoot = options.root || path.resolve(__dirname, '..');
    const assetsRoot = path.join(projectRoot, 'assets');
    const stonesDir = 'images/stones';

    const files = collectFiles(assetsRoot, stonesDir).map(p => ({ path: `assets/${p}`, sha256: hashFile(path.join(assetsRoot, p)) }));

    const manifest = {
        version: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        files
    };

    const outPath = path.join(projectRoot, 'assets', 'asset-manifest.json');
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');
    return { manifest, outPath };
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

module.exports = { generateManifest };
