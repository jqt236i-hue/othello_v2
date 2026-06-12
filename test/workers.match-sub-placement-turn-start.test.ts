import * as fs from 'fs';
import * as path from 'path';

describe('match worker sub-placement turn-start guard', () => {
  test('worker authority path uses sub-placement helper before applyTurnSafe', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../workers/match-worker.ts'), 'utf8');

    expect(source).toContain("require('../game/turn/sub-placement-continuation.js')");
    expect(source).toContain('SubPlacementContinuation.isSubPlacementTurnActive(currentCardState, playerKey)');
    expect(source).toContain('const skipCommandTurnStart = skipTurnStartForSubPlacement || skipTurnStartForTeleportSelection');
    expect(source).toContain('skipTurnStart: skipCommandTurnStart');
  });
});
