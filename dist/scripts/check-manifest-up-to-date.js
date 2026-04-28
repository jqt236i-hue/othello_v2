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
const generateAssetManifest = require("./generate-asset-manifest");
const { generateManifest } = generateAssetManifest;
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function check() {
    const root = path.resolve(__dirname, '..');
    const expectedPath = path.join(root, 'assets', 'asset-manifest.json');
    if (!fs.existsSync(expectedPath)) {
        console.error('[check-manifest] committed manifest not found:', expectedPath);
        process.exit(2);
    }
    const existing = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    const res = generateManifest({ root });
    const generated = res.manifest;
    // Simple string compare ignoring generatedAt
    existing.generatedAt = generated.generatedAt;
    generated.generatedAt = existing.generatedAt;
    const a = JSON.stringify(existing, null, 2);
    const b = JSON.stringify(generated, null, 2);
    if (a !== b) {
        console.error('[check-manifest] manifest mismatch');
        process.exit(1);
    }
    console.log('[check-manifest] manifest up-to-date');
    process.exit(0);
}
if (require.main === module)
    check();
module.exports = { check };
//# sourceMappingURL=check-manifest-up-to-date.js.map