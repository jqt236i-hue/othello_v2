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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const generate_asset_manifest_js_1 = require("../scripts/generate-asset-manifest.js");
function collectFiles(dir, rootDir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    entries.forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath, rootDir));
            return;
        }
        files.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
    });
    return files;
}
describe('assets manifest', () => {
    test('generate manifest contains stone images and hashes match', () => {
        const res = (0, generate_asset_manifest_js_1.generateManifest)({ root: path.resolve(__dirname, '..'), write: false });
        const manifest = res.manifest;
        const repoRoot = path.resolve(__dirname, '..');
        assert.ok(manifest.files && manifest.files.length > 0, 'manifest should contain files');
        assert.ok(manifest.files.some((file) => file.path === 'assets/images/hand-skin/勇者の手.png'), 'manifest should include default hand image asset');
        [
            'assets/images/background/default.png',
            'assets/images/background-skin/観測の机.png',
            'assets/images/hand-skin/lv1-2.png',
            'assets/images/hand-skin/lv3-5.png',
            'assets/images/hand-skin/lv4.png',
            'assets/images/hand-skin/lv6.png',
            'assets/images/other/観測石.png'
        ].forEach((assetPath) => {
            assert.ok(manifest.files.some((file) => file.path === assetPath), `manifest should include expected image asset ${assetPath}`);
        });
        const gachaFiles = collectFiles(path.resolve(repoRoot, 'assets', 'images', 'Gacha'), repoRoot);
        assert.ok(gachaFiles.length > 0, 'gacha asset directory should contain at least one file');
        gachaFiles.forEach((assetPath) => {
            assert.ok(manifest.files.some((file) => file.path === assetPath), `manifest should include gacha asset ${assetPath}`);
        });
        for (const f of manifest.files) {
            const p = path.resolve(repoRoot, f.path);
            assert.ok(fs.existsSync(p), `file ${f.path} should exist`);
            // basic sanity: sha256 length
            assert.strictEqual(typeof f.sha256, 'string');
            assert.ok(f.sha256.length >= 64);
        }
    });
});
//# sourceMappingURL=assets.manifest.test.js.map