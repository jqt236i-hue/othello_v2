import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const {
    ROOT_FILES,
    VERIFY_DIRS,
    VERIFY_ROOT_FILES,
    createPrepareConfig,
    prepareWorkerAssets,
    verifyMirrors
} = require('../scripts/prepare-worker-assets');

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
