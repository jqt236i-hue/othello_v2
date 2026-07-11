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
});
