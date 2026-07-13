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
    optionalOutFile?: string;
    groupOutDir?: string;
    splitRegistries?: boolean;
    write?: boolean;
    log?: boolean;
    syncScriptVersions?: boolean;
}

interface BuildRegistryResult {
    content: string;
    startupContent: string;
    optionalContent: string;
    outFile: string;
    optionalOutFile: string;
    groupContents: Record<OptionalRuntimeGroup, string>;
    groupOutFiles: Record<OptionalRuntimeGroup, string>;
    wroteFile: boolean;
    wroteOptionalFile: boolean;
    wroteGroupFiles: Record<OptionalRuntimeGroup, boolean>;
}

type BrowserBootModuleClass = 'required' | 'optional';
const OPTIONAL_RUNTIME_GROUPS = ['gacha', 'cosmetic', 'leaderboard', 'commentary', 'cpu', 'onnx'] as const;
type OptionalRuntimeGroup = typeof OPTIONAL_RUNTIME_GROUPS[number];

interface RegistryModuleRecord {
    moduleKey: string;
    content: string;
    aliases: string[];
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
    'shared/gacha-hand-catalog.generated.js',
    // Node-only runtime (onnxruntime-node/fs/path). It must never be evaluated by a browser registry.
    'game/ai/policy-onnx-runtime-v2.js'
]);

