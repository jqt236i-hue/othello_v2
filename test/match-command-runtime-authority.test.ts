import * as fs from 'fs';
import * as path from 'path';
import * as LocalMatchServer from '../scripts/local-match-server';

type ScenarioCoverage = {
  scenario: string;
  file: string;
  testName: string;
};

const scenarioCoverage: ScenarioCoverage[] = [
  {
    scenario: 'normal place success, full snapshot/playback/log parity, PRNG state',
    file: 'test/match-runtime-parity.test.ts',
    testName: 'place command result matches local match server public projection and exact playback artifacts'
  },
  {
    scenario: 'normal rejection and idempotent replay facade shape',
    file: 'test/match-runtime-parity.test.ts',
    testName: 'version rejection and idempotent replay follow the network publish contract shape'
  },
  {
    scenario: 'all card-use commands',
    file: 'test/match-runtime-parity.test.ts',
    testName: 'all catalog card-use commands match local match server acceptance and public projection'
  },
  {
    scenario: 'pending follow-up success and exact playback/log artifacts',
    file: 'test/match-runtime-parity.test.ts',
    testName: 'pending card follow-up commands match local match server public projection and exact playback artifacts'
  },
  {
    scenario: 'stale pending identity',
    file: 'test/workers.match-pending-effect-id.test.ts',
    testName: 'stale pendingEffectId publish is rejected before deferred selection is applied'
  },
  {
    scenario: 'invalid pending target',
    file: 'test/workers.match-pending-effect-id.test.ts',
    testName: 'board expansion authority rejects a nonexistent direction without trusting client additions'
  },
  {
    scenario: 'sub-placement continuation and exactly-once turn start',
    file: 'test/local-match-server.publish-contract.test.ts',
    testName: 'final DOUBLE_PLACE sub-placement starts the next player turn exactly once'
  },
  {
    scenario: 'action and turn-start playback assembly, including multiple raw events',
    file: 'test/network.playback-event-assembly.contract.test.ts',
    testName: 'shared helper contract stays aligned across UI adapter, worker, and local match server'
  },
  {
    scenario: 'serialized PRNG state and calls',
    file: 'test/workers.match-prng-contract.test.ts',
    testName: 'worker TurnPipeline applyTurnSafe persists next prngState and returns a stateHash'
  },
  {
    scenario: 'AUTO disabled, success, terminal, and canonical private hand planning',
    file: 'test/workers.match-auto-turn-authority.test.ts',
    testName: 'loads the canonical planner inside the Durable Object and enforces AUTO contracts'
  },
  {
    scenario: 'network debug disabled and debug fill facade',
    file: 'test/local-match-server.publish-contract.test.ts',
    testName: 'network debug fill hand is rejected even when create payload requests debug'
  },
  {
    scenario: 'canonical projection strips hidden opponent hand data',
    file: 'test/utils.match-authority.public-snapshot.test.ts',
    testName: 'projectSnapshotForViewer reveals only marked reveal-hand slots and keeps unrevealed cards hidden'
  },
  {
    scenario: 'timeout forced pass and timeout presentation frame',
    file: 'test/workers.match-worker-timeout-controller.test.ts',
    testName: 'expired timeout can use injected forced pass resolver instead of direct core pass'
  },
  {
    scenario: 'charge delta is command-local and cleared before the next command',
    file: 'test/match-runtime-parity.test.ts',
    testName: 'accepted runtime commands clear transient charge deltas before the next command'
  },
  {
    scenario: 'game-over command rejection',
    file: 'test/local-match-server.publish-contract.test.ts',
    testName: 'regular commands are rejected after the game is over'
  }
];

function readRepositoryFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

describe('match command runtime authority characterization', () => {
  test.each(scenarioCoverage)('$scenario is pinned by $file', ({ file, testName }) => {
    expect(readRepositoryFile(file)).toContain(testName);
  });

  test('current migration baseline has duplicated command and turn-start authority in Worker and local runtimes', () => {
    const workerSource = readRepositoryFile('workers/match-worker.ts');
    const localSource = readRepositoryFile('scripts/local-match-server.ts');
    const localTimeoutSource = readRepositoryFile('scripts/local-match-server.ts');
    const workerTimeoutSource = readRepositoryFile('workers/match-worker-timeout-controller.ts');

    expect(workerSource).toContain('async function applyCommandPublishToSnapshot(');
    expect(localSource).toContain('function applyCommandPublishToSnapshot(');
    expect(workerSource).toContain('TurnPipeline.applyTurnSafe(');
    expect(localSource).toContain('TurnPipeline.applyTurnSafe(');
    expect(workerSource).toContain('validateAuthoritativePendingSelectionResult(');
    expect(localSource).toContain('validateAuthoritativePendingSelectionResult(');
    expect(localSource).toContain('reconcileTurnStartAndCollectPlayback(room, nextSnapshot)');
    expect(localTimeoutSource).toContain('Core.applyPass(');
    expect(workerTimeoutSource).toContain('cfg.loadCoreLogicModule()');
    expect(workerTimeoutSource).toContain('cfg.reconcileTurnStartAndCollectPlayback(room, nextSnapshot)');
  });

  test('local internal invalid-snapshot and disabled-debug rejection shapes are exact before migration', () => {
    expect(LocalMatchServer.applyCommandPublishToSnapshot({}, {}, 'black')).toEqual({
      ok: false,
      rejectedReason: 'INVALID_SNAPSHOT'
    });

    const snapshot = LocalMatchServer.makeInitialSnapshot(41);
    const debugResult = LocalMatchServer.applyCommandPublishToSnapshot({
      snapshot,
      seed: 41,
      stateVersion: 0,
      networkDebugEnabled: true
    }, {
      actionType: 'debug_fill_hand',
      action: {
        type: 'debug_fill_hand',
        playerKey: 'black'
      }
    }, 'black');

    expect(debugResult).toEqual({
      ok: false,
      rejectedReason: 'NETWORK_DEBUG_DISABLED'
    });
  });
});
