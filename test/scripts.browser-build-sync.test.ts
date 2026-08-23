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

function writeSourceStub(rootDir: string, distRelativePath: string) {
    writeFile(
        path.join(rootDir, distRelativePath.replace(/\.js$/, '.ts')),
        'export = {};\n'
    );
}

function writeBrowserIndexFixture(rootDir: string) {
    writeFile(path.join(rootDir, 'public', 'runtime.js'), 'window.__cjsRegister = function() {};\nwindow.__cjsAlias = function() {};\n');
    writeFile(path.join(rootDir, 'styles-base.css'), 'body { color: #fff; }\n');
    writeFile(path.join(rootDir, 'styles-board-dom-compat.css'), '[data-board-renderer="dom"] { display: grid; }\n');
    writeFile(path.join(rootDir, 'index.html'), [
        '<!doctype html>',
        '<html><body>',
        '<link rel="stylesheet" href="styles-base.css?v=1">',
        '<meta data-card-reversi-feature-style-slot="board-dom-compat" data-card-reversi-feature-style-href="styles-board-dom-compat.css?v=1">',
        '<script src="public/runtime.js"></script>',
        '<script src="public/module-registry.js?v=1"></script>',
        '<script src="entry-browser.js?v=1"></script>',
        '</body></html>'
    ].join('\n'));
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

    test('script version tokens are stable across text line endings', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-version-eol-'));
        cleanupDirs.push(rootDir);
        const filePath = path.join(rootDir, 'sample.js');

        fs.writeFileSync(filePath, 'const value = 1;\nexport { value };\n', 'utf8');
        const lfVersion = computeScriptVersionToken(filePath);
        fs.writeFileSync(filePath, 'const value = 1;\r\nexport { value };\r\n', 'utf8');
        const crlfVersion = computeScriptVersionToken(filePath);
        fs.writeFileSync(filePath, 'const value = 1;\r\nexport { value };\n', 'utf8');
        const mixedVersion = computeScriptVersionToken(filePath);
        fs.writeFileSync(filePath, 'const value = 2;\r\nexport { value };\r\n', 'utf8');
        const changedContentVersion = computeScriptVersionToken(filePath);

        expect(crlfVersion).toBe(lfVersion);
        expect(mixedVersion).toBe(lfVersion);
        expect(changedContentVersion).not.toBe(lfVersion);
    });

    test('buildRegistry syncs index.html script versions to current file content', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-sync-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'ui', 'sample.js'), 'module.exports = 1;\n');
        writeSourceStub(rootDir, path.join('ui', 'sample.js'));
        writeBrowserIndexFixture(rootDir);

        buildRegistry({ rootDir, log: false });

        const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
        const registryPath = path.join(rootDir, 'public', 'module-registry.js');
        const runtimeVersion = computeScriptVersionToken(path.join(rootDir, 'public', 'runtime.js'));
        const registryVersion = computeScriptVersionToken(registryPath);
        const entryVersion = computeScriptVersionToken(path.join(rootDir, 'entry-browser.js'));
        const styleVersion = computeScriptVersionToken(path.join(rootDir, 'styles-base.css'));
        const compatStyleVersion = computeScriptVersionToken(
            path.join(rootDir, 'styles-board-dom-compat.css')
        );

        expect(html).toContain(`public/runtime.js?v=${runtimeVersion}`);
        expect(html).toContain(`public/module-registry.js?v=${registryVersion}`);
        expect(html).toContain(`entry-browser.js?v=${entryVersion}`);
        expect(html).toContain(`styles-base.css?v=${styleVersion}`);
        expect(html).toContain(
            `data-card-reversi-feature-style-href="styles-board-dom-compat.css?v=${compatStyleVersion}"`
        );
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
        writeSourceStub(rootDir, path.join('ui', 'sample.js'));
        writeBrowserIndexFixture(rootDir);

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
        writeSourceStub(rootDir, path.join('ui', 'sample.js'));
        writeBrowserIndexFixture(rootDir);

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

    test('check detects a stale feature-level optional registry', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-group-stale-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'ui', 'gacha', 'gacha-overlay-controller.js'), 'module.exports = {};\n');
        writeSourceStub(rootDir, path.join('ui', 'gacha', 'gacha-overlay-controller.js'));
        writeBrowserIndexFixture(rootDir);

        const result = buildRegistry({ rootDir, log: false });
        writeFile(result.groupOutFiles.gacha, 'stale group registry\n');

        expect(checkBrowserBuildUpToDate(rootDir)).toEqual({
            ok: false,
            code: 1,
            message: '[check-browser-build] optional gacha module registry is stale. Run `npm run build:browser`.'
        });
    });

    test('buildRegistry registers root runtime modules that are not emitted into dist', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-runtime-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'game', 'visual-effects-map.js'), 'module.exports = require("./visual-effects-map.runtime");\n');
        writeFile(path.join(rootDir, 'dist', 'game', 'network-turn-handoff.js'), 'module.exports = require("./network-turn-handoff.runtime");\n');
        writeSourceStub(rootDir, path.join('game', 'visual-effects-map.js'));
        writeSourceStub(rootDir, path.join('game', 'network-turn-handoff.js'));
        writeFile(path.join(rootDir, 'game', 'visual-effects-map.runtime.js'), 'module.exports = { runtime: "visual" };\n');
        writeFile(path.join(rootDir, 'game', 'network-turn-handoff.runtime.js'), 'module.exports = { runtime: "handoff" };\n');
        writeBrowserIndexFixture(rootDir);

        buildRegistry({ rootDir, log: false });

        const registry = fs.readFileSync(path.join(rootDir, 'public', 'module-registry.js'), 'utf8');
        expect(registry).toContain('_r("game/visual-effects-map.runtime"');
        expect(registry).toContain('_a("game/visual-effects-map.runtime.js", "game/visual-effects-map.runtime")');
        expect(registry).toContain('_r("game/network-turn-handoff.runtime"');
        expect(registry).toContain('_a("game/network-turn-handoff.runtime.js", "game/network-turn-handoff.runtime")');
    });

    test('buildRegistry makes .js aliases share the same browser module instance', () => {
        const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-build-js-alias-'));
        cleanupDirs.push(rootDir);

        writeFile(path.join(rootDir, 'entry-browser.js'), 'console.log("entry-a");\n');
        writeFile(path.join(rootDir, 'dist', 'ui', 'stateful.js'), [
            '"use strict";',
            'let calls = 0;',
            'calls += 1;',
            'module.exports = { calls };'
        ].join('\n'));
        writeSourceStub(rootDir, path.join('ui', 'stateful.js'));
        writeBrowserIndexFixture(rootDir);

        buildRegistry({ rootDir, log: false });

        const registry = fs.readFileSync(path.join(rootDir, 'public', 'module-registry.js'), 'utf8');
        const factories: Record<string, Function> = {};
        const aliases: Record<string, string> = {};
        const moduleCache: Record<string, { exports: any }> = {};
        const context = {
            window: {
                __cjsRegister(key: string, sourceCode: string) {
                    factories[key] = new Function('module', 'exports', '__dirname', '__filename', sourceCode);
                },
                __cjsAlias(aliasKey: string, targetKey: string) {
                    aliases[aliasKey] = targetKey;
                }
            }
        };
        vm.runInNewContext(registry, context);

        const resolveAlias = (key: string): string => {
            let current = key;
            const seen = new Set<string>();
            while (aliases[current] && !seen.has(current)) {
                seen.add(current);
                current = aliases[current];
            }
            return current;
        };
        const localRequire = (key: string) => {
            const resolved = resolveAlias(key);
            if (moduleCache[resolved]) return moduleCache[resolved].exports;
            const factory = factories[resolved];
            if (typeof factory !== 'function') throw new Error(`missing module: ${resolved}`);
            const module = { exports: {} };
            moduleCache[resolved] = module;
            factory(module, module.exports, path.posix.dirname(resolved), resolved);
            return module.exports;
        };

        const withoutExtension = localRequire('ui/stateful');
        const withExtension = localRequire('ui/stateful.js');

        expect(withExtension).toBe(withoutExtension);
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
        writeSourceStub(rootDir, path.join('game', 'card-effects', 'protection-state.js'));
        writeBrowserIndexFixture(rootDir);

        buildRegistry({ rootDir, log: false });

        const registry = fs.readFileSync(path.join(rootDir, 'public', 'module-registry.js'), 'utf8');
        const registered: Record<string, Function> = {};
        const context = {
            window: {
                __cjsRegister(key: string, sourceCode: string) {
                    registered[key] = new Function('module', 'exports', '__dirname', '__filename', sourceCode);
                },
                __cjsAlias() {
                    // The alias contract is verified by the adjacent test; this case only
                    // needs a runtime-compatible registry surface to inspect sanitization.
                }
            }
        };
        vm.runInNewContext(registry, context);

        expect(registered['game/card-effects/protection-state']).toBeInstanceOf(Function);
    });
});
