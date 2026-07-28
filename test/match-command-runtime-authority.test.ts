import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as LocalMatchServer from '../scripts/local-match-server';
import * as LocalMatchRuntime from '../scripts/local-match-runtime';

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
    scenario: 'missing Worker timeout resolver fails closed before authority mutation',
    file: 'test/workers.match-worker-timeout-controller.test.ts',
    testName: 'missing shared timeout resolver fails closed before timer refresh or save'
  },
  {
    scenario: 'rejected Worker timeout command leaves authority and presentation unchanged',
    file: 'test/workers.match-worker-timeout-controller.test.ts',
    testName: 'shared timeout command rejection leaves authority and presentation state unchanged'
  },
  {
    scenario: 'rejected local timeout command leaves authority and presentation unchanged',
    file: 'test/local-match-server.presentation-journal.test.ts',
    testName: 'timeout command rejection leaves snapshot, version, timer, and presentation journal unchanged'
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

function countOccurrences(source: string, token: string): number {
  return source.split(token).length - 1;
}

function findFunctionSource(source: string, functionName: string): string {
  const sourceFile = ts.createSourceFile(
    `${functionName}.ts`,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let match: ts.FunctionDeclaration | null = null;
  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node)
      && node.name
      && node.name.text === functionName
    ) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return match ? (match as ts.FunctionDeclaration).getText(sourceFile) : '';
}

function collectCalledCallees(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    'authority-source.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const callees: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      callees.push(node.expression.getText(sourceFile));
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return callees;
}

