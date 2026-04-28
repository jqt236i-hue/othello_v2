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
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const { parseArgs, chooseServePort, buildHttpServerArgs, computeAssetSourceFingerprint } = require('../scripts/serve-with-fallback');
function listenOnce(server, options) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options, () => resolve(server.address()));
    });
}
describe('serve-with-fallback', () => {
    test('parseArgs keeps explicit root and port', () => {
        const args = parseArgs(['worker-public', '--port', '9000', '--host', '127.0.0.1']);
        expect(args.root).toBe('worker-public');
        expect(args.preferredPort).toBe(9000);
        expect(args.host).toBe('127.0.0.1');
    });
    test('chooseServePort skips an occupied port', async () => {
        const server = net.createServer();
        const address = await listenOnce(server, { host: '127.0.0.1', port: 0 });
        try {
            const selectedPort = await chooseServePort({
                host: '127.0.0.1',
                preferredPort: address.port,
                maxAttempts: 5
            });
            expect(selectedPort).not.toBe(address.port);
            const probe = net.createServer();
            await listenOnce(probe, { host: '127.0.0.1', port: selectedPort });
            await new Promise((resolve) => probe.close(resolve));
        }
        finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });
    test('buildHttpServerArgs includes selected port and cache flag', () => {
        const args = buildHttpServerArgs('http-server-entry.js', {
            root: '.',
            host: '0.0.0.0',
            cacheSeconds: -1,
            passThrough: ['--cors']
        }, 8012);
        expect(args).toContain('http-server-entry.js');
        expect(args).toContain('-p');
        expect(args).toContain('8012');
        expect(args).toContain('-a');
        expect(args).toContain('0.0.0.0');
        expect(args).toContain('-c-1');
        expect(args).toContain('--cors');
    });
    test('computeAssetSourceFingerprint ignores generated asset-manifest and reacts to new gacha assets', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-assets-'));
        const assetsDir = path.join(tmpRoot, 'assets');
        const gachaDir = path.join(assetsDir, 'images', 'Gacha', 'N');
        fs.mkdirSync(gachaDir, { recursive: true });
        fs.writeFileSync(path.join(gachaDir, 'sample.png'), 'sample');
        fs.writeFileSync(path.join(assetsDir, 'asset-manifest.json'), '{"stale":true}');
        try {
            const beforeManifestEdit = computeAssetSourceFingerprint(tmpRoot);
            fs.writeFileSync(path.join(assetsDir, 'asset-manifest.json'), '{"stale":false}');
            const afterManifestEdit = computeAssetSourceFingerprint(tmpRoot);
            expect(afterManifestEdit).toBe(beforeManifestEdit);
            const exrDir = path.join(assetsDir, 'images', 'Gacha', 'EXR');
            fs.mkdirSync(exrDir, { recursive: true });
            fs.writeFileSync(path.join(exrDir, '意志.png'), 'exr');
            const afterAssetAdd = computeAssetSourceFingerprint(tmpRoot);
            expect(afterAssetAdd).not.toBe(beforeManifestEdit);
        }
        finally {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    });
});
//# sourceMappingURL=serve-with-fallback.test.js.map