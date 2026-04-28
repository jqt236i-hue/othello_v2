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
const bootstrap = __importStar(require("../ui/bootstrap.js"));
const generate_asset_manifest_js_1 = require("../scripts/generate-asset-manifest.js");
describe('applyAssetManifest', () => {
    test('applies valid manifest in compat mode', async () => {
        // Mock Image so preloadAssets succeeds in Node test env
        global.Image = function () {
            this.onload = null;
            this.onerror = null;
            Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onload === 'function')
                    this.onload(); }, 0); } });
        };
        const res = (0, generate_asset_manifest_js_1.generateManifest)({ root: require('path').resolve(__dirname, '..'), write: false }).manifest;
        const out = await bootstrap.applyAssetManifest(res, { mode: 'compat' }, { timeoutMs: 1000 });
        assert.strictEqual(out.status, 'ok');
    });
    test('fails gracefully in compat mode when assets missing', async () => {
        // simulate image error
        global.Image = function () {
            this.onload = null;
            this.onerror = null;
            Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onerror === 'function')
                    this.onerror(); }, 0); } });
        };
        const fake = { version: 'x', files: [{ path: 'assets/images/stones/nonexistent.png', sha256: 'x' }] };
        const out = await bootstrap.applyAssetManifest(fake, { mode: 'compat' }, { timeoutMs: 100 });
        assert.strictEqual(out.status, 'fallback');
    });
    test('errors in strict mode when assets missing', async () => {
        // simulate image error
        global.Image = function () {
            this.onload = null;
            this.onerror = null;
            Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onerror === 'function')
                    this.onerror(); }, 0); } });
        };
        const fake = { version: 'x', files: [{ path: 'assets/images/stones/nonexistent.png', sha256: 'x' }] };
        const out = await bootstrap.applyAssetManifest(fake, { mode: 'strict' }, { timeoutMs: 100 });
        assert.strictEqual(out.status, 'error');
    });
});
//# sourceMappingURL=asset.manifest.apply.test.js.map