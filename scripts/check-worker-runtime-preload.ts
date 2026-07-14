import * as fs from 'fs';
import * as path from 'path';

const ROOT = fs.existsSync(path.join(process.cwd(), 'wrangler.toml'))
    ? process.cwd()
    : path.resolve(__dirname, '..', '..');
const RUNTIME_PRELOAD_PATH = 'workers/match-worker-runtime-preload.ts';
const WORKER_PATH = 'workers/match-worker.ts';

interface RuntimeModuleRegistration {
    globalKey: string;
    importPath: string;
}

const WORKER_GRAPH_ENTRY_PATHS = Object.freeze([
    'workers/match-worker.ts',
    'workers/match-worker-runtime-preload.ts'
]);

function collectStaticModuleSpecifiers(source: string): string[] {
    const specifiers: string[] = [];
    for (const pattern of [
        /\bimport\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
        /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
    ]) {
        for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
    }
    return Array.from(new Set(specifiers));
}

function resolveSourceImport(rootDir: string, importerRelativePath: string, specifier: string): string | null {
    if (!specifier.startsWith('.')) return null;
    const importerDir = path.posix.dirname(importerRelativePath.replace(/\\/g, '/'));
    const base = path.posix.normalize(path.posix.join(importerDir, specifier));
    const candidates = [base];
    if (/\.m?js$/i.test(base)) candidates.push(base.replace(/\.m?js$/i, '.ts'));
    if (!path.posix.extname(base)) {
        candidates.push(`${base}.ts`, `${base}.js`, `${base}/index.ts`, `${base}/index.js`);
    }
    for (const candidate of candidates) {
        const normalized = candidate.replace(/^\.\//, '');
        const absolute = path.resolve(rootDir, normalized);
        const relative = path.relative(rootDir, absolute);
        if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
        if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
            return relative.split(path.sep).join('/');
        }
    }
    return null;
}

function assertWorkerGraphHasNoPixi(
    rootDir: string = ROOT,
    entryPaths: readonly string[] = WORKER_GRAPH_ENTRY_PATHS
): string[] {
    const visited = new Set<string>();
    const queue = entryPaths.map((entry) => entry.replace(/\\/g, '/'));
    const failures: string[] = [];
    while (queue.length) {
        const relativePath = queue.shift()!;
        if (visited.has(relativePath)) continue;
        visited.add(relativePath);
        const absolutePath = path.join(rootDir, relativePath);
        if (!fs.existsSync(absolutePath)) {
            failures.push(`worker graph source missing: ${relativePath}`);
            continue;
        }
        const source = fs.readFileSync(absolutePath, 'utf8');
        for (const specifier of collectStaticModuleSpecifiers(source)) {
            if (specifier === 'pixi.js' || specifier.startsWith('pixi.js/')) {
                failures.push(`Worker runtime imports PixiJS: ${relativePath} -> ${specifier}`);
            }
            const resolved = resolveSourceImport(rootDir, relativePath, specifier);
            if (!resolved) continue;
            if (resolved.includes('/ui/pixi/') || resolved.startsWith('ui/pixi/')) {
                failures.push(`Worker runtime reaches browser Pixi module: ${relativePath} -> ${resolved}`);
            }
            if (!visited.has(resolved)) queue.push(resolved);
        }
    }
    if (failures.length) {
        throw new Error(`[worker-runtime-preload] ${failures.join('\n[worker-runtime-preload] ')}`);
    }
    return Array.from(visited).sort();
}

function readRepoFile(relativePath: string): string {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function collectRuntimePreloadRegistrations(source: string): RuntimeModuleRegistration[] {
    return Array.from(source.matchAll(
        /installRuntimeModule\('([^']+)',\s*\(\)\s*=>\s*require\('([^']+)'\)\)/g
    )).map((match) => ({
        globalKey: match[1],
        importPath: match[2]
    }));
}

export function checkWorkerRuntimePreload(): void {
    const runtimePreload = collectRuntimePreloadRegistrations(readRepoFile(RUNTIME_PRELOAD_PATH));
    const workerSource = readRepoFile(WORKER_PATH);
    const failures: string[] = [];
    const workerGraph = assertWorkerGraphHasNoPixi(ROOT);
    const globalKeys = new Set<string>();
    const importPaths = new Set<string>();

    if (runtimePreload.length === 0) {
        failures.push(`${RUNTIME_PRELOAD_PATH} has no static runtime registrations`);
    }
    for (const registration of runtimePreload) {
        if (globalKeys.has(registration.globalKey)) {
            failures.push(`duplicate runtime global: ${registration.globalKey}`);
        }
        if (importPaths.has(registration.importPath)) {
            failures.push(`duplicate runtime import: ${registration.importPath}`);
        }
        globalKeys.add(registration.globalKey);
        importPaths.add(registration.importPath);
    }

    for (const requiredGlobal of ['NetworkActionSchema', 'PlaybackEventHelpers', 'TurnSubPlacementContinuation']) {
        if (!globalKeys.has(requiredGlobal)) {
            failures.push(`runtime preload missing entrypoint dependency: ${requiredGlobal}`);
        }
    }

    if (!workerSource.includes("import { WORKER_RUNTIME_GLOBAL_KEYS } from './match-worker-runtime-preload.js';")) {
        failures.push(`${WORKER_PATH} must consume WORKER_RUNTIME_GLOBAL_KEYS`);
    }
    if (!workerSource.includes('WORKER_RUNTIME_GLOBAL_KEYS.filter(')) {
        failures.push(`${WORKER_PATH} must validate every registered runtime global`);
    }
    for (const forbiddenPattern of [
        'WORKER_PRELOAD_MODULE_LOADERS',
        'WORKER_PRELOAD_MODULE_CACHE',
        'loadWorkerPreloadModule(',
        'importWorkerGlobal('
    ]) {
        if (workerSource.includes(forbiddenPattern)) {
            failures.push(`${WORKER_PATH} duplicates runtime preload ownership: ${forbiddenPattern}`);
        }
    }

    if (failures.length > 0) {
        throw new Error(`[worker-runtime-preload] ${failures.join('\n[worker-runtime-preload] ')}`);
    }

    console.log(`[worker-runtime-preload] single source verified registrations=${runtimePreload.length} pixiExcludedGraphFiles=${workerGraph.length}`);
}

export { assertWorkerGraphHasNoPixi, collectStaticModuleSpecifiers, resolveSourceImport };

if (require.main === module) {
    try {
        checkWorkerRuntimePreload();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    }
}
