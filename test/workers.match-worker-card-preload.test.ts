import * as fs from 'fs';
import * as path from 'path';

describe('match worker card module preload', () => {
  test('preloads card resolver globals before card logic evaluation', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../workers/match-worker-runtime-preload.ts'),
      'utf8'
    );
    const cardCatalogIndex = source.indexOf("installRuntimeModule('CardCatalog'");
    const sharedConstantsIndex = source.indexOf("installRuntimeModule('SharedConstants'");
    const boardOpsIndex = source.indexOf("installRuntimeModule('BoardOps'");
    const destroyOneStoneIndex = source.indexOf("installRuntimeModule('DestroyOneStoneEffects'");
    const swapWithEnemyIndex = source.indexOf("installRuntimeModule('SwapWithEnemyEffects'");
    const statusCellsIndex = source.indexOf("installRuntimeModule('CardStatusCellsEffects'");
    const observerWillResolutionIndex = source.indexOf("installRuntimeModule('CardObserverWillResolution'");
    const chaosSummonResolutionIndex = source.indexOf("installRuntimeModule('CardChaosSummonResolution'");
    const stateManagerIndex = source.indexOf("installRuntimeModule('CardStateManager'");
    const effectResolverIndex = source.indexOf("installRuntimeModule('CardEffectResolver'");
    const timingProcessorIndex = source.indexOf("installRuntimeModule('CardTimingProcessor'");
    const targetResolverIndex = source.indexOf("installRuntimeModule('CardTargetResolver'");
    const hyperactiveBoardShapeIndex = source.indexOf("installRuntimeModule('CardHyperactiveBoardShape'");
    const hyperactiveIndex = source.indexOf("installRuntimeModule('CardHyperactive'");

    expect(cardCatalogIndex).toBeGreaterThanOrEqual(0);
    expect(sharedConstantsIndex).toBeGreaterThanOrEqual(0);
    expect(cardCatalogIndex).toBeLessThan(sharedConstantsIndex);
    expect(boardOpsIndex).toBeGreaterThanOrEqual(0);
    expect(destroyOneStoneIndex).toBeGreaterThanOrEqual(0);
    expect(swapWithEnemyIndex).toBeGreaterThanOrEqual(0);
    expect(statusCellsIndex).toBeGreaterThanOrEqual(0);
    expect(observerWillResolutionIndex).toBeGreaterThanOrEqual(0);
    expect(chaosSummonResolutionIndex).toBeGreaterThanOrEqual(0);
    expect(stateManagerIndex).toBeGreaterThanOrEqual(0);
    expect(effectResolverIndex).toBeGreaterThanOrEqual(0);
    expect(timingProcessorIndex).toBeGreaterThanOrEqual(0);
    expect(targetResolverIndex).toBeGreaterThanOrEqual(0);
    expect(hyperactiveBoardShapeIndex).toBeGreaterThanOrEqual(0);
    expect(hyperactiveIndex).toBeGreaterThanOrEqual(0);
    expect(hyperactiveBoardShapeIndex).toBeLessThan(hyperactiveIndex);
    expect(source).toContain("require('../cards/catalog.js')");
    expect(source).toContain("require('../game/logic/card-resolution/status-cells.js')");
    expect(source).toContain("require('../game/logic/card-resolution/observer-will.js')");
    expect(source).toContain("require('../game/logic/card-resolution/chaos-summon.js')");
  });

  test('centralized runtime preload unwraps nested module exports and validates registered globals', () => {
    const workerSource = fs.readFileSync(
      path.resolve(__dirname, '../workers/match-worker.ts'),
      'utf8'
    );
    const runtimePreloadSource = fs.readFileSync(
      path.resolve(__dirname, '../workers/match-worker-runtime-preload.ts'),
      'utf8'
    );

    expect(runtimePreloadSource).toContain("const ModuleExportUtils = require('../shared/module-export-utils');");
    expect(runtimePreloadSource).toContain('ModuleExportUtils.unwrapModuleExport(mod)');
    expect(runtimePreloadSource).toContain('ModuleExportUtils.hasUsableModuleExport(mod)');
    expect(runtimePreloadSource.match(
      /if \(hasUsableGlobalRuntimeModule\(globalKey\)\) return;/g
    )).toHaveLength(2);
    expect(runtimePreloadSource).toContain(
      "installRuntimeModule('BoardOps', () => require('../game/logic/board_ops.js'));"
    );
    expect(runtimePreloadSource).toContain(
      "installRuntimeModule('DestroyOneStoneEffects', () => require('../game/logic/effects/destroy_one_stone.js'));"
    );
    expect(runtimePreloadSource).toContain(
      "installRuntimeModule('SwapWithEnemyEffects', () => require('../game/logic/effects/swap_with_enemy.js'));"
    );
    expect(runtimePreloadSource).toContain(
      "installRuntimeModule('CardStatusCellsEffects', () => require('../game/logic/card-resolution/status-cells.js'));"
    );
    expect(runtimePreloadSource).toContain(
      "installRuntimeModule('CardObserverWillResolution', () => require('../game/logic/card-resolution/observer-will.js'));"
    );
    expect(runtimePreloadSource).toContain(
      "installRuntimeModule('CardChaosSummonResolution', () => require('../game/logic/card-resolution/chaos-summon.js'));"
    );
    expect(workerSource).toContain(
      "import { WORKER_RUNTIME_GLOBAL_KEYS } from './match-worker-runtime-preload.js';"
    );
    expect(workerSource).toContain('const missingGlobals = WORKER_RUNTIME_GLOBAL_KEYS.filter(');
    expect(workerSource).toContain('function requireWorkerRuntimeGlobal(globalKey: string): unknown {');
    expect(workerSource).toContain(
      "return resolveModuleDefault(requireWorkerRuntimeGlobal('TurnSubPlacementContinuation'));"
    );
    expect(workerSource).not.toContain('WORKER_PRELOAD_MODULE_LOADERS');
  });
});
