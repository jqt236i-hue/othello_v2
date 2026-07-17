import * as fs from 'fs';
import * as path from 'path';

describe('match worker sub-placement turn-start guard', () => {
  test('worker authority path uses sub-placement helper before applyTurnSafe', () => {
    const workerSource = fs.readFileSync(path.resolve(__dirname, '../workers/match-worker.ts'), 'utf8');
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
    expect(workerSource).toContain('const skipCommandTurnStart = shouldSkipMatchCommandTurnStart({');
    expect(workerSource).toContain('cardState: preparedCommand.currentCardState');
    expect(workerSource).toContain('isSubPlacementTurnActive');
    expect(workerSource).toContain('skipTurnStart: skipCommandTurnStart');
  });
});
