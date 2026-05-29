/**
 * Builds public/module-registry.js from dist/ files.
 * Run: node dist/scripts/build-module-registry.js
 * Or via tsc + node.
 */
import * as fs from 'fs';
import * as path from 'path';
import _sync_browser_script_versions from './sync-browser-script-versions';
const { syncBrowserScriptVersions } = _sync_browser_script_versions;

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'public', 'module-registry.js');
const WRITE_RETRY_COUNT = 5;
const WRITE_RETRY_DELAY_MS = 100;

interface BuildRegistryOptions {
    rootDir?: string;
    distDir?: string;
    outFile?: string;
    write?: boolean;
    log?: boolean;
    syncScriptVersions?: boolean;
}

interface BuildRegistryResult {
    content: string;
    outFile: string;
    wroteFile: boolean;
}

const BROWSER_MODULE_PREFIXES = [
    'cards/',
    'constants/',
    'data/dialogue/',
    'game/',
    'othello-ai/core/',
    'othello-ai/eval/',
    'othello-ai/runtime/',
    'othello-ai/search/',
    'story/',
    'shared/',
    'ui/',
    'utils/'
];

const BROWSER_ROOT_MODULES = new Set([
    'card-system.js',
    'config.js',
    'core.js',
    'cpu.js',
    'deck-builder.js',
    'dom-utils.js',
    'error-handler.js',
    'game-events.js',
    'game-state.js',
    'is-env-capable.js',
    'main.js',
    'player.js',
    'prng.js',
    'shared-constants.js',
    'sound-engine.js',
    'state.js',
    'storage.js',
    'ui.js'
]);

const DIST_EXCLUDED_BROWSER_MODULES = new Set([
    'shared/observation-gacha-catalog.generated.js',
    'shared/gacha-hand-catalog.generated.js'
]);

const EXTRA_BROWSER_MODULES: Array<{ source: string; key: string; aliases?: string[] }> = [
    { source: 'utils/owner-helpers.js', key: 'legacy/utils/owner-helpers' },
    { source: 'game/logic/cards/breeding.js', key: 'legacy/game/logic/cards/breeding' },
    { source: 'game/logic/cards/sniper.js', key: 'legacy/game/logic/cards/sniper' },
    { source: 'game/logic/cards/lightning.js', key: 'legacy/game/logic/cards/lightning' },
    { source: 'game/logic/cards/destroy_dragon.js', key: 'legacy/game/logic/cards/destroy_dragon' },
    {
        source: 'shared/observation-gacha-catalog.generated.js',
        key: 'shared/observation-gacha-catalog.generated',
        aliases: ['shared/observation-gacha-catalog.generated.js']
    },
    {
        source: 'shared/gacha-hand-catalog.generated.js',
        key: 'shared/gacha-hand-catalog.generated',
        aliases: ['shared/gacha-hand-catalog.generated.js']
    },
    {
        source: 'game/card-effects-applier.js',
        key: 'game/card-effects-applier',
        aliases: ['game/card-effects-applier.js']
    }
];

function isRootRuntimeModule(rel: string): boolean {
    if (!rel.endsWith('.runtime.js')) return false;
    if (rel.includes('/src/types/')) return false;
    return BROWSER_MODULE_PREFIXES.some(prefix => rel.startsWith(prefix));
}

function isBrowserModule(rel: string): boolean {
    if (rel.startsWith('dist/') || rel.startsWith('worker-public/')) return false;
    if (rel.includes('/src/types/')) return false;
    if (rel.includes('__tests__')) return false;
    if (rel.includes('.test.')) return false;
    if (DIST_EXCLUDED_BROWSER_MODULES.has(rel)) return false;
    if (BROWSER_ROOT_MODULES.has(rel)) return true;
    return BROWSER_MODULE_PREFIXES.some(prefix => rel.startsWith(prefix));
}

function walkDir(dir: string, base: string, files: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(full, base, files);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            const rel = path.relative(base, full).replace(/\\/g, '/');
            files.push(rel);
        }
    }
}

function appendRegisteredModule(lines: string[], moduleKey: string, content: string): void {
    const moduleDir = path.posix.dirname(moduleKey);
    const cjsDir = moduleDir === '.' ? '' : moduleDir;
    let transformed = content
        .replace(/(?:const|let|var)\s+_require\s*=\s*\(?typeof\s+__non_webpack_require__[\s\S]*?:\s*require\s*\)?\s*;?\s*/g, '');
    transformed = 'var __cjsDir=' + JSON.stringify(cjsDir) + ';var _require=function(id){return window.require(id,__cjsDir);};var require=_require;var __require=_require;\n' + transformed;
    const jsonEncoded = JSON.stringify(transformed);
    lines.push('  _r(' + JSON.stringify(moduleKey) + ', ' + jsonEncoded + ');');
    lines.push('');
}

function appendRegisteredModuleWithJsAlias(lines: string[], moduleKey: string, content: string): void {
    appendRegisteredModule(lines, moduleKey, content);
    if (!moduleKey.endsWith('.js')) {
        appendRegisteredModule(lines, moduleKey + '.js', content);
    }
}

function resolveBrowserModuleSourcePath(rootDir: string, distDir: string, rel: string): string {
    if (rel.endsWith('.runtime.js')) {
        const rootRuntimePath = path.join(rootDir, rel);
        if (fs.existsSync(rootRuntimePath)) {
            return rootRuntimePath;
        }
    }
    return path.join(distDir, rel);
}

