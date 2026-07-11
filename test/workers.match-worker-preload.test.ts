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

function expectWorkerModuleRegistration(workerSource: string, _globalKey: string, _importPath: string): void {
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
      expectWorkerModuleRegistration(workerSource, dependency.globalKey, dependency.importPath);
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

  test('worker preloads nested hole-style cell removal dependency used by card modules', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const cellRemovalRuntimeShimPath = 'game/logic/cards/cell-removal.js';
    const cellRemovalImportPath = '../game/logic/cards/cell-removal.js';
    const cellRemovalGlobalKey = 'CardCellRemoval';
    const dependentCardSources = [
      'game/logic/cards/meteor.ts',
      'game/logic/cards/meteor_god.ts',
      'game/logic/cards/shrink.ts',
      'game/logic/cards/teleport.ts'
    ];

    for (const sourcePath of dependentCardSources) {
      const source = readRepoFile(sourcePath);
      expect(source).toContain("safeRequire('./cell-removal')");
      expect(source).toContain('CardCellRemoval');
      expect(source).toMatch(/self[^;]+CardCellRemoval/);
    }
    expect(fs.existsSync(path.join(ROOT, cellRemovalRuntimeShimPath))).toBe(true);
    expectWorkerModuleRegistration(workerSource, cellRemovalGlobalKey, cellRemovalImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, cellRemovalGlobalKey, cellRemovalImportPath);
  });

  test('worker exposes shared evasion status before bundled card modules load', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const evasionStatusImportPath = '../shared/evasion-status.js';
    const evasionStatusGlobalKey = 'EvasionStatus';

    expectWorkerModuleRegistration(workerSource, evasionStatusGlobalKey, evasionStatusImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, evasionStatusGlobalKey, evasionStatusImportPath);
  });

  test('worker exposes protection context before card effect resolver loads', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const protectionContextImportPath = '../game/logic/cards-internal/protection-context.js';
    const protectionContextGlobalKey = 'CardProtectionContext';

    expect(readRepoFile('game/cards/effect-resolver.ts')).toContain(
      "loadRuntimeModule('../logic/cards-internal/protection-context', 'CardProtectionContext'"
    );
    expectWorkerModuleRegistration(workerSource, protectionContextGlobalKey, protectionContextImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, protectionContextGlobalKey, protectionContextImportPath);
  });

  test('worker exposes card usage consumption before card effect resolver loads', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const consumptionImportPath = '../game/cards/card-usage-consumption-stage.js';
    const consumptionGlobalKey = 'CardUsageConsumptionStage';

    expect(readRepoFile('game/cards/effect-resolver.ts')).toContain(
      "loadRuntimeModule('./card-usage-consumption-stage', 'CardUsageConsumptionStage'"
    );
    expectWorkerModuleRegistration(workerSource, consumptionGlobalKey, consumptionImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, consumptionGlobalKey, consumptionImportPath);
  });

  test('worker exposes card usage pending state before card effect resolver loads', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const pendingImportPath = '../game/cards/card-usage-pending-stage.js';
    const pendingGlobalKey = 'CardUsagePendingStage';

    expect(readRepoFile('game/cards/effect-resolver.ts')).toContain(
      "loadRuntimeModule('./card-usage-pending-stage', 'CardUsagePendingStage'"
    );
    expectWorkerModuleRegistration(workerSource, pendingGlobalKey, pendingImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, pendingGlobalKey, pendingImportPath);
  });

  test('worker exposes card usage immediate effects before card effect resolver loads', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const immediateImportPath = '../game/cards/card-usage-immediate-stage.js';
    const immediateGlobalKey = 'CardUsageImmediateStage';

    expect(readRepoFile('game/cards/effect-resolver.ts')).toContain(
      "loadRuntimeModule('./card-usage-immediate-stage', 'CardUsageImmediateStage'"
    );
    expectWorkerModuleRegistration(workerSource, immediateGlobalKey, immediateImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, immediateGlobalKey, immediateImportPath);
  });

  test('worker exposes card usage sacrifice handling before card effect resolver loads', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const sacrificeImportPath = '../game/cards/card-usage-sacrifice-stage.js';
    const sacrificeGlobalKey = 'CardUsageSacrificeStage';

    expect(readRepoFile('game/cards/effect-resolver.ts')).toContain(
      "loadRuntimeModule('./card-usage-sacrifice-stage', 'CardUsageSacrificeStage'"
    );
    expectWorkerModuleRegistration(workerSource, sacrificeGlobalKey, sacrificeImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, sacrificeGlobalKey, sacrificeImportPath);
  });

  test('worker exposes card usage presentation before card effect resolver loads', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const presentationImportPath = '../game/cards/card-usage-presentation-stage.js';
    const presentationGlobalKey = 'CardUsagePresentationStage';

    expect(readRepoFile('game/cards/effect-resolver.ts')).toContain(
      "loadRuntimeModule('./card-usage-presentation-stage', 'CardUsagePresentationStage'"
    );
    expectWorkerModuleRegistration(workerSource, presentationGlobalKey, presentationImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, presentationGlobalKey, presentationImportPath);
  });

  test('worker exposes card usage validation before card effect resolver loads', () => {
    const workerSource = readRepoFile('workers/match-worker.ts');
    const runtimePreloadSource = readRepoFile('workers/match-worker-runtime-preload.ts');
    const validationImportPath = '../game/cards/card-usage-validation-stage.js';
    const validationGlobalKey = 'CardUsageValidationStage';

    expect(readRepoFile('game/cards/effect-resolver.ts')).toContain(
      "loadRuntimeModule('./card-usage-validation-stage', 'CardUsageValidationStage'"
    );
    expectWorkerModuleRegistration(workerSource, validationGlobalKey, validationImportPath);
    expectRuntimePreloadRegistration(runtimePreloadSource, validationGlobalKey, validationImportPath);
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
