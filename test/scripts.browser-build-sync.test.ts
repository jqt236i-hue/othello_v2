import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vm from 'vm';

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

    test('buildRegistry registers root runtime modules that are not emitted into dist', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-runtime-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'game', 'visual-effects-map.js'), 'module.exports = require("./visual-effects-map.runtime");\n');
        writeFile(path.join(rootDir, 'dist', 'game', 'network-turn-handoff.js'), 'module.exports = require("./network-turn-handoff.runtime");\n');
        writeFile(path.join(rootDir, 'game', 'visual-effects-map.runtime.js'), 'module.exports = { runtime: "visual" };\n');
        writeFile(path.join(rootDir, 'game', 'network-turn-handoff.runtime.js'), 'module.exports = { runtime: "handoff" };\n');
        writeFile(path.join(rootDir, 'index.html'), [
            '<!doctype html>',
            '<html><body>',
            '<script src="public/module-registry.js?v=1"></script>',
            '<script src="entry-browser.js?v=1"></script>',
            '</body></html>'
        ].join('\n'));

        buildRegistry({ rootDir, log: false });

        const registry = fs.readFileSync(path.join(rootDir, 'public', 'module-registry.js'), 'utf8');
        expect(registry).toContain('_r("game/visual-effects-map.runtime"');
        expect(registry).toContain('_r("game/visual-effects-map.runtime.js"');
        expect(registry).toContain('_r("game/network-turn-handoff.runtime"');
        expect(registry).toContain('_r("game/network-turn-handoff.runtime.js"');
    });

    test('buildRegistry strips local _require fallbacks before browser registration', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-local-require-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'game', 'card-effects', 'protection-state.js'), [
            '"use strict";',
            'const _require = (typeof __non_webpack_require__ !== "undefined")',
            '  ? __non_webpack_require__',
            '  : (typeof require !== "undefined" ? require : null);',
            'module.exports = { ok: typeof _require === "function" || _require === null };'
        ].join('\n'));
        writeFile(path.join(rootDir, 'index.html'), [
            '<!doctype html>',
            '<html><body>',
            '<script src="public/module-registry.js?v=1"></script>',
            '<script src="entry-browser.js?v=1"></script>',
            '</body></html>'
        ].join('\n'));

        buildRegistry({ rootDir, log: false });

        const registry = fs.readFileSync(path.join(rootDir, 'public', 'module-registry.js'), 'utf8');
        const registered: Record<string, Function> = {};
        const context = {
            window: {
                __cjsRegister(key: string, sourceCode: string) {
                    registered[key] = new Function('module', 'exports', '__dirname', '__filename', sourceCode);
                }
            }
        };
        vm.runInNewContext(registry, context);

        expect(registered['game/card-effects/protection-state']).toBeInstanceOf(Function);
    });
});
