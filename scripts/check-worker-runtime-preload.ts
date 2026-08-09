import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

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
const REQUIRED_BOARD_CONTRACT_STATIC_CHAIN = Object.freeze([
    'utils/match-authority.ts',
    'shared/shared-board-utils.ts',
    'shared/board/state-kernel.ts'
]);
const REQUIRED_RUNTIME_REGISTRATION_ORDER = Object.freeze([
    ['PlayerSeatContract', 'OwnerHelpers'],
    ['SharedConstants', 'CardUtils'],
    ['SpecialStoneRegistry', 'CardUtils'],
    ['ManifestStoneRegistry', 'CardUtils'],
    ['SharedBoardUtils', 'CardUtils'],
    ['OwnerHelpers', 'CardUtils'],
    ['MarkersAdapter', 'CardMarkers'],
    ['CardUtils', 'CardMarkers'],
    ['CardMarkers', 'CardMeteorGod'],
    ['CardMarkers', 'CardSniper'],
    ['CardMarkers', 'CardLightning'],
    ['CardMarkers', 'CardDestroyDragon']
] as const);

function collectModuleSpecifiers(source: string, includeDynamicImports: boolean): string[] {
    const specifiers: string[] = [];
    const sourceFile = ts.createSourceFile(
        'worker-runtime-source.ts',
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
    );
    const collectLiteral = (value: ts.Expression | undefined): void => {
        if (value && ts.isStringLiteralLike(value)) specifiers.push(value.text);
    };
    const isTypeOnlyImport = (node: ts.ImportDeclaration): boolean => {
        const clause = node.importClause;
        if (!clause) return false;
        if (clause.isTypeOnly) return true;
        if (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
            return false;
        }
        return clause.namedBindings.elements.length > 0
            && clause.namedBindings.elements.every((element) => element.isTypeOnly);
    };
    const isTypeOnlyExport = (node: ts.ExportDeclaration): boolean => {
        if (node.isTypeOnly) return true;
        return !!node.exportClause
            && ts.isNamedExports(node.exportClause)
            && node.exportClause.elements.length > 0
            && node.exportClause.elements.every((element) => element.isTypeOnly);
    };
    const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && !isTypeOnlyImport(node)) {
            collectLiteral(node.moduleSpecifier);
        } else if (ts.isExportDeclaration(node) && !isTypeOnlyExport(node)) {
            collectLiteral(node.moduleSpecifier);
        } else if (
            ts.isImportEqualsDeclaration(node)
            && !node.isTypeOnly
            && ts.isExternalModuleReference(node.moduleReference)
        ) {
            collectLiteral(node.moduleReference.expression);
        } else if (
            ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === 'require'
            && node.arguments.length === 1
        ) {
            collectLiteral(node.arguments[0]);
        } else if (
            includeDynamicImports
            && ts.isCallExpression(node)
            && node.expression.kind === ts.SyntaxKind.ImportKeyword
            && node.arguments.length >= 1
        ) {
            collectLiteral(node.arguments[0]);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return Array.from(new Set(specifiers));
}

function collectGraphModuleSpecifiers(source: string): string[] {
    return collectModuleSpecifiers(source, true);
}

function collectEagerModuleSpecifiers(source: string): string[] {
    return collectModuleSpecifiers(source, false);
}

function collectStaticModuleSpecifiers(source: string): string[] {
    return collectGraphModuleSpecifiers(source);
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
        for (const specifier of collectGraphModuleSpecifiers(source)) {
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

function assertStaticDependencyChain(
    rootDir: string,
    chain: readonly string[]
): void {
    for (let index = 0; index < chain.length - 1; index += 1) {
        const importer = chain[index].replace(/\\/g, '/');
        const expectedDependency = chain[index + 1].replace(/\\/g, '/');
        const absoluteImporter = path.join(rootDir, importer);
        if (!fs.existsSync(absoluteImporter)) {
            throw new Error(`[worker-runtime-preload] static dependency source missing: ${importer}`);
        }
        const resolvedDependencies = collectEagerModuleSpecifiers(
            fs.readFileSync(absoluteImporter, 'utf8')
        ).map((specifier) => resolveSourceImport(rootDir, importer, specifier));
        if (!resolvedDependencies.includes(expectedDependency)) {
            throw new Error(
                `[worker-runtime-preload] required static dependency missing: ${importer} -> ${expectedDependency}`
            );
        }
    }
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

function assertRuntimeRegistrationOrder(
    registrations: readonly RuntimeModuleRegistration[],
    requiredOrder: readonly (readonly [string, string])[] = REQUIRED_RUNTIME_REGISTRATION_ORDER
): void {
    const indexByGlobalKey = new Map<string, number>();
    registrations.forEach((registration, index) => {
        indexByGlobalKey.set(registration.globalKey, index);
    });
    const failures: string[] = [];
    for (const [dependency, consumer] of requiredOrder) {
        const dependencyIndex = indexByGlobalKey.get(dependency);
        const consumerIndex = indexByGlobalKey.get(consumer);
        if (typeof dependencyIndex !== 'number' || typeof consumerIndex !== 'number') {
            failures.push(`required runtime order entry missing: ${dependency} -> ${consumer}`);
            continue;
        }
        if (dependencyIndex >= consumerIndex) {
            failures.push(`runtime dependency must preload first: ${dependency} -> ${consumer}`);
        }
    }
    if (failures.length > 0) {
        throw new Error(`[worker-runtime-preload] ${failures.join('\n[worker-runtime-preload] ')}`);
    }
}

export function checkWorkerRuntimePreload(): void {
    const runtimePreload = collectRuntimePreloadRegistrations(readRepoFile(RUNTIME_PRELOAD_PATH));
    const workerSource = readRepoFile(WORKER_PATH);
    const failures: string[] = [];
    const workerGraph = assertWorkerGraphHasNoPixi(ROOT);
    assertStaticDependencyChain(ROOT, REQUIRED_BOARD_CONTRACT_STATIC_CHAIN);
    assertRuntimeRegistrationOrder(runtimePreload);
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

export {
    assertRuntimeRegistrationOrder,
    assertStaticDependencyChain,
    assertWorkerGraphHasNoPixi,
    collectEagerModuleSpecifiers,
    collectGraphModuleSpecifiers,
    collectRuntimePreloadRegistrations,
    collectStaticModuleSpecifiers,
    resolveSourceImport
};

if (require.main === module) {
    try {
        checkWorkerRuntimePreload();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    }
}
