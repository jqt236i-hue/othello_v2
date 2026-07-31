import * as fs from 'fs';
import * as path from 'path';

describe('match worker sub-placement turn-start guard', () => {
  test('authority paths reconcile skipped commands only when the post-action owner changed', () => {
    const workerSource = fs.readFileSync(path.resolve(__dirname, '../workers/match-worker.ts'), 'utf8');
    const localServerSource = fs.readFileSync(
      path.resolve(__dirname, '../scripts/local-match-server.ts'),
      'utf8'
    );
    const commandRuntimeSource = fs.readFileSync(
      path.resolve(__dirname, '../utils/match-command-runtime.ts'),
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
    expect(workerSource).toContain(
      'SubPlacementContinuation: getSubPlacementContinuationModule()'
    );
    expect(workerSource).toContain('isSubPlacementTurnActive: (');
    expect(workerSource).toContain("typeof options.SubPlacementContinuation.isSubPlacementTurnActive === 'function'");
    expect(workerSource).toContain('options.SubPlacementContinuation.isSubPlacementTurnActive(cardState, commandPlayerKey)');
    expect(localServerSource).toContain('isSubPlacementTurnActive: (cardState: any, commandPlayerKey: any) => (');
    expect(localServerSource).toContain('SubPlacementContinuation.isSubPlacementTurnActive(cardState, commandPlayerKey)');

    expect(commandRuntimeSource).toContain('export function shouldSkipMatchCommandTurnStart(');
    expect(commandRuntimeSource).toContain('const skipTurnStart = shouldSkipMatchCommandTurnStart({');
    expect(commandRuntimeSource).toContain('isSubPlacementTurnActive: capabilities.authority.isSubPlacementTurnActive');
    expect(commandRuntimeSource).toContain('skipTurnStart');
    expect(commandRuntimeSource).toContain('export function shouldReconcileMatchCommandTurnStart(');
    expect(commandRuntimeSource).toContain('return !decision.skipTurnStart');
    expect(commandRuntimeSource).toContain('|| decision.postActionPlayerKey !== decision.preActionPlayerKey;');
  });
});