const EXTRA_BROWSER_MODULES: Array<{ source: string; key: string; aliases?: string[] }> = [
    { source: 'othello-ai/core/board.js', key: 'othello-ai/core/board', aliases: ['othello-ai/core/board.js'] },
    { source: 'othello-ai/eval/value-table.js', key: 'othello-ai/eval/value-table', aliases: ['othello-ai/eval/value-table.js'] },
    { source: 'othello-ai/runtime/browser-cpu.js', key: 'othello-ai/runtime/browser-cpu', aliases: ['othello-ai/runtime/browser-cpu.js'] },
    { source: 'othello-ai/runtime/engine.js', key: 'othello-ai/runtime/engine', aliases: ['othello-ai/runtime/engine.js'] },
    { source: 'othello-ai/search/teacher.js', key: 'othello-ai/search/teacher', aliases: ['othello-ai/search/teacher.js'] },
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

const REQUIRED_BOOT_MODULE_KEYS = new Set([
    'shared-constants',
    // Result rewards and network seat normalization are non-screen contracts.
    'shared/gacha-helpers',
    'shared/gacha-hand-catalog-shared',
    'shared/observation-gacha-catalog-shared',
    'shared/observation-gacha-catalog.generated',
    'cards/catalog',
    'game/logic/core',
    'game/logic/cards',
    'game/turn/turn_pipeline',
    'ui/bootstrap',
    'ui/network-client',
    'ui/board-renderer',
    'ui/debug-card-search',
    // There is no player-facing debug lazy shell. Keep the small debug fixture available in both lanes.
    'ui/debug-test-scenarios',
    'ui/gacha/catalog-access',
    'ui/gacha/gacha-events',
    'ui/presentation-handler',
    'ui/storage/gacha-progress',
    'ui/cosmetics/catalog-shared',
    'ui/hand-skin/catalog',
    'ui/hand-skin/selection',
    'ui/hand-skin/runtime'
]);

const OPTIONAL_BOOT_MODULE_PREFIXES = [
    'data/dialogue/',
    'game/ai/othello-onnx-runtime',
    'game/ai/policy-onnx-runtime',
    'node_modules/onnxruntime-web',
    'othello-ai/',
    'shared/gacha',
    'shared/observation-gacha',
    'ui/background-skin/',
    'ui/cosmetics/',
    'ui/debug',
    'ui/font-skin/',
    'ui/gacha/',
    'ui/hand-skin/',
    'ui/leaderboard',
    'ui/storage/gacha'
];

const OPTIONAL_GROUP_PREFIXES: Record<OptionalRuntimeGroup, readonly string[]> = Object.freeze({
    gacha: Object.freeze([
        'shared/gacha',
        'shared/observation-gacha',
        'ui/gacha/',
        'ui/storage/gacha'
    ]),
    cosmetic: Object.freeze([
        'ui/background-skin/',
        'ui/font-skin/',
        'ui/hand-skin/controller'
    ]),
    leaderboard: Object.freeze(['ui/leaderboard']),
    // Commentary is player-visible and enabled by default, so its current runtime remains eager.
    // This group is intentionally empty until a first-action shell can preserve that contract.
    commentary: Object.freeze(['data/dialogue/']),
    cpu: Object.freeze(['othello-ai/']),
    onnx: Object.freeze([
        'game/ai/othello-onnx-runtime',
        'game/ai/policy-onnx-runtime'
    ])
});

const OPTIONAL_GROUP_DEPENDENCY_OVERRIDES: Partial<Record<OptionalRuntimeGroup, readonly string[]>> = Object.freeze({
    // Required cosmetic catalog bridges resolve these generated catalogs dynamically, while
    // hand-skin/controller resolves the event module through a dynamic require path.
    cosmetic: Object.freeze([
        'shared/observation-gacha-catalog-shared',
        'shared/observation-gacha-catalog.generated',
        'ui/storage/gacha-progress',
        'ui/gacha/gacha-events'
    ])
});

function normalizeBootModuleKey(key: string): string {
    let normalized = String(key || '').trim().replace(/\\/g, '/');
    normalized = normalized.replace(/^\.\//, '');
    if (normalized.startsWith('dist/')) normalized = normalized.slice(5);
    normalized = normalized.replace(/\.js$/, '');
    return normalized;
}

function classifyBrowserBootModule(key: string): BrowserBootModuleClass {
    const normalized = normalizeBootModuleKey(key);
    if (REQUIRED_BOOT_MODULE_KEYS.has(normalized)) return 'required';
    if (OPTIONAL_BOOT_MODULE_PREFIXES.some(prefix => normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix))) {
        return 'optional';
    }
    return 'required';
}

function matchesModulePrefix(moduleKey: string, prefix: string): boolean {
    const normalizedPrefix = normalizeBootModuleKey(prefix);
    if (!normalizedPrefix) return false;
    return moduleKey === normalizedPrefix.replace(/\/$/, '') || moduleKey.startsWith(normalizedPrefix);
}

function classifyBrowserOptionalGroup(key: string): OptionalRuntimeGroup | null {
    const normalized = normalizeBootModuleKey(key);
    if (!normalized || classifyBrowserBootModule(normalized) !== 'optional') return null;
    for (const group of OPTIONAL_RUNTIME_GROUPS) {
        if (OPTIONAL_GROUP_PREFIXES[group].some(prefix => matchesModulePrefix(normalized, prefix))) {
            return group;
        }
    }
    return null;
}

function buildBootModuleMetadata(
    registeredKeys: Set<string>,
    optionalGroups?: Partial<Record<OptionalRuntimeGroup, Set<string>>>
): {
    required: string[];
    optional: string[];
    optionalPrefixes: string[];
    optionalGroups: Record<string, string[]>;
} {
    const required = new Set<string>();
    const optional = new Set<string>();

    registeredKeys.forEach(key => {
        const normalized = normalizeBootModuleKey(key);
        if (!normalized) return;
        if (classifyBrowserBootModule(normalized) === 'optional') {
            optional.add(normalized);
        } else {
            required.add(normalized);
        }
    });

    const groups: Record<string, string[]> = {};
    for (const group of OPTIONAL_RUNTIME_GROUPS) {
        const values = optionalGroups && optionalGroups[group];
        groups[group] = Array.from(values || [])
            .map(normalizeBootModuleKey)
            .filter(Boolean)
            .filter((value, index, all) => all.indexOf(value) === index)
            .sort();
    }

    return {
        required: Array.from(required).sort(),
        optional: Array.from(optional).sort(),
        optionalPrefixes: OPTIONAL_BOOT_MODULE_PREFIXES.slice().sort(),
        optionalGroups: groups
    };
}

function createBootModuleMetadataLines(
    registeredKeys: Set<string>,
    optionalGroups?: Partial<Record<OptionalRuntimeGroup, Set<string>>>
): string[] {
    const metadata = buildBootModuleMetadata(registeredKeys, optionalGroups);
    const json = JSON.stringify(metadata, null, 2)
        .split('\n')
        .map((line, index) => index === 0 ? line : '  ' + line)
        .join('\n');
    return [
        '  var _nextBootModules = ' + json + ';',
        '  var _previousBootModules = window.__CARD_REVERSI_BOOT_MODULES__ || {};',
        '  function _mergeBootList(left, right) {',
        '    var seen = Object.create(null);',
        '    return [].concat(Array.isArray(left) ? left : [], Array.isArray(right) ? right : [])',
        '      .map(function(value) { return String(value || "").replace(/\\\\/g, "/").replace(/^\\.\\//, "").replace(/^dist\\//, "").replace(/\\.js$/, ""); })',
        '      .filter(function(value) { if (!value || seen[value]) return false; seen[value] = true; return true; })',
        '      .sort();',
        '  }',
        '  var _requiredBootModules = _mergeBootList(_previousBootModules.required, _nextBootModules.required);',
        '  var _optionalBootModules = _mergeBootList(_previousBootModules.optional, _nextBootModules.optional)',
        '    .filter(function(value) { return _requiredBootModules.indexOf(value) < 0; });',
        '  var _optionalBootGroups = Object.assign({}, _previousBootModules.optionalGroups || {});',
        '  Object.keys(_nextBootModules.optionalGroups || {}).forEach(function(group) {',
        '    _optionalBootGroups[group] = _mergeBootList(_optionalBootGroups[group], _nextBootModules.optionalGroups[group]);',
        '  });',
        '  window.__CARD_REVERSI_BOOT_MODULES__ = {',
        '    required: _requiredBootModules,',
        '    optional: _optionalBootModules,',
        '    optionalPrefixes: _mergeBootList(_previousBootModules.optionalPrefixes, _nextBootModules.optionalPrefixes),',
        '    optionalGroups: _optionalBootGroups',
        '  };',
        ''
    ];
}

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

function hasRootSourceForDistModule(rootDir: string, rel: string): boolean {
    const rootJsPath = path.join(rootDir, rel);
    if (fs.existsSync(rootJsPath)) return true;
    const rootTsPath = rootJsPath.replace(/\.js$/, '.ts');
    return fs.existsSync(rootTsPath);
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
        .replace(/(?:const|let|var)\s+_require\s*=\s*\(?typeof\s+__non_webpack_require__[\s\S]*?;\s*/g, '');
    transformed = 'var __cjsDir=' + JSON.stringify(cjsDir) + ';var _require=function(id){return window.require(id,__cjsDir);};var require=_require;var __require=_require;\n' + transformed;
    const jsonEncoded = JSON.stringify(transformed);
    lines.push('  _r(' + JSON.stringify(moduleKey) + ', ' + jsonEncoded + ');');
    lines.push('');
}

function appendRegisteredAlias(lines: string[], aliasKey: string, targetKey: string): void {
    if (!aliasKey || !targetKey || aliasKey === targetKey) return;
    lines.push('  _a(' + JSON.stringify(aliasKey) + ', ' + JSON.stringify(targetKey) + ');');
    lines.push('');
}

function appendRegisteredModuleWithJsAlias(lines: string[], moduleKey: string, content: string): void {
    appendRegisteredModule(lines, moduleKey, content);
    if (!moduleKey.endsWith('.js')) {
        appendRegisteredAlias(lines, moduleKey + '.js', moduleKey);
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

function collectRecordKeys(record: RegistryModuleRecord): string[] {
    return [record.moduleKey].concat(record.aliases || []);
}

function extractLiteralModuleDependencies(content: string): string[] {
    const dependencies = new Set<string>();
    const pattern = /(?:\b_require|\brequire|\b__require)\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(String(content || ''))) !== null) {
        if (match[2]) dependencies.add(match[2]);
    }
    return Array.from(dependencies).sort();
}

function resolveRegistryDependencyKey(
    fromModuleKey: string,
    dependencyId: string,
    registeredModuleKeys: Set<string>
): string | null {
    const rawId = String(dependencyId || '').trim().replace(/\\/g, '/');
    if (!rawId) return null;
    const candidate = rawId.startsWith('.')
        ? path.posix.normalize(path.posix.join(path.posix.dirname(fromModuleKey), rawId))
        : rawId;
    const normalized = normalizeBootModuleKey(candidate);
    if (registeredModuleKeys.has(normalized)) return normalized;
    return null;
}

function isRegistryLocalDependencyId(dependencyId: string): boolean {
    const normalized = String(dependencyId || '').trim().replace(/\\/g, '/');
    return normalized.startsWith('.') || normalized.startsWith('dist/');
}

function createEmptyGroupSetRecord(): Record<OptionalRuntimeGroup, Set<string>> {
    return OPTIONAL_RUNTIME_GROUPS.reduce((result, group) => {
        result[group] = new Set<string>();
        return result;
    }, {} as Record<OptionalRuntimeGroup, Set<string>>);
}

function buildOptionalGroupClosures(records: RegistryModuleRecord[]): Record<OptionalRuntimeGroup, Set<string>> {
    const recordByKey = new Map<string, RegistryModuleRecord>();
    for (const record of records) recordByKey.set(normalizeBootModuleKey(record.moduleKey), record);
    const registeredModuleKeys = new Set<string>(recordByKey.keys());
    const groups = createEmptyGroupSetRecord();

    for (const record of records) {
        const normalized = normalizeBootModuleKey(record.moduleKey);
        const owner = classifyBrowserOptionalGroup(normalized);
        if (owner) groups[owner].add(normalized);
    }
    for (const group of OPTIONAL_RUNTIME_GROUPS) {
        if (groups[group].size === 0) continue;
        for (const dependency of OPTIONAL_GROUP_DEPENDENCY_OVERRIDES[group] || []) {
            const normalized = normalizeBootModuleKey(dependency);
            if (!recordByKey.has(normalized)) {
                throw new Error(`[module-registry] optional group ${group} override is missing: ${normalized}`);
            }
            if (classifyBrowserBootModule(normalized) === 'optional') groups[group].add(normalized);
        }

        const queue = Array.from(groups[group]);
        for (let index = 0; index < queue.length; index += 1) {
            const moduleKey = queue[index];
            const record = recordByKey.get(moduleKey);
            if (!record) continue;
            for (const dependencyId of extractLiteralModuleDependencies(record.content)) {
                const dependencyKey = resolveRegistryDependencyKey(moduleKey, dependencyId, registeredModuleKeys);
                if (!dependencyKey && isRegistryLocalDependencyId(dependencyId)) {
                    throw new Error(`[module-registry] optional group ${group} has unresolved local dependency: ${moduleKey} -> ${dependencyId}`);
                }
                if (!dependencyKey || classifyBrowserBootModule(dependencyKey) !== 'optional') continue;
                if (!groups[group].has(dependencyKey)) {
                    groups[group].add(dependencyKey);
                    queue.push(dependencyKey);
                }
            }
        }
    }

    // Guard the generated contract itself: every resolvable optional literal dependency must
    // travel with the group, even when its canonical owner is another optional feature.
    for (const group of OPTIONAL_RUNTIME_GROUPS) {
        for (const moduleKey of groups[group]) {
            const record = recordByKey.get(moduleKey);
            if (!record) continue;
            for (const dependencyId of extractLiteralModuleDependencies(record.content)) {
                const dependencyKey = resolveRegistryDependencyKey(moduleKey, dependencyId, registeredModuleKeys);
                if (!dependencyKey && isRegistryLocalDependencyId(dependencyId)) {
                    throw new Error(`[module-registry] optional group ${group} has unresolved local dependency: ${moduleKey} -> ${dependencyId}`);
                }
                if (
                    dependencyKey
                    && classifyBrowserBootModule(dependencyKey) === 'optional'
                    && !groups[group].has(dependencyKey)
                ) {
                    throw new Error(`[module-registry] optional group ${group} is not closed: ${moduleKey} -> ${dependencyKey}`);
                }
            }
        }
    }
    return groups;
}

function getOptionalGroupOutFile(groupOutDir: string, group: OptionalRuntimeGroup): string {
    return path.join(groupOutDir, `module-registry.optional.${group}.js`);
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

function createRegistryPreamble(): string[] {
    return [
        '// Auto-generated module registry. Do not edit.',
        '// Generated by scripts/build-module-registry.ts',
        '(function() {',
        '  var _r = window.__cjsRegister;',
        '  var _a = window.__cjsAlias;',
        '  if (!_r) throw new Error("[cjs] runtime.js must load before module-registry.js");',
        '  if (!_a) throw new Error("[cjs] runtime.js must support module aliases");',
        ''
    ];
}

function finalizeRegistryContent(lines: string[]): string {
    const out = lines.slice();
    out.push('})();');
    out.push('');
    return out.join('\n');
}

function buildRegistry(options?: BuildRegistryOptions): BuildRegistryResult | null {
    const opts = (options && typeof options === 'object') ? options : {};
    const rootDir = opts.rootDir ? path.resolve(String(opts.rootDir)) : ROOT;
    const distDir = opts.distDir ? path.resolve(String(opts.distDir)) : path.join(rootDir, 'dist');
    const outFile = opts.outFile ? path.resolve(String(opts.outFile)) : path.join(rootDir, 'public', 'module-registry.js');
    const optionalOutFile = opts.optionalOutFile
        ? path.resolve(String(opts.optionalOutFile))
        : path.join(path.dirname(outFile), 'module-registry.optional.js');
    const groupOutDir = opts.groupOutDir
        ? path.resolve(String(opts.groupOutDir))
        : path.dirname(optionalOutFile);
    const shouldSplitRegistries = opts.splitRegistries !== false;
    const shouldWrite = opts.write !== false;
    const shouldLog = opts.log !== false;
    const shouldSyncScriptVersions = opts.syncScriptVersions !== false;
    if (!fs.existsSync(distDir)) {
        return null;
    }
    const jsFiles: string[] = [];
    walkDir(distDir, distDir, jsFiles);
    jsFiles.sort();

    const lines: string[] = createRegistryPreamble();
    const startupLines: string[] = createRegistryPreamble();
    const optionalLines: string[] = createRegistryPreamble();
    const bootMetadataInsertIndex = lines.length;
    const startupBootMetadataInsertIndex = startupLines.length;
    const optionalBootMetadataInsertIndex = optionalLines.length;
    const moduleRecords: RegistryModuleRecord[] = [];

    const skipped: string[] = [];
    const registeredKeys = new Set<string>();
    const startupRegisteredKeys = new Set<string>();
    const optionalRegisteredKeys = new Set<string>();

    for (const rel of jsFiles) {
        if (!isBrowserModule(rel)) {
            skipped.push(rel + ' (non-browser)');
            continue;
        }
        if (!hasRootSourceForDistModule(rootDir, rel)) {
            skipped.push(rel + ' (stale dist output)');
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
        moduleRecords.push({ moduleKey, content, aliases: [moduleKey + '.js'] });
        const bootClass = classifyBrowserBootModule(moduleKey);
        const bootLines = bootClass === 'optional' ? optionalLines : startupLines;
        const bootKeys = bootClass === 'optional' ? optionalRegisteredKeys : startupRegisteredKeys;
        appendRegisteredModuleWithJsAlias(bootLines, moduleKey, content);
        bootKeys.add(moduleKey);
        if (!moduleKey.endsWith('.js')) {
            bootKeys.add(moduleKey + '.js');
        }
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
        moduleRecords.push({ moduleKey: extra.key, content, aliases: (extra.aliases || []).slice() });
        registeredKeys.add(extra.key);
        const bootClass = classifyBrowserBootModule(extra.key);
        const bootLines = bootClass === 'optional' ? optionalLines : startupLines;
        const bootKeys = bootClass === 'optional' ? optionalRegisteredKeys : startupRegisteredKeys;
        appendRegisteredModule(bootLines, extra.key, content);
        bootKeys.add(extra.key);
        for (const alias of extra.aliases || []) {
            appendRegisteredAlias(lines, alias, extra.key);
            registeredKeys.add(alias);
            appendRegisteredAlias(bootLines, alias, extra.key);
            bootKeys.add(alias);
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
        moduleRecords.push({ moduleKey, content, aliases: [moduleKey + '.js'] });
        registeredKeys.add(moduleKey);
        registeredKeys.add(moduleKey + '.js');
        const bootClass = classifyBrowserBootModule(moduleKey);
        const bootLines = bootClass === 'optional' ? optionalLines : startupLines;
        const bootKeys = bootClass === 'optional' ? optionalRegisteredKeys : startupRegisteredKeys;
        appendRegisteredModuleWithJsAlias(bootLines, moduleKey, content);
        bootKeys.add(moduleKey);
        bootKeys.add(moduleKey + '.js');
    }

    const optionalGroupClosures = buildOptionalGroupClosures(moduleRecords);
    const groupLines = {} as Record<OptionalRuntimeGroup, string[]>;
    const groupRegisteredKeys = createEmptyGroupSetRecord();
    for (const group of OPTIONAL_RUNTIME_GROUPS) groupLines[group] = createRegistryPreamble();
    for (const record of moduleRecords) {
        const normalized = normalizeBootModuleKey(record.moduleKey);
        for (const group of OPTIONAL_RUNTIME_GROUPS) {
            if (!optionalGroupClosures[group].has(normalized)) continue;
            appendRegisteredModule(groupLines[group], record.moduleKey, record.content);
            groupRegisteredKeys[group].add(record.moduleKey);
            for (const alias of record.aliases) {
                appendRegisteredAlias(groupLines[group], alias, record.moduleKey);
                groupRegisteredKeys[group].add(alias);
            }
        }
    }

    lines.splice(bootMetadataInsertIndex, 0, ...createBootModuleMetadataLines(registeredKeys, optionalGroupClosures));
    startupLines.splice(startupBootMetadataInsertIndex, 0, ...createBootModuleMetadataLines(startupRegisteredKeys, optionalGroupClosures));
    optionalLines.splice(optionalBootMetadataInsertIndex, 0, ...createBootModuleMetadataLines(optionalRegisteredKeys, optionalGroupClosures));
    for (const group of OPTIONAL_RUNTIME_GROUPS) {
        groupLines[group].splice(
            createRegistryPreamble().length,
            0,
            ...createBootModuleMetadataLines(groupRegisteredKeys[group], { [group]: optionalGroupClosures[group] })
        );
    }

    const content = finalizeRegistryContent(lines);
    const startupContent = finalizeRegistryContent(startupLines);
    const optionalContent = finalizeRegistryContent(optionalLines);
    const groupContents = {} as Record<OptionalRuntimeGroup, string>;
    const groupOutFiles = {} as Record<OptionalRuntimeGroup, string>;
    const wroteGroupFiles = {} as Record<OptionalRuntimeGroup, boolean>;
    for (const group of OPTIONAL_RUNTIME_GROUPS) {
        groupContents[group] = finalizeRegistryContent(groupLines[group]);
        groupOutFiles[group] = getOptionalGroupOutFile(groupOutDir, group);
        wroteGroupFiles[group] = false;
    }
    let wroteFile = false;
    let wroteOptionalFile = false;
    if (shouldWrite) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        const mainContent = shouldSplitRegistries ? startupContent : content;
        const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null;
        if (current !== mainContent) {
            writeFileWithRetry(outFile, mainContent);
            wroteFile = true;
        }
        if (shouldSplitRegistries) {
            fs.mkdirSync(path.dirname(optionalOutFile), { recursive: true });
            const currentOptional = fs.existsSync(optionalOutFile) ? fs.readFileSync(optionalOutFile, 'utf8') : null;
            if (currentOptional !== optionalContent) {
                writeFileWithRetry(optionalOutFile, optionalContent);
                wroteOptionalFile = true;
            }
            for (const group of OPTIONAL_RUNTIME_GROUPS) {
                const groupOutFile = groupOutFiles[group];
                fs.mkdirSync(path.dirname(groupOutFile), { recursive: true });
                const currentGroup = fs.existsSync(groupOutFile) ? fs.readFileSync(groupOutFile, 'utf8') : null;
                if (currentGroup !== groupContents[group]) {
                    writeFileWithRetry(groupOutFile, groupContents[group]);
                    wroteGroupFiles[group] = true;
                }
            }
        }
        if (shouldSyncScriptVersions && fs.existsSync(path.join(rootDir, 'index.html'))) {
            syncBrowserScriptVersions({ rootDir, write: true });
        }
    }

    if (shouldLog) {
        const suffix = shouldSplitRegistries
            ? ' plus ' + path.relative(rootDir, optionalOutFile) + ' and ' + OPTIONAL_RUNTIME_GROUPS.length + ' group registries'
            : '';
        console.log('[module-registry] wrote ' + jsFiles.length + ' modules to ' + path.relative(rootDir, outFile) + suffix);
        if (skipped.length > 0) {
            console.log('[module-registry] skipped ' + skipped.length + ' files:');
            skipped.forEach(s => {
                console.log('  - ' + s);
            });
        }
    }

    return {
        content,
        startupContent,
        optionalContent,
        outFile,
        optionalOutFile,
        groupContents,
        groupOutFiles,
        wroteFile,
        wroteOptionalFile,
        wroteGroupFiles
    };
}

if (require.main === module) {
    buildRegistry();
}

export = {
    buildRegistry,
    classifyBrowserBootModule,
    classifyBrowserOptionalGroup,
    OPTIONAL_RUNTIME_GROUPS
};
