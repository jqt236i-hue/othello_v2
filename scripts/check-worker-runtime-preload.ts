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

    console.log(`[worker-runtime-preload] single source verified registrations=${runtimePreload.length}`);
}

if (require.main === module) {
    try {
        checkWorkerRuntimePreload();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    }
}
