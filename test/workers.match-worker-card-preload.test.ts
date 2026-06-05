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
  });

  test('worker global importer unwraps nested module exports and prefers usable runtime modules', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../workers/match-worker.ts'),
      'utf8'
    );

    expect(source).toContain("const ModuleExportUtils = require('../shared/module-export-utils');");
    expect(source).toContain('function unwrapRuntimeModule(value: unknown, depth = 0): unknown {');
    expect(source).toContain("const moduleExports = source['module.exports'];");
    expect(source).toContain('const defaultExport = source.default;');
    expect(source).toContain('return unwrapRuntimeModule(moduleExports, depth + 1);');
    expect(source).toContain('return unwrapRuntimeModule(defaultExport, depth + 1);');
    expect(source).toContain('ModuleExportUtils.hasUsableModuleExport(value)');
    expect(source).toContain('ModuleExportUtils.preferUsableModuleExport(resolved, globalAfterLoad)');
    expect(source).toContain("'../game/logic/board_ops.js': () => require('../game/logic/board_ops.js')");
    expect(source).toContain("'../game/logic/effects/destroy_one_stone.js': () => require('../game/logic/effects/destroy_one_stone.js')");
    expect(source).toContain("'../game/logic/effects/swap_with_enemy.js': () => require('../game/logic/effects/swap_with_enemy.js')");
    expect(source).toContain("'../game/logic/card-resolution/status-cells': () => require('../game/logic/card-resolution/status-cells')");
    expect(source).toContain("'../game/logic/card-resolution/observer-will': () => require('../game/logic/card-resolution/observer-will')");
    expect(source).toContain("['../game/logic/board_ops.js', 'BoardOps']");
    expect(source).toContain("['../game/cards/effect-resolver.js', 'CardEffectResolver']");
    expect(source).toContain("['../game/logic/card-resolution/status-cells', 'CardStatusCellsEffects']");
    expect(source).toContain("['../game/logic/card-resolution/observer-will', 'CardObserverWillResolution']");
    expect(source).toContain('requiredGlobals.reduce(');
  });
});
