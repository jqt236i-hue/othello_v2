import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildMutationEntryManifest,
  CARD_RUNTIME_FAILURE_MAPPING,
  CARD_RUNTIME_GRAPH_EDGE_KINDS,
  CARD_RUNTIME_GRAPH_ROOTS,
  CARD_RUNTIME_RECOVERY_EVIDENCE,
  CARD_RUNTIME_RECOVERY_MATRIX,
  DIRECT_RUNTIME_FUNCTION_EXPORTS,
  inventoryCardRuntimeGraph,
  inspectDirectEntryProofs,
  PARTIAL_CANCELLATION_MANAGER_DECISION,
  verifyCardRuntimeGraphNegativeFixtures,
  verifyDirectEntryDeclarations
} from './helpers/card-runtime-contract-fixtures';

const CardLogic = require('../game/logic/cards');

describe('card runtime Gate B characterization', () => {
  test('classifies every facade and direct production/public entry with complete effect metadata', () => {
    const manifest = buildMutationEntryManifest(CardLogic);
    const facadeFunctions = Reflect.ownKeys(CardLogic)
      .filter((key) => typeof key === 'string' && typeof CardLogic[key as string] === 'function');
    const directCount = Object.values(DIRECT_RUNTIME_FUNCTION_EXPORTS)
      .reduce((total, names) => total + names.length, 0);

    expect(facadeFunctions).toHaveLength(263);
    expect(manifest).toHaveLength(263 + directCount);
    expect(new Set(manifest.map((entry) => entry.entryId)).size).toBe(manifest.length);

    for (const entry of manifest) {
      expect(['mutator', 'query', 'presentation-only']).toContain(entry.kind);
      expect(typeof entry.writesCanonicalState).toBe('boolean');
      expect(typeof entry.writesRuntimeState).toBe('boolean');
      expect(typeof entry.writesTransportPayload).toBe('boolean');
      expect(typeof entry.appendsOrDrainsEvents).toBe('boolean');
      expect(typeof entry.consumesRng).toBe('boolean');
      expect(entry.dependencySensitivityEvidence).toBeTruthy();
      expect(entry.pure).toBe(
        !entry.writesCanonicalState
        && !entry.writesRuntimeState
        && !entry.writesTransportPayload
        && !entry.appendsOrDrainsEvents
        && !entry.consumesRng
      );
      if (!entry.pure || entry.firstObservableEffect !== 'none (read-only result)') {
        expect(entry.cohort).toBeTruthy();
        expect(entry.firstObservableEffect).toBeTruthy();
        expect(entry.preflightOwner).toBeTruthy();
        expect(entry.failureNormalizationOwner).toBeTruthy();
        expect(entry.runtimeConsumers?.length).toBeGreaterThan(0);
        expect(entry.testOwner).toMatch(/\.test\.ts$/);
      }
      if (entry.kind === 'query' && entry.dependencySensitive) {
        expect(entry.activationPreflightOwner).toBeTruthy();
        expect(entry.taggedFailurePropagationOwner).toBeTruthy();
        expect(entry.successShapedFallbackProhibition).toContain('runtime_unavailable');
        expect(entry.testOwner).toMatch(/\.test\.ts$/);
      }
      expect(['none', 'self', 'outer']).toContain(entry.currentPreflight);
      expect(['self', 'outer']).toContain(entry.targetPreflight);
      expect(entry.evidence.length).toBeGreaterThan(10);
    }

    const createState = manifest.find((entry) => entry.exportName === 'createCardState' && entry.source === 'game/logic/cards.ts')!;
    expect(createState).toMatchObject({ writesRuntimeState: true, consumesRng: true, pure: false });
    const directApply = manifest.find((entry) => entry.exportName === 'applyCardUsage' && entry.source === 'game/cards/effect-resolver.ts')!;
    expect(directApply).toMatchObject({ writesCanonicalState: true, appendsOrDrainsEvents: true, consumesRng: true });
    const phaseRuntimeSetter = manifest.find((entry) => entry.exportName === 'setTurnPipelinePhasesRuntime')!;
    expect(phaseRuntimeSetter).toMatchObject({ kind: 'mutator', writesRuntimeState: true });
    const transportContext = manifest.find((entry) => entry.exportName === 'applyPendingSelectionCardContext')!;
    expect(transportContext).toMatchObject({ writesCanonicalState: false, writesTransportPayload: true });
    const factory = manifest.find((entry) => entry.exportName === 'createTurnPipelineModule')!;
    expect(factory).toMatchObject({ currentPreflight: 'none', targetPreflight: 'outer' });
    expect(manifest.find((entry) => entry.entryId === 'utils/match-auto-command.ts#isMatchAutoTurnPublishBody'))
      .toMatchObject({ dependencySensitive: false, pure: true, consumesRng: false });
    expect(manifest.find((entry) => entry.entryId === 'utils/match-auto-command.ts#resolveMatchAutoTurnPublishBody'))
      .toMatchObject({ dependencySensitive: true, consumesRng: true, writesRuntimeState: true });
    expect(manifest.find((entry) => entry.entryId === 'game/logic/cards.ts#onTurnEnd'))
      .toMatchObject({ writesCanonicalState: true, writesRuntimeState: true, appendsOrDrainsEvents: false, consumesRng: false });
    expect(manifest.find((entry) => entry.entryId === 'utils/match-command-runtime.ts#assembleMatchCommandActionPresentation'))
      .toMatchObject({ consumesRng: false });
    expect(manifest.find((entry) => entry.entryId === 'utils/match-command-runtime.ts#finalizeMatchCommandExecution'))
      .toMatchObject({ consumesRng: false });

    const repoRoot = path.resolve(__dirname, '..');
    expect(verifyDirectEntryDeclarations(repoRoot)).toHaveLength(directCount);
    const directProofs = inspectDirectEntryProofs(repoRoot);
    expect(directProofs).toHaveLength(directCount);
    expect(directProofs.every((proof) => (
      proof.exposure === 'exported-or-installed'
      || (proof.exposure === 'production-call-chain' && proof.referenceCount > 0 && proof.reachabilityPath.length > 1)
    ))).toBe(true);
    expect(directProofs.every((proof) => (
      proof.reachabilityPath.length > 0 && !!proof.preflightOwner
      && (proof.preflightMode === 'self' || proof.preflightMode === 'outer')
    ))).toBe(true);
    expect(directProofs).toEqual(expect.arrayContaining([
      expect.objectContaining({ entryId: 'scripts/local-match-runtime.ts#createRuntime', exposure: 'exported-or-installed' }),
      expect.objectContaining({ entryId: 'workers/match-worker.ts#MatchRoomDurableObject', exposure: 'exported-or-installed' }),
      expect.objectContaining({ entryId: 'workers/match-worker.ts#default.fetch', exposure: 'exported-or-installed', callableKind: 'default-method' }),
      expect.objectContaining({ entryId: 'src/engine/selfplay-runner.ts#runSingleGame', exposure: 'exported-or-installed' }),
      expect.objectContaining({ entryId: 'workers/match-worker-runtime-preload.ts#installRuntimeModule', exposure: 'production-call-chain' })
    ]));
  });

  test('owns every node, edge, boundary, and ambient lookup in the actual reachable graph', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const graph = inventoryCardRuntimeGraph(repoRoot);
    expect(CARD_RUNTIME_GRAPH_ROOTS.length).toBeGreaterThanOrEqual(19);
    expect(CARD_RUNTIME_GRAPH_EDGE_KINDS).toEqual(expect.arrayContaining([
      'static-import', 'static-require', 'compatibility-resolution', 'dynamic-import',
      'di-port', 'whole-facade-cache'
    ]));
    expect(graph.nodes.length).toBeGreaterThan(150);
    expect(graph.edges.length).toBeGreaterThan(250);
    expect(graph.lookups.length).toBeGreaterThan(40);
    expect(graph.nodes.every((entry) => !!entry.disposition && entry.reachedFrom.length > 0)).toBe(true);
    expect(graph.edges.every((entry) => !!entry.disposition)).toBe(true);
    expect(graph.lookups.every((entry) => (
      !!entry.disposition && !!entry.owner && !!entry.reason && !!entry.removalCohort
      && entry.testOwner.endsWith('.test.ts') && !!entry.proofId
      && fs.existsSync(path.join(repoRoot, entry.testOwner))
    ))).toBe(true);
    expect(graph.roots.every((root) => graph.nodes.some((node) => node.file === root))).toBe(true);
    expect(graph.nodes.some((node) => node.file === 'utils/match-command-runtime.ts' && node.disposition === 'canonical-required')).toBe(true);
    expect(graph.nodes.some((node) => node.file === 'workers/match-worker.ts' && node.disposition === 'outer-adapter-allowlisted')).toBe(true);
    expect([...new Set(graph.lookups.map((entry) => entry.form))]).toEqual(expect.arrayContaining([
      'alias-require', 'computed-global', 'global-reference', 'literal-require', 'dynamic-import'
    ]));
    expect(graph.lookups.some((entry) => entry.form === 'alias-require')).toBe(true);
    expect(graph.lookups.some((entry) => entry.form === 'computed-global')).toBe(true);
    expect(graph.lookups.some((entry) => entry.form === 'whole-facade-cache')).toBe(false);
    expect(graph.lookups.some((entry) => entry.form === 'literal-require')).toBe(true);
    expect(graph.lookups.some((entry) => entry.form === 'duplicate-fallback')).toBe(false);
    const dispositionByFile = new Map(graph.nodes.map((node) => [node.file, node.disposition]));
    expect(graph.edges.filter((entry) => (
      dispositionByFile.get(entry.from) === 'canonical-required'
      && entry.disposition === 'runtime-discovery'
      && entry.kind !== 'di-port'
    ))).toEqual([]);
    expect(graph.edges.filter((entry) => (
      dispositionByFile.get(entry.from) === 'canonical-required'
      && entry.disposition === 'unresolved-relative'
    ))).toEqual([]);
    expect(graph.edges.filter((entry) => (
      dispositionByFile.get(entry.from) === 'canonical-required'
      && entry.kind === 'static-require'
    ))).toEqual([]);
    expect(graph.lookups.filter((entry) => entry.disposition === 'canonical-required')).toEqual([]);
    expect(graph.lookups.filter((entry) => (
      entry.disposition === 'canonical-required' && entry.form === 'whole-facade-cache'
    ))).toEqual([]);
    expect({
      roots: graph.roots.length,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      lookups: graph.lookups.length,
      unresolved: graph.unresolvedEdges.length
    }).toEqual({ roots: 20, nodes: 194, edges: 855, lookups: 586, unresolved: 32 });
    expect(crypto.createHash('sha256').update(JSON.stringify(graph)).digest('hex')).toBe(
      '9b880539da04450c0ad3333c5538b75d31648f4afcc6518df10dd3e4b5e2c188'
    );
    expect(verifyCardRuntimeGraphNegativeFixtures()).toEqual([
      'aliasRequire', 'aliasedComputedGlobal', 'bareGlobalReference', 'castComputedGlobal',
      'computedGlobal', 'duplicateFallback', 'dynamicImport', 'helperScopeArrayComputedGlobal',
      'literalRequire', 'scopeArrayComputedGlobal', 'umdRootGlobalReference', 'wholeFacadeCache'
    ]);
  });

  test('pins current and target failure/recovery ownership without blessing fallback as target behavior', () => {
    expect(CARD_RUNTIME_FAILURE_MAPPING.current.uiPreview).toContain('true');
    expect(CARD_RUNTIME_FAILURE_MAPPING.current.cpuTurn).toContain('schedules retry');
    expect(CARD_RUNTIME_FAILURE_MAPPING.target.uiPreview).toContain('no alternate query');
    expect(CARD_RUNTIME_FAILURE_MAPPING.target.cpuTurn).toContain('no retry');
    expect(CARD_RUNTIME_FAILURE_MAPPING.target.autoPass).toContain('reject before pass');
    expect(CARD_RUNTIME_RECOVERY_MATRIX.every((row) => row.retry === 0 && row.publish === 0)).toBe(true);
    expect(CARD_RUNTIME_RECOVERY_EVIDENCE.current).toHaveLength(6);
    expect(CARD_RUNTIME_RECOVERY_EVIDENCE.current.every((row) => (
      row.test.endsWith('.ts') && fs.existsSync(path.join(path.resolve(__dirname, '..'), row.test))
    ))).toBe(true);
    expect(CARD_RUNTIME_RECOVERY_EVIDENCE.targetActivation.status).toContain('active');
    expect(CARD_RUNTIME_RECOVERY_EVIDENCE.targetActivation.requiredTestOwners.every((testOwner) => (
      testOwner.endsWith('.ts') && fs.existsSync(path.join(path.resolve(__dirname, '..'), testOwner))
    ))).toBe(true);
  });

  test('records partial cancellation manager support as an activation contract', () => {
    expect(PARTIAL_CANCELLATION_MANAGER_DECISION.complete).toBe('supported');
    expect(PARTIAL_CANCELLATION_MANAGER_DECISION.absent).toContain('canonical complete manager');
    expect(PARTIAL_CANCELLATION_MANAGER_DECISION.classifierOnly).toContain('supported direct/public compatibility');
    expect(PARTIAL_CANCELLATION_MANAGER_DECISION.compatibilityOptions).toEqual([
      'refundCost:false', 'resetUsage:false', 'noConsume:true'
    ]);
  });
});
