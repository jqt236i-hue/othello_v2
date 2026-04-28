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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const { ROOT_FILES, VERIFY_DIRS, VERIFY_ROOT_FILES, createPrepareConfig, prepareWorkerAssets, verifyMirrors } = require('../scripts/prepare-worker-assets');
function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}
describe('prepare-worker-assets', () => {
    const cleanupDirs = [];
    afterEach(() => {
        while (cleanupDirs.length > 0) {
            const dirPath = cleanupDirs.pop();
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    });
    test('verifies index.html as part of mirrored root files', () => {
        expect(ROOT_FILES).toContain('index.html');
        expect(VERIFY_ROOT_FILES).toContain('index.html');
    });
    test('verifies assets as part of mirrored directories', () => {
        expect(VERIFY_DIRS).toContain('assets');
    });
    test('detects worker-public index.html drift in a temp mirror', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-root-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: ['index.html'],
            verifyRootFiles: ['index.html'],
            dirs: [],
            verifyDirs: [],
            optionalFiles: [],
            generatedOptionalAssets: []
        };
        const config = createPrepareConfig(options);
        writeFile(path.join(rootDir, 'index.html'), '<!doctype html><html><body>root</body></html>');
        prepareWorkerAssets(options);
        writeFile(path.join(outDir, 'index.html'), '<!doctype html><html><body>drift</body></html>');
        expect(() => verifyMirrors([], [], config)).toThrow(/(size|content) mismatch: index\.html/);
    });
    test('detects worker-public asset drift in a temp mirror', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-prepare-assets-'));
        cleanupDirs.push(rootDir);
        const outDir = path.join(rootDir, 'worker-public-out');
        const options = {
            rootDir,
            outDir,
            rootFiles: [],
            verifyRootFiles: [],
            dirs: ['assets'],
            verifyDirs: ['assets'],
            optionalFiles: [],
            generatedOptionalAssets: []
        };
        const config = createPrepareConfig(options);
        writeFile(path.join(rootDir, 'assets', 'sample.txt'), 'root-asset');
        prepareWorkerAssets(options);
        writeFile(path.join(outDir, 'assets', 'sample.txt'), 'drift-asset');
        expect(() => verifyMirrors([], [], config)).toThrow(/(size|content) mismatch: assets[\\/]sample\.txt/);
    });
});
//# sourceMappingURL=scripts.prepare-worker-assets.test.js.map