import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function getStaticImportPaths(source: string): string[] {
  return Array.from(source.matchAll(/import\s+[^;=]+?=\s*require\('([^']+)'\)/g))
    .map((match) => match[1]);
}

function expectStaticImportsResolve(sourcePath: string): string[] {
  const source = readRepoFile(sourcePath);
  const importPaths = getStaticImportPaths(source);
  expect(importPaths.length).toBeGreaterThan(0);
  for (const importPath of importPaths) {
    if (!importPath.startsWith('.')) continue;
    const basePath = path.resolve(ROOT, path.dirname(sourcePath), importPath);
    expect(
      fs.existsSync(`${basePath}.ts`)
      || fs.existsSync(`${basePath}.js`)
      || fs.existsSync(path.join(basePath, 'index.ts'))
      || fs.existsSync(path.join(basePath, 'index.js'))
    ).toBe(true);
  }
  return importPaths;
}

function toRuntimePreloadImportPathFromPipelineUIAdapter(requirePath: string): string {
  if (requirePath.startsWith('./pipeline-ui/')) return `../game/turn/pipeline-ui/${requirePath.slice('./pipeline-ui/'.length)}.js`;
  if (requirePath.startsWith('./')) return `../game/turn/${requirePath.slice('./'.length)}.js`;
  if (requirePath.startsWith('../logic/')) return `../game/logic/${requirePath.slice('../logic/'.length)}.js`;
  if (requirePath.startsWith('../schema/')) return `../game/schema/${requirePath.slice('../schema/'.length)}.js`;
  if (requirePath === '../controller-events') return '../game/controller-events.js';
  if (requirePath.startsWith('../../shared/')) return `../shared/${requirePath.slice('../../shared/'.length)}.js`;
  if (requirePath.startsWith('../../utils/')) return `../utils/${requirePath.slice('../../utils/'.length)}.js`;
  throw new Error(`Unhandled pipeline UI adapter require path: ${requirePath}`);
}

function expectRuntimePreloadRegistration(runtimePreloadSource: string, globalKey: string, importPath: string): void {
  expect(runtimePreloadSource).toContain(`installRuntimeModule('${globalKey}'`);
  expect(runtimePreloadSource).toContain(`require('${importPath}')`);
}

function expectWorkerModuleRegistration(workerSource: string): void {
  expect(workerSource).toContain(
    "import { WORKER_RUNTIME_GLOBAL_KEYS } from './match-worker-runtime-preload.js';"
  );
  expect(workerSource).toContain('WORKER_RUNTIME_GLOBAL_KEYS.filter(');
  expect(workerSource).not.toContain('WORKER_PRELOAD_MODULE_LOADERS');
}

function extractStringLiteralMap(source: string, startToken: string, endToken: string): Map<string, string> {
  const blockStart = source.indexOf(startToken);
  const blockEnd = source.indexOf(endToken);
  const globalsBlock = source.slice(blockStart, blockEnd);
  return new Map(Array.from(globalsBlock.matchAll(
    /'([^']+)':\s*'([^']+)'/g
  )).map((match) => [match[1], match[2]]));
}

describe('match worker runtime module wiring', () => {
  test('canonical CardLogic uses a static facade and composer while compatibility globals remain preloadable', () => {
    const facadeSource = readRepoFile('game/logic/cards.ts');
    const composerSource = readRepoFile('game/logic/card-runtime-composer.ts');
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');

    expect(facadeSource).toContain("from './card-runtime-composer'");
    expect(facadeSource).toContain("require('./cards-runtime-factory')");
    expect(facadeSource).not.toMatch(/resolveCardLogicModuleOrGlobal|resolveRequiredCardModule|safeRequire/);
    expectStaticImportsResolve('game/logic/card-runtime-composer.ts');
    expect(composerSource).not.toMatch(/resolveCardLogicModuleOrGlobal|resolveRequiredCardModule|safeRequire/);
    expectWorkerModuleRegistration(workerSource);
    expectRuntimePreloadRegistration(
      runtimePreloadSource,
      'CardRandomSource',
      '../game/logic/cards-internal/random-source.js'
    );
  });

  test('card effect resolver statically imports every required stage and protection capability', () => {
    const effectResolverSource = readRepoFile('game/cards/effect-resolver.ts');
    const importPaths = expectStaticImportsResolve('game/cards/effect-resolver.ts');
    const expectedImports = [
      '../logic/cards-internal/protection-context',
      './card-usage-consumption-stage',
      './card-usage-pending-stage',
      './card-usage-immediate-stage',
      './card-usage-sacrifice-stage',
      './card-usage-presentation-stage',
      './card-usage-validation-stage'
    ];

    expect(importPaths).toEqual(expect.arrayContaining(expectedImports));
    expect(effectResolverSource).not.toMatch(/loadRuntimeModule|safeRequire|globalThis|\bself\s*\./);
  });

  test('hole-style card modules statically import the canonical cell-removal implementation', () => {
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const dependentCardSources = [
      'game/logic/cards/meteor.ts',
      'game/logic/cards/meteor_god.ts',
      'game/logic/cards/shrink.ts',
      'game/logic/cards/teleport.ts'
    ];

    for (const sourcePath of dependentCardSources) {
      const source = readRepoFile(sourcePath);
      expect(getStaticImportPaths(source)).toContain('./cell-removal');
      expect(source).not.toMatch(/safeRequire|globalThis|\bself\s*\./);
    }
    expect(fs.existsSync(path.join(ROOT, 'game/logic/cards/cell-removal.js'))).toBe(true);
    expectRuntimePreloadRegistration(
      runtimePreloadSource,
      'CardCellRemoval',
      '../game/logic/cards/cell-removal.js'
    );
  });

  test('worker exposes shared evasion status for remaining compatibility consumers', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');

    expectWorkerModuleRegistration(workerSource);
    expectRuntimePreloadRegistration(runtimePreloadSource, 'EvasionStatus', '../shared/evasion-status.js');
  });

  test('turn pipeline phases are a resolvable static import graph with no runtime fallback loader', () => {
    const turnPhaseSource = readRepoFile('game/turn/turn_pipeline_phases.ts');
    const importPaths = expectStaticImportsResolve('game/turn/turn_pipeline_phases.ts');

    expect(importPaths).toEqual(expect.arrayContaining([
      './turn_pipeline_phase_helpers',
      './pending-coordinator',
      './action-phase/place-resolution',
      './turn-start/marker-phase',
      './turn-start/timer-phase'
    ]));
    expect(turnPhaseSource).not.toMatch(
      /requireOptionalModule|TURN_PIPELINE_PHASE_MODULE_GLOBALS|TURN_PIPELINE_PHASE_STATIC_MODULE_LOADERS/
    );
  });

  test('turn-start marker phases statically import their nested phase modules', () => {
    const markerPhaseSource = readRepoFile('game/turn/turn-start/marker-phase.ts');
    const importPaths = expectStaticImportsResolve('game/turn/turn-start/marker-phase.ts');

    expect(importPaths).toEqual(expect.arrayContaining(['./bomb-phase', './special-stone-phase']));
    expect(markerPhaseSource).not.toMatch(/requireTurnStartModule|safeRequire|globalThis|\bself\s*\./);
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
