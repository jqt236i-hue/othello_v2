"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function hashFile(filePath) {
    const data = fs.readFileSync(filePath);
    const h = crypto.createHash('sha256');
    h.update(data);
    return h.digest('hex');
}
function collectFiles(rootDir, relDir) {
    const results = [];
    const dir = path.join(rootDir, relDir);
    if (!fs.existsSync(dir))
        return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.join(relDir, e.name).replace(/\\/g, '/');
        if (e.isDirectory()) {
            results.push(...collectFiles(rootDir, rel));
        }
        else {
            results.push(rel);
        }
    }
    return results;
}
function writeManifestFile(outPath, payload) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tempPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, payload, 'utf8');
    try {
        fs.rmSync(outPath, { force: true });
    }
    catch (e) { /* ignore */ }
    fs.renameSync(tempPath, outPath);
}
function generateManifest(options = {}) {
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
    const manifest = {
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
    }
    catch (e) {
        console.error('[asset-manifest] failed', e);
        process.exit(2);
    }
}
module.exports = { generateManifest };
//# sourceMappingURL=generate-asset-manifest.js.map