function collectRootRuntimeModules(rootDir: string): string[] {
    const rootJsFiles: string[] = [];
    for (const prefix of BROWSER_MODULE_PREFIXES) {
        const sourceDir = path.join(rootDir, prefix);
        if (!fs.existsSync(sourceDir)) continue;
        walkDir(sourceDir, rootDir, rootJsFiles);
    }
    return rootJsFiles.filter(isRootRuntimeModule).sort();
}

function sleepSync(ms: number): void {
    const end = Date.now() + Math.max(0, ms);
    while (Date.now() < end) {
        // Short synchronous wait for transient Windows file locks.
    }
}

function writeFileWithRetry(filePath: string, content: string): void {
    let lastError: any = null;
    for (let attempt = 0; attempt <= WRITE_RETRY_COUNT; attempt += 1) {
        try {
            fs.writeFileSync(filePath, content, 'utf8');
            return;
        } catch (error: any) {
            lastError = error;
            if (attempt >= WRITE_RETRY_COUNT) break;
            sleepSync(WRITE_RETRY_DELAY_MS * (attempt + 1));
        }
    }
    throw lastError;
}

function buildRegistry(options?: BuildRegistryOptions): BuildRegistryResult | null {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootDir = opts.rootDir ? path.resolve(String(opts.rootDir)) : ROOT;
    const distDir = opts.distDir ? path.resolve(String(opts.distDir)) : path.join(rootDir, 'dist');
    const outFile = opts.outFile ? path.resolve(String(opts.outFile)) : path.join(rootDir, 'public', 'module-registry.js');
    const shouldWrite = opts.write !== false;
    const shouldLog = opts.log !== false;
    const shouldSyncScriptVersions = opts.syncScriptVersions !== false;
    if (!fs.existsSync(distDir)) {
        return null;
    }
    const jsFiles: string[] = [];
    walkDir(distDir, distDir, jsFiles);

    const lines: string[] = [
        '// Auto-generated module registry. Do not edit.',
        '// Generated by scripts/build-module-registry.ts',
        '(function() {',
        '  var _r = window.__cjsRegister;',
        '  if (!_r) throw new Error("[cjs] runtime.js must load before module-registry.js");',
        ''
    ];

    const skipped: string[] = [];
    const registeredKeys = new Set<string>();

    for (const rel of jsFiles) {
        if (!isBrowserModule(rel)) {
            skipped.push(rel + ' (non-browser)');
            continue;
        }

        const fullPath = resolveBrowserModuleSourcePath(rootDir, distDir, rel);
        let content: string;
        try {
            content = fs.readFileSync(fullPath, 'utf8');
        } catch {
            skipped.push(rel);
            continue;
        }

        // Skip empty or trivial files
        if (content.trim().length === 0) {
            skipped.push(rel + ' (empty)');
            continue;
        }

        // Module key is the relative path without .js extension
        const moduleKey = rel.replace(/\.js$/, '');

        registeredKeys.add(moduleKey);
        if (!moduleKey.endsWith('.js')) {
            registeredKeys.add(moduleKey + '.js');
        }
        appendRegisteredModuleWithJsAlias(lines, moduleKey, content);
    }

    for (const extra of EXTRA_BROWSER_MODULES) {
        if (registeredKeys.has(extra.key) || (extra.aliases || []).some(alias => registeredKeys.has(alias))) {
            skipped.push(extra.source + ' (duplicate extra key)');
            continue;
        }
        const fullPath = path.join(rootDir, extra.source);
        let content: string;
        try {
            content = fs.readFileSync(fullPath, 'utf8');
        } catch {
            skipped.push(extra.source + ' (missing extra)');
            continue;
        }
        appendRegisteredModule(lines, extra.key, content);
        registeredKeys.add(extra.key);
        for (const alias of extra.aliases || []) {
            appendRegisteredModule(lines, alias, content);
            registeredKeys.add(alias);
        }
    }

    for (const rel of collectRootRuntimeModules(rootDir)) {
        const moduleKey = rel.replace(/\.js$/, '');
        if (registeredKeys.has(moduleKey) || registeredKeys.has(moduleKey + '.js')) {
            skipped.push(rel + ' (duplicate runtime key)');
            continue;
        }
        const fullPath = path.join(rootDir, rel);
        let content: string;
        try {
            content = fs.readFileSync(fullPath, 'utf8');
        } catch {
            skipped.push(rel + ' (missing runtime source)');
            continue;
        }
        appendRegisteredModuleWithJsAlias(lines, moduleKey, content);
        registeredKeys.add(moduleKey);
        registeredKeys.add(moduleKey + '.js');
    }

    lines.push('})();');
    lines.push('');

    const content = lines.join('\n');
    let wroteFile = false;
    if (shouldWrite) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;
        if (current !== content) {
            writeFileWithRetry(outFile, content);
            wroteFile = true;
        }
        if (shouldSyncScriptVersions && fs.existsSync(path.join(rootDir, 'index.html'))) {
            syncBrowserScriptVersions({ rootDir, write: true });
        }
    }

    if (shouldLog) {
        console.log('[module-registry] wrote ' + jsFiles.length + ' modules to ' + path.relative(rootDir, outFile));
        if (skipped.length > 0) {
            console.log('[module-registry] skipped ' + skipped.length + ' files:');
            skipped.forEach(s => {
                console.log('  - ' + s);
            });
        }
    }

    return {
        content,
        outFile,
        wroteFile
    };
}

if (require.main === module) {
    buildRegistry();
}

export = {
    buildRegistry
};
