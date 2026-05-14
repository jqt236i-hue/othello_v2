import * as fs from 'fs';
import * as path from 'path';

describe('match worker card module preload', () => {
  test('preloads card resolver globals before CardLogic can be evaluated', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../workers/match-worker-runtime-preload.ts'),
      'utf8'
    );

    expect(source).toContain('scope.CardStateManager');
    expect(source).toContain('scope.CardEffectResolver');
    expect(source).toContain('scope.CardTimingProcessor');
    expect(source).toContain('scope.CardTargetResolver');
    expect(source).toContain('scope.BoardOps');
    expect(source).toContain('scope.DestroyOneStoneEffects');
    expect(source).toContain('scope.SwapWithEnemyEffects');
    expect(source).toContain('scope.CardStatusCellsEffects');
  });

  test('worker global importer prefers CommonJS module.exports when present', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../workers/match-worker.ts'),
      'utf8'
    );

    expect(source).toContain("mod['module.exports']");
    expect(source).toContain('runtimeValue || moduleExports || mod.default || mod');
    expect(source).toContain("'../game/logic/board_ops.js': boardOpsModule");
    expect(source).toContain("'../game/logic/effects/destroy_one_stone.js': destroyOneStoneEffectsModule");
    expect(source).toContain("'../game/logic/effects/swap_with_enemy.js': swapWithEnemyEffectsModule");
    expect(source).toContain("'../game/cards/effects/status-cells.js': cardStatusCellsEffectsModule");
    expect(source).toContain("['../game/logic/effects/destroy_one_stone.js', 'DestroyOneStoneEffects']");
    expect(source).toContain("['../game/logic/effects/swap_with_enemy.js', 'SwapWithEnemyEffects']");
    expect(source).toContain("['../game/cards/effects/status-cells.js', 'CardStatusCellsEffects']");
  });

});
