import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function toWorkerImportPath(cardLogicImportPath: string): string {
  return `../game/logic/${cardLogicImportPath.slice('./'.length)}.js`;
}

function toRuntimePreloadImportPathFromTurnPhase(requirePath: string): string {
  if (requirePath.startsWith('./')) return `../game/turn/${requirePath.slice('./'.length)}.js`;
  if (requirePath.startsWith('../logic/')) return `../game/logic/${requirePath.slice('../logic/'.length)}.js`;
  if (requirePath === '../../shared-constants') return '../shared-constants.js';
  if (requirePath.startsWith('../../shared/')) return `../shared/${requirePath.slice('../../shared/'.length)}.js`;
  if (requirePath.startsWith('../../utils/')) return `../utils/${requirePath.slice('../../utils/'.length)}.js`;
  throw new Error(`Unhandled turn phase require path: ${requirePath}`);
}

function toRuntimePreloadImportPathFromPipelineUIAdapter(requirePath: string): string {
  if (requirePath.startsWith('./pipeline-ui/')) return `../game/turn/pipeline-ui/${requirePath.slice('./pipeline-ui/'.length)}.js`;
  if (requirePath.startsWith('./')) return `../game/turn/${requirePath.slice('./'.length)}.js`;
  if (requirePath.startsWith('../logic/')) return `../game/logic/${requirePath.slice('../logic/'.length)}.js`;
  if (requirePath === '../controller-events') return '../game/controller-events.js';
  if (requirePath.startsWith('../../shared/')) return `../shared/${requirePath.slice('../../shared/'.length)}.js`;
  if (requirePath.startsWith('../../utils/')) return `../utils/${requirePath.slice('../../utils/'.length)}.js`;
  throw new Error(`Unhandled pipeline UI adapter require path: ${requirePath}`);
}

function expectRuntimePreloadRegistration(runtimePreloadSource: string, globalKey: string, importPath: string): void {
  expect(runtimePreloadSource).toContain(`installRuntimeModule('${globalKey}'`);
  expect(runtimePreloadSource).toContain(`require('${importPath}')`);
}

function extractStringLiteralMap(source: string, startToken: string, endToken: string): Map<string, string> {
  const blockStart = source.indexOf(startToken);
  const blockEnd = source.indexOf(endToken);
  const globalsBlock = source.slice(blockStart, blockEnd);
  return new Map(Array.from(globalsBlock.matchAll(
    /'([^']+)':\s*'([^']+)'/g
  )).map((match) => [match[1], match[2]]));
}

describe('match worker card preload', () => {
  test('preloads every cards-internal dependency required by game/logic/cards', () => {
    const cardLogicSource = readRepoFile('game/logic/cards.ts');
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const dependencies = Array.from(cardLogicSource.matchAll(
      /resolveCardLogicModuleOrGlobal\('(\.\/cards-internal\/[^']+)',\s*'([^']+)'\)/g
    )).map((match) => ({
      importPath: toWorkerImportPath(match[1]),
      globalKey: match[2]
    }));

    expect(dependencies.length).toBeGreaterThan(0);
    for (const dependency of dependencies) {
      expect(workerSource).toContain(`'${dependency.importPath}':`);
      expect(workerSource).toContain(`['${dependency.importPath}', '${dependency.globalKey}']`);
      expectRuntimePreloadRegistration(runtimePreloadSource, dependency.globalKey, dependency.importPath);
    }
  });

  test('runtime preload exposes every required card module resolved by game/logic/cards', () => {
    const cardLogicSource = readRepoFile('game/logic/cards.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const dependencies = Array.from(cardLogicSource.matchAll(
      /resolveRequiredCardModule\('(\.\/[^']+)',\s*'([^']+)'\)/g
    )).map((match) => ({
      importPath: toWorkerImportPath(match[1]),
      globalKey: match[2]
    }));

    expect(dependencies.length).toBeGreaterThan(0);
    for (const dependency of dependencies) {
      expectRuntimePreloadRegistration(runtimePreloadSource, dependency.globalKey, dependency.importPath);
    }
  });

  test('runtime preload exposes every turn pipeline phase fallback module', () => {
    const turnPhaseSource = readRepoFile('game/turn/turn_pipeline_phases.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const moduleGlobals = extractStringLiteralMap(
      turnPhaseSource,
      'TURN_PIPELINE_PHASE_MODULE_GLOBALS',
      'function getRuntimeModuleGlobal'
    );
    const dependencies = Array.from(moduleGlobals.entries()).map(([requirePath, globalKey]) => ({
      importPath: toRuntimePreloadImportPathFromTurnPhase(requirePath),
      globalKey
    }));
    const requirePaths = Array.from(turnPhaseSource.matchAll(/requireOptionalModule\('([^']+)'\)/g)).map((match) => match[1]);

    expect(dependencies.length).toBeGreaterThan(0);
    for (const requirePath of requirePaths) {
      expect(moduleGlobals.has(requirePath)).toBe(true);
    }
    for (const dependency of dependencies) {
      expectRuntimePreloadRegistration(runtimePreloadSource, dependency.globalKey, dependency.importPath);
    }
  });

  test('turn pipeline optional modules are statically loadable for workerd bundles', () => {
    const turnPhaseSource = readRepoFile('game/turn/turn_pipeline_phases.ts');
    const loaderBlock = turnPhaseSource.slice(
      turnPhaseSource.indexOf('TURN_PIPELINE_PHASE_STATIC_MODULE_LOADERS'),
      turnPhaseSource.indexOf('function getRuntimeModuleGlobal')
    );
    const requirePaths = Array.from(turnPhaseSource.matchAll(/requireOptionalModule\('([^']+)'\)/g)).map((match) => match[1]);

    expect(loaderBlock.length).toBeGreaterThan(0);
    expect(requirePaths.length).toBeGreaterThan(0);
    for (const requirePath of requirePaths) {
      expect(loaderBlock).toContain(`'${requirePath}': () => require('${requirePath}')`);
    }
  });

  test('runtime preload exposes nested turn-start marker phase modules', () => {
    const markerPhaseSource = readRepoFile('game/turn/turn-start/marker-phase.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const dependencies = Array.from(markerPhaseSource.matchAll(
      /requireTurnStartModule\('(\.\/[^']+)',\s*'([^']+)'\)/g
    )).map((match) => ({
      importPath: `../game/turn/turn-start/${match[1].slice('./'.length)}.js`,
      globalKey: match[2]
    }));

    expect(dependencies.length).toBeGreaterThan(0);
    for (const dependency of dependencies) {
      expectRuntimePreloadRegistration(runtimePreloadSource, dependency.globalKey, dependency.importPath);
    }
  });

  test('runtime preload exposes every pipeline UI adapter fallback module', () => {
    const pipelineUIAdapterSource = readRepoFile('game/turn/pipeline_ui_adapter.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const moduleGlobals = extractStringLiteralMap(
      pipelineUIAdapterSource,
      'PIPELINE_UI_ADAPTER_MODULE_GLOBALS',
      'function requireOptionalModule'
    );
    const dependencies = Array.from(moduleGlobals.entries()).map(([requirePath, globalKey]) => ({
      importPath: toRuntimePreloadImportPathFromPipelineUIAdapter(requirePath),
      globalKey
    }));
    const requirePaths = Array.from(pipelineUIAdapterSource.matchAll(/requireOptionalModule\('([^']+)'\)/g)).map((match) => match[1]);

    expect(dependencies.length).toBeGreaterThan(0);
    for (const requirePath of requirePaths) {
      expect(moduleGlobals.has(requirePath)).toBe(true);
    }
    for (const dependency of dependencies) {
      expectRuntimePreloadRegistration(runtimePreloadSource, dependency.globalKey, dependency.importPath);
    }
  });

  test('runtime preload exposes nested pipeline UI modules', () => {
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const nestedSources = [
      {
        source: readRepoFile('game/turn/pipeline-ui/generated-throw-chain-playback.ts'),
        basePath: '../game/turn/pipeline-ui/'
      },
      {
        source: readRepoFile('game/turn/pipeline-ui/sound-cue-assembler.ts'),
        basePath: '../game/turn/pipeline-ui/'
      }
    ];
    const dependencies = nestedSources.flatMap(({ source, basePath }) => Array.from(source.matchAll(
      /requirePipelineUIModule\('(\.\/[^']+)',\s*'([^']+)'\)/g
    )).map((match) => ({
      importPath: `${basePath}${match[1].slice('./'.length)}.js`,
      globalKey: match[2]
    })));

    expect(dependencies.length).toBeGreaterThan(0);
    for (const dependency of dependencies) {
      expectRuntimePreloadRegistration(runtimePreloadSource, dependency.globalKey, dependency.importPath);
    }
  });
});
