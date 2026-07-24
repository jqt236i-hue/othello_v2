import * as fs from 'fs';
import * as path from 'path';

describe('match worker sub-placement turn-start guard', () => {
  test('authority paths reconcile skipped commands only when the post-action owner changed', () => {
    const workerSource = fs.readFileSync(path.resolve(__dirname, '../workers/match-worker.ts'), 'utf8');
    const localServerSource = fs.readFileSync(
      path.resolve(__dirname, '../scripts/local-match-server.ts'),
      'utf8'
    );
    const runtimePreloadSource = fs.readFileSync(
      path.resolve(__dirname, '../workers/match-worker-runtime-preload.ts'),
      'utf8'
    );

    expect(runtimePreloadSource).toContain(
      "installRuntimeModule('TurnSubPlacementContinuation', () => require('../game/turn/sub-placement-continuation.js'));"
    );
    expect(workerSource).toContain(
      "return resolveModuleDefault(requireWorkerRuntimeGlobal('TurnSubPlacementContinuation'));"
    );
    expect(workerSource).toContain('const isSubPlacementTurnActive = (');
    expect(workerSource).toContain('SubPlacementContinuation.isSubPlacementTurnActive as (');
    expect(workerSource).toContain(
      'SubPlacementContinuation: getSubPlacementContinuationModule()'
    );
    expect(workerSource).toContain('const skipCommandTurnStart = shouldSkipMatchCommandTurnStart({');
    expect(workerSource).toContain('cardState: preparedCommand.currentCardState');
    expect(workerSource).toContain('isSubPlacementTurnActive');
    expect(workerSource).toContain('skipTurnStart: skipCommandTurnStart');
    expect(workerSource).toContain('const postActionPlayerKey = getCurrentPlayerKey(nextSnapshot.gameState);');
    expect(workerSource).toContain(
      'const shouldReconcilePostActionTurnStart = !skipCommandTurnStart || postActionPlayerKey !== playerKey;'
    );
    expect(workerSource).toContain('const turnStartPlaybackAssembly = shouldReconcilePostActionTurnStart');

    expect(localServerSource).toContain(
      'const postActionPlayerKey = getCurrentPlayerKey(nextSnapshot.gameState);'
    );
    expect(localServerSource).toMatch(
      /PendingSelectionRegistry,\s+SubPlacementContinuation\s+}\);/
    );
    expect(localServerSource).toContain(
      'const shouldReconcilePostActionTurnStart = !skipCommandTurnStart || postActionPlayerKey !== playerKey;'
    );
    expect(localServerSource).toContain(
      'const turnStartPlaybackAssembly = shouldReconcilePostActionTurnStart'
    );
  });
});