describe('match command runtime authority characterization', () => {
  test.each(scenarioCoverage)('$scenario is pinned by $file', ({ file, testName }) => {
    expect(readRepositoryFile(file)).toContain(testName);
  });

  test('Worker and local command facades each delegate once to the shared executor', () => {
    const workerSource = readRepositoryFile('workers/match-worker.ts');
    const localSource = readRepositoryFile('scripts/local-match-server.ts');
    const sharedSource = readRepositoryFile('utils/match-command-runtime.ts');
    const workerFacade = findFunctionSource(workerSource, 'applyCommandPublishToSnapshot');
    const localFacade = findFunctionSource(localSource, 'applyCommandPublishToSnapshot');
    const localTimeout = findFunctionSource(localSource, 'applyExpiredTurnTimeoutIfNeeded');
    const workerTimeoutSource = readRepositoryFile('workers/match-worker-timeout-controller.ts');
    const workerCalls = collectCalledCallees(workerSource);
    const localCalls = collectCalledCallees(localSource);
    const sharedCalls = collectCalledCallees(sharedSource);

    expect(workerFacade).not.toBe('');
    expect(localFacade).not.toBe('');
    expect(countOccurrences(workerFacade, 'executeMatchCommand(')).toBe(1);
    expect(countOccurrences(localFacade, 'MatchCommandRuntime.executeMatchCommand(')).toBe(1);
    expect(collectCalledCallees(workerFacade)).not.toEqual(expect.arrayContaining([
      'prepareMatchCommandAction',
      'applyPreparedMatchCommandExecution',
      'reconcileMatchCommandTurnStart',
      'finalizeMatchCommandExecution'
    ]));
    expect(collectCalledCallees(localFacade)).not.toEqual(expect.arrayContaining([
      'MatchCommandRuntime.prepareMatchCommandAction',
      'MatchCommandRuntime.applyPreparedMatchCommandExecution',
      'MatchCommandRuntime.reconcileMatchCommandTurnStart',
      'MatchCommandRuntime.finalizeMatchCommandExecution'
    ]));
    expect(workerCalls).not.toContain('TurnPipeline.applyTurnSafe');
    expect(localCalls).not.toContain('TurnPipeline.applyTurnSafe');
    expect(workerCalls).not.toContain('MatchAuthority.validateAuthoritativePendingSelectionResult');
    expect(localCalls).not.toContain('MatchAuthority.validateAuthoritativePendingSelectionResult');
    expect(sharedCalls).toContain('capabilities.pipeline.applyTurnSafe');
    expect(sharedCalls).toContain('capabilities.authority.validateAuthoritativePendingSelectionResult');
    expect(sharedCalls).toContain('prepareMatchCommandAction');
    expect(workerSource).not.toContain('repairNetworkDebugProjectedHandForCardUse');
    expect(workerTimeoutSource).not.toContain('loadCoreLogicModule');
    expect(collectCalledCallees(workerTimeoutSource).every((callee) => !callee.endsWith('.applyPass'))).toBe(true);
    expect(collectCalledCallees(localTimeout).every((callee) => !callee.endsWith('.applyPass'))).toBe(true);
    expect(localTimeout).not.toContain('reconcileTurnStartAndCollectPlayback');
  });

  test('canonical snapshot validation exists only in the shared command entry', () => {
    const sharedSource = readRepositoryFile('utils/match-command-runtime.ts');
    const workerCommandSource = [
      findFunctionSource(readRepositoryFile('workers/match-worker.ts'), 'buildWorkerMatchCommandCapabilities'),
      findFunctionSource(readRepositoryFile('workers/match-worker.ts'), 'applyCommandPublishToSnapshot')
    ].join('\n');
    const localCommandSource = [
      findFunctionSource(readRepositoryFile('scripts/local-match-server.ts'), 'createLocalMatchCommandCapabilities'),
      findFunctionSource(readRepositoryFile('scripts/local-match-server.ts'), 'applyCommandPublishToSnapshot')
    ].join('\n');
    const sharedValidation = findFunctionSource(sharedSource, 'validateCanonicalMatchCommandSnapshot');

    expect(sharedValidation).toContain('projectedForSeat');
    expect(sharedValidation).toContain('viewerRole');
    expect(sharedValidation).toContain('authority.parseHiddenHandToken');
    for (const adapterSource of [workerCommandSource, localCommandSource]) {
      expect(adapterSource).not.toContain('projectedForSeat');
      expect(adapterSource).not.toContain('viewerRole');
      expect(adapterSource).not.toContain('__hidden_hand__');
      expect(adapterSource).not.toContain('validateCanonicalMatchCommandSnapshot');
    }
  });

  test('legacy callback core is absent and the command runtime import direction is acyclic', () => {
    const commandRuntimeSource = readRepositoryFile('utils/match-command-runtime.ts');
    const portsSource = readRepositoryFile('utils/match-runtime-ports.ts');
    const localRuntimeSource = readRepositoryFile('scripts/local-match-runtime.ts');
    const localServerSource = readRepositoryFile('scripts/local-match-server.ts');

    expect(fs.existsSync(path.resolve(__dirname, '../utils/match-runtime-core.ts'))).toBe(false);
    expect(commandRuntimeSource).not.toContain('executeMatchRuntimeCommand');
    expect(portsSource).not.toContain('MatchCommandRuntimePort');
    expect(localRuntimeSource).toContain("require('./local-match-server')");
    expect(localRuntimeSource).not.toContain('match-command-runtime');
    expect(localServerSource).toContain("require('../utils/match-command-runtime')");
    expect(localServerSource).not.toContain('local-match-runtime');
    expect(commandRuntimeSource).toContain("from './match-runtime-ports'");
    expect(portsSource).not.toContain('match-command-runtime');
  });

  test('Worker resolves command-specific modules before entering the synchronous executor', () => {
    const workerSource = readRepositoryFile('workers/match-worker.ts');
    const resolverStart = workerSource.indexOf('async function resolveWorkerMatchCommandCapabilities(');
    const facadeStart = workerSource.indexOf('async function applyCommandPublishToSnapshot(');
    const resolverSource = workerSource.slice(resolverStart, facadeStart);
    const facadeSource = workerSource.slice(facadeStart, workerSource.indexOf('async function applyTimeoutPassToSnapshot('));

    expect(resolverStart).toBeGreaterThanOrEqual(0);
    expect(facadeStart).toBeGreaterThan(resolverStart);
    expect(resolverSource).toContain("rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE'");
    expect(resolverSource).toContain("rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE'");
    expect(resolverSource).toContain("rejectedReason: 'AUTO_COMMAND_PLANNER_UNAVAILABLE'");
    expect(resolverSource).toContain("rejectedReason: 'DEBUG_ACTIONS_UNAVAILABLE'");
    expect(resolverSource).toContain('loadTurnStartModules()');
    expect(resolverSource).toContain('loadDebugActionsModule()');
    expect(resolverSource).toContain("import('../game/cpu-network-command-planner.js')");
    expect(facadeSource.indexOf('await resolveWorkerMatchCommandCapabilities('))
      .toBeLessThan(facadeSource.indexOf('const result = executeMatchCommand('));
    expect(facadeSource.slice(facadeSource.indexOf('const result = executeMatchCommand(')))
      .not.toContain('await ');
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

  test('local command facade and direct runtime remain strictly synchronous', () => {
    const snapshot = LocalMatchServer.makeInitialSnapshot(43);
    const room: any = {
      snapshot,
      seed: 43,
      stateVersion: 0,
      networkAutoEnabled: false
    };
    const turnIndex = Number(snapshot.cardState.turnIndex) || 0;
    const facadeResult: any = LocalMatchServer.applyCommandPublishToSnapshot(room, {
      actionType: 'pass',
      actor: 'black',
      turnIndex,
      action: {
        type: 'pass',
        playerKey: 'black',
        turnIndex,
        forcePass: true
      }
    }, 'black');
    expect(facadeResult && typeof facadeResult.then).not.toBe('function');

    const runtime = LocalMatchRuntime.createRuntime({ seed: 47 });
    const runtimeSnapshot = runtime.getSnapshot();
    const runtimeTurnIndex = Number(runtimeSnapshot.cardState.turnIndex) || 0;
    const publicResult: any = runtime.applyCommand({
      seatKey: 'black',
      playerKey: 'black',
      baseVersion: runtime.getRoom().stateVersion,
      operationId: 'op_sync_contract_1',
      actionType: 'pass',
      actor: 'black',
      turnIndex: runtimeTurnIndex,
      action: {
        type: 'pass',
        playerKey: 'black',
        turnIndex: runtimeTurnIndex,
        forcePass: true
      }
    });
    expect(publicResult && typeof publicResult.then).not.toBe('function');
  });
});
