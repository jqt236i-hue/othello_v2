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
describe('handleGameInit with assetManifest', () => {
    test('handles manifest and sets window flag on success', async () => {
        global.Image = function () { this.onload = null; this.onerror = null; Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onload === 'function')
                this.onload(); }, 0); } }); };
        const manifest = (0, generate_asset_manifest_js_1.generateManifest)({ root: require('path').resolve(__dirname, '..'), write: false }).manifest;
        const payload = { assetManifest: manifest };
        const res = await bootstrap.handleGameInit(payload, { assetPolicy: { mode: 'compat' }, timeoutMs: 1000 });
        assert.strictEqual(res.status, 'asset_manifest_handled');
        assert.ok(res.result && (res.result.status === 'ok'));
        assert.strictEqual(bootstrap.getLoadedAssetManifest(), manifest);
    });
    test('handles missing manifest gracefully in compat mode', async () => {
        global.Image = function () { this.onload = null; this.onerror = null; Object.defineProperty(this, 'src', { set(v) { setTimeout(() => { if (typeof this.onerror === 'function')
                this.onerror(); }, 0); } }); };
        const payload = { assetManifest: { version: 'x', files: [{ path: 'assets/images/stones/nonexistent.png' }] } };
        const res = await bootstrap.handleGameInit(payload, { assetPolicy: { mode: 'compat' }, timeoutMs: 100 });
        assert.strictEqual(res.status, 'asset_manifest_handled');
        assert.strictEqual(res.result.status, 'fallback');
    });
});
//# sourceMappingURL=game-init-manifest.test.js.map