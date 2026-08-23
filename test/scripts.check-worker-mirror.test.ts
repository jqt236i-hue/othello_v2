import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { prepareWorkerAssets } = require('../scripts/prepare-worker-assets');
const { checkWorkerMirror } = require('../scripts/check-worker-mirror');

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

describe('check-worker-mirror', () => {
    let rootDir = '';

    afterEach(() => {
        if (rootDir) fs.rmSync(rootDir, { recursive: true, force: true });
        rootDir = '';
    });

    test('validates a generated mirror and rejects a later manual file', () => {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-mirror-check-'));
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

        writeFile(path.join(rootDir, 'index.html'), '<!doctype html><html><body>root</body></html>');
        prepareWorkerAssets(options);

        expect(checkWorkerMirror(options)).toBe(true);

        writeFile(path.join(outDir, 'manual-only.txt'), 'unexpected');
        expect(() => checkWorkerMirror(options)).toThrow(/unexpected mirror file: manual-only\.txt/);
    });

    test('allows an absent deploy-only optional while still verifying it when present', () => {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-mirror-deploy-optional-'));
        const outDir = path.join(rootDir, 'worker-public-out');
        const deployOptional = 'node_modules/onnxruntime-web/dist/ort.min.js';
        const trackedOptional = 'data/models/policy-table.json';
        const options = {
            rootDir,
            outDir,
            rootFiles: ['index.html'],
            verifyRootFiles: ['index.html'],
            dirs: [],
            verifyDirs: [],
            optionalFiles: [deployOptional, trackedOptional],
            generatedOptionalAssets: []
        };

        writeFile(path.join(rootDir, 'index.html'), '<!doctype html><html><body>root</body></html>');
        writeFile(path.join(rootDir, deployOptional), 'deploy-runtime');
        writeFile(path.join(rootDir, trackedOptional), '{"tracked":true}');
        prepareWorkerAssets(options);

        fs.rmSync(path.join(outDir, deployOptional));
        expect(checkWorkerMirror(options)).toBe(true);

        writeFile(path.join(outDir, deployOptional), 'drift');
        expect(() => checkWorkerMirror(options)).toThrow(/(?:size|content) mismatch: node_modules[\\/]onnxruntime-web/);

        fs.rmSync(path.join(outDir, deployOptional));
        fs.rmSync(path.join(outDir, trackedOptional));
        expect(() => checkWorkerMirror(options)).toThrow(/worker-public missing: data[\\/]models[\\/]policy-table\.json/);
    });
});
