import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { buildRegistry } = require('../scripts/build-module-registry');
const { checkBrowserBuildUpToDate } = require('../scripts/check-browser-build-up-to-date');
const { computeScriptVersionToken } = require('../scripts/sync-browser-script-versions');

function writeFile(filePath: string, content: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

describe('browser build sync', () => {
    const cleanupDirs: string[] = [];

    afterEach(() => {
        while (cleanupDirs.length > 0) {
            const dirPath = cleanupDirs.pop();
            if (dirPath) {
                fs.rmSync(dirPath, { recursive: true, force: true });
            }
        }
    });

    test('buildRegistry syncs index.html script versions to current file content', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-sync-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'ui', 'sample.js'), 'module.exports = 1;\n');
        writeFile(path.join(rootDir, 'index.html'), [
            '<!doctype html>',
            '<html><body>',
            '<script src="public/module-registry.js?v=1"></script>',
            '<script src="entry-browser.js?v=1"></script>',
            '</body></html>'
        ].join('\n'));

        buildRegistry({ rootDir, log: false });

        const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
        const registryPath = path.join(rootDir, 'public', 'module-registry.js');
        const registryVersion = computeScriptVersionToken(registryPath);
        const entryVersion = computeScriptVersionToken(path.join(rootDir, 'entry-browser.js'));

        expect(html).toContain(`public/module-registry.js?v=${registryVersion}`);
        expect(html).toContain(`entry-browser.js?v=${entryVersion}`);
        expect(checkBrowserBuildUpToDate(rootDir)).toEqual({
            ok: true,
            code: 0,
            message: '[check-browser-build] browser build assets up-to-date'
        });
    });

    test('check detects stale module registry when dist output changes', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-registry-stale-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'ui', 'sample.js'), 'module.exports = 1;\n');
        writeFile(path.join(rootDir, 'index.html'), [
            '<!doctype html>',
            '<html><body>',
            '<script src="public/module-registry.js?v=1"></script>',
            '<script src="entry-browser.js?v=1"></script>',
            '</body></html>'
        ].join('\n'));

        buildRegistry({ rootDir, log: false });
        writeFile(path.join(rootDir, 'dist', 'ui', 'sample.js'), 'module.exports = 2;\n');

        expect(checkBrowserBuildUpToDate(rootDir)).toEqual({
            ok: false,
            code: 1,
            message: '[check-browser-build] module registry is stale. Run `npm run build:browser`.'
        });
    });

    test('check detects stale index.html script versions', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-index-stale-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'ui', 'sample.js'), 'module.exports = 1;\n');
        writeFile(path.join(rootDir, 'index.html'), [
            '<!doctype html>',
            '<html><body>',
            '<script src="public/module-registry.js?v=1"></script>',
            '<script src="entry-browser.js?v=1"></script>',
            '</body></html>'
        ].join('\n'));

        buildRegistry({ rootDir, log: false });

        const indexPath = path.join(rootDir, 'index.html');
        const html = fs.readFileSync(indexPath, 'utf8').replace(/entry-browser\.js\?v=\d+/, 'entry-browser.js?v=999');
        fs.writeFileSync(indexPath, html, 'utf8');

        expect(checkBrowserBuildUpToDate(rootDir)).toEqual({
            ok: false,
            code: 1,
            message: '[check-browser-build] index.html script versions are stale. Run `npm run build:browser`.'
        });
    });
});
