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

    expect(workerSource).toContain(
      "import { WORKER_RUNTIME_GLOBAL_KEYS } from './match-worker-runtime-preload.js';"
    );
    expect(workerSource).not.toContain('WORKER_PRELOAD_MODULE_LOADERS');
    expect(workerSource).not.toContain("['../game/logic/cards/selectors.js', 'CardSelectors']");
  });
});
