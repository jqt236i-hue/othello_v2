import * as fs from 'fs';
import * as path from 'path';

describe('worker card selector preload contract', () => {
  test('preloads selector helper globals before CardSelectors for Cloudflare runtime', () => {
    const root = path.resolve(__dirname, '..');
    const runtimePreload = fs.readFileSync(path.join(root, 'workers/match-worker-runtime-preload.ts'), 'utf8');
    const workerSource = fs.readFileSync(path.join(root, 'workers/match-worker.ts'), 'utf8');

    const runtimeCoreIndex = runtimePreload.indexOf("installRuntimeModule('CardSelectorsCoreUtils'");
    const runtimeShapeIndex = runtimePreload.indexOf("installRuntimeModule('CardSelectorsBoardShape'");
    const runtimeMovementIndex = runtimePreload.indexOf("installRuntimeModule('CardMovement'");
    const runtimeSelectorsIndex = runtimePreload.indexOf("installRuntimeModule('CardSelectors'");

    expect(runtimeCoreIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeShapeIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeMovementIndex).toBeGreaterThan(runtimeCoreIndex);
    expect(runtimeSelectorsIndex).toBeGreaterThan(runtimeCoreIndex);
    expect(runtimeSelectorsIndex).toBeGreaterThan(runtimeShapeIndex);

    const workerCoreIndex = workerSource.indexOf("['../game/logic/cards/selectors-core-utils.js', 'CardSelectorsCoreUtils']");
    const workerShapeIndex = workerSource.indexOf("['../game/logic/cards/selectors-board-shape.js', 'CardSelectorsBoardShape']");
    const workerMovementIndex = workerSource.indexOf("['../game/logic/cards/movement.js', 'CardMovement']");
    const workerSelectorsIndex = workerSource.indexOf("['../game/logic/cards/selectors.js', 'CardSelectors']");

    expect(workerSource).toContain("'../game/logic/cards/selectors-core-utils.js': () => require('../game/logic/cards/selectors-core-utils.js')");
    expect(workerSource).toContain("'../game/logic/cards/selectors-board-shape.js': () => require('../game/logic/cards/selectors-board-shape.js')");
    expect(workerCoreIndex).toBeGreaterThanOrEqual(0);
    expect(workerShapeIndex).toBeGreaterThanOrEqual(0);
    expect(workerMovementIndex).toBeGreaterThan(workerCoreIndex);
    expect(workerSelectorsIndex).toBeGreaterThan(workerCoreIndex);
    expect(workerSelectorsIndex).toBeGreaterThan(workerShapeIndex);
  });
});
