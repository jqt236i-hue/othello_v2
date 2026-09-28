import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
  EXPLICIT_CARD_RUNTIME_ENTRY_LEDGER,
  type CardRuntimeEffectProfileId,
  type ExplicitCardRuntimeEntry
} from '../fixtures/card-runtime-entry-ledger';
import {
  analyzeCardRuntimeSourceFixture,
  buildCardRuntimeGraphManifest,
  DEFAULT_CARD_RUNTIME_GRAPH_ROOTS,
  type CardRuntimeGraphManifest
} from '../../scripts/card-runtime-graph';

export type CardRuntimeEntryKind = 'mutator' | 'query' | 'presentation-only';
export type CardRuntimeCohort =
  | 'state-deck-hand-charge'
  | 'target-legality'
  | 'board-topology'
  | 'marker-protection'
  | 'pending-cancellation'
  | 'canonical-resolution'
  | 'turn-phases'
  | 'command-boundary'
  | 'presentation';

export interface MutationEntryRecord {
  entryId: string;
  source: string;
  exportName: string;
  kind: CardRuntimeEntryKind;
  writesCanonicalState: boolean;
  writesRuntimeState: boolean;
  writesTransportPayload: boolean;
  appendsOrDrainsEvents: boolean;
  consumesRng: boolean;
  pure: boolean;
  dependencySensitive: boolean;
  dependencySensitivityEvidence: string;
  cohort?: CardRuntimeCohort;
  firstObservableEffect?: string;
  preflightOwner?: string;
  failureNormalizationOwner?: string;
  runtimeConsumers?: readonly string[];
  testOwner?: string;
  activationPreflightOwner?: string;
  taggedFailurePropagationOwner?: string;
  successShapedFallbackProhibition?: string;
  currentPreflight: 'none' | 'self' | 'outer';
  targetPreflight: 'self' | 'outer';
  evidence: string;
}

export const CARD_RUNTIME_GRAPH_ROOTS = DEFAULT_CARD_RUNTIME_GRAPH_ROOTS;

export const CARD_RUNTIME_GRAPH_EDGE_KINDS = Object.freeze([
  'static-import',
  'type-only-import',
  'static-require',
  'compatibility-resolution',
  'di-port',
  'whole-facade-cache',
  'dynamic-import',
  'unresolved-dynamic-import'
]);
function consumersFor(cohort: CardRuntimeCohort): readonly string[] {
  if (cohort === 'target-legality') return Object.freeze(['browser-preview', 'cpu', 'turn-pass', 'headless', 'worker']);
  if (cohort === 'pending-cancellation') return Object.freeze(['browser-selection', 'turn', 'network', 'headless', 'worker']);
  if (cohort === 'turn-phases' || cohort === 'command-boundary') return Object.freeze(['headless', 'local-authority', 'worker', 'cpu']);
  return Object.freeze(['headless', 'local-authority', 'worker', 'vite', 'classic', 'cpu', 'selfplay']);
}

const PROFILE_FLAGS: Readonly<Record<CardRuntimeEffectProfileId, {
  kind: CardRuntimeEntryKind;
  writesCanonicalState: boolean;
  writesRuntimeState: boolean;
  writesTransportPayload: boolean;
  appendsOrDrainsEvents: boolean;
  consumesRng: boolean;
}>> = Object.freeze({
  'pure-query': { kind: 'query', writesCanonicalState: false, writesRuntimeState: false, writesTransportPayload: false, appendsOrDrainsEvents: false, consumesRng: false },
  'cold-cache-query': { kind: 'query', writesCanonicalState: false, writesRuntimeState: true, writesTransportPayload: false, appendsOrDrainsEvents: false, consumesRng: false },
  'rng-query': { kind: 'query', writesCanonicalState: false, writesRuntimeState: false, writesTransportPayload: false, appendsOrDrainsEvents: false, consumesRng: true },
  'cold-cache-rng-query': { kind: 'query', writesCanonicalState: false, writesRuntimeState: true, writesTransportPayload: false, appendsOrDrainsEvents: false, consumesRng: true },
  'canonical-mutation': { kind: 'mutator', writesCanonicalState: true, writesRuntimeState: false, writesTransportPayload: false, appendsOrDrainsEvents: false, consumesRng: false },
  'canonical-event-mutation': { kind: 'mutator', writesCanonicalState: true, writesRuntimeState: false, writesTransportPayload: false, appendsOrDrainsEvents: true, consumesRng: false },
  'canonical-rng-event-mutation': { kind: 'mutator', writesCanonicalState: true, writesRuntimeState: false, writesTransportPayload: false, appendsOrDrainsEvents: true, consumesRng: true },
  'cold-cache-canonical-mutation': { kind: 'mutator', writesCanonicalState: true, writesRuntimeState: true, writesTransportPayload: false, appendsOrDrainsEvents: false, consumesRng: false },
  'cold-cache-canonical-event-mutation': { kind: 'mutator', writesCanonicalState: true, writesRuntimeState: true, writesTransportPayload: false, appendsOrDrainsEvents: true, consumesRng: false },
  'cold-cache-canonical-rng-event-mutation': { kind: 'mutator', writesCanonicalState: true, writesRuntimeState: true, writesTransportPayload: false, appendsOrDrainsEvents: true, consumesRng: true },
  'runtime-state-mutation': { kind: 'mutator', writesCanonicalState: false, writesRuntimeState: true, writesTransportPayload: false, appendsOrDrainsEvents: false, consumesRng: false },
  'transport-payload-mutation': { kind: 'mutator', writesCanonicalState: false, writesRuntimeState: false, writesTransportPayload: true, appendsOrDrainsEvents: false, consumesRng: false },
  'presentation-event-mutation': { kind: 'presentation-only', writesCanonicalState: false, writesRuntimeState: false, writesTransportPayload: false, appendsOrDrainsEvents: true, consumesRng: false },
  'cold-cache-presentation-event-mutation': { kind: 'presentation-only', writesCanonicalState: false, writesRuntimeState: true, writesTransportPayload: false, appendsOrDrainsEvents: true, consumesRng: false }
});

function characterizeExplicitEntry(entry: ExplicitCardRuntimeEntry): MutationEntryRecord {
  const flags = PROFILE_FLAGS[entry.profile];
  const pure = !flags.writesCanonicalState
    && !flags.writesRuntimeState
    && !flags.writesTransportPayload
    && !flags.appendsOrDrainsEvents
    && !flags.consumesRng;
  const dependencySensitive = entry.dependencySensitive;
  const record: MutationEntryRecord = {
    entryId: `${entry.source}#${entry.exportName}`,
    source: entry.source,
    exportName: entry.exportName,
    ...flags,
    pure,
    dependencySensitive,
    dependencySensitivityEvidence: dependencySensitive
      ? 'reviewed entry reaches a required card/turn/runtime service capability'
      : 'reviewed entry is self-contained and has no optional card-runtime service lookup',
    cohort: entry.dependencyCohort,
    firstObservableEffect: entry.firstObservableEffect,
    preflightOwner: entry.targetPreflight === 'self'
      ? 'entry-local CardRuntimeServices/TurnRuntimeServices assertion'
      : 'validated outer composer/command boundary',
    failureNormalizationOwner: entry.dependencyCohort === 'command-boundary'
      ? 'shared match-command authority boundary'
      : 'canonical card runtime boundary',
    runtimeConsumers: consumersFor(entry.dependencyCohort),
    testOwner: entry.dependencyCohort === 'turn-phases' || entry.dependencyCohort === 'command-boundary'
      ? 'test/game.turn-runtime-failure-atomicity.test.ts'
      : 'test/game.card-runtime-failure-atomicity.test.ts',
    currentPreflight: entry.currentPreflight,
    targetPreflight: entry.targetPreflight,
    evidence: entry.evidence
  };
  if (flags.kind === 'query' || entry.profile === 'transport-payload-mutation') {
    record.activationPreflightOwner = entry.targetPreflight === 'self'
      ? 'canonical runtime assertion before invocation'
      : 'runtime composer before closure/command reachability';
    record.taggedFailurePropagationOwner = entry.dependencyCohort === 'target-legality'
      ? 'browser preview or CPU integrity owner'
      : 'calling canonical/outer boundary';
    record.successShapedFallbackProhibition = 'runtime_unavailable must not become true, false, [], null, pass, retry, or an alternate action';
  }
  return Object.freeze(record);
}

export const DIRECT_RUNTIME_FUNCTION_EXPORTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'game/cpu-network-command-planner.ts': Object.freeze([
    'planCpuNetworkCommand', 'planCanonicalCpuNetworkCommand'
  ]),
  'game/cards/effect-resolver.ts': Object.freeze([
    'getCardHandManagerContext', 'getCardEffectTimingContext', 'getCardContext', 'applyCardUsage', 'cancelPendingSelection'
  ]),
  'game/turn/turn_pipeline_phases.ts': Object.freeze([
    'applyTurnStartPhase', 'applyCardUsagePhase', 'applyActionPhase', 'setTurnPipelinePhasesRuntime'
  ]),
  'game/turn/turn_pipeline.ts': Object.freeze(['applyTurn', 'applyTurnSafe']),
  'game/turn/turn_pipeline_factory.ts': Object.freeze(['createTurnPipelineModule']),
  'game/turn/pending-coordinator.ts': Object.freeze([
    'readPendingEffect', 'getPendingEffectType', 'writePendingEffect', 'clearPendingEffect',
    'requiresPendingTarget', 'getPendingSelectionContract', 'isSelectionOnlyEndTurnPendingType',
    'shouldDeferNetworkPublishForPendingType', 'shouldWaitForPlaybackIdleForPendingType',
    'resolvePendingSelectionDispatchKey', 'resolvePendingSelectionActionField',
    'buildPendingSelectionTargetPayload', 'applyPendingSelectionCardContext',
    'storePendingSelectionAction', 'readPendingSelectionAction', 'clearPendingSelectionAction',
    'clearPendingSelectionActionCache', 'syncPendingSelectionActionCache',
    'shouldRetainPendingSelectionAction', 'createPendingSelectionAction',
    'clearPendingSelectionFailureState'
  ]),
  'utils/match-command-runtime.ts': Object.freeze([
    'prepareMatchCommandAction', 'shouldSkipMatchCommandTurnStart',
    'validateCanonicalMatchCommandSnapshot', 'prepareMatchCommandExecution',
    'applyPreparedMatchCommandExecution', 'shouldReconcileMatchCommandTurnStart',
    'assembleMatchCommandActionPresentation', 'reconcileMatchCommandTurnStart',
    'finalizeMatchCommandExecution', 'executeMatchCommand'
  ]),
  'utils/match-auto-command.ts': Object.freeze([
    'isMatchAutoTurnPublishBody', 'resolveMatchAutoTurnPublishBody'
  ]),
  'scripts/local-match-runtime.ts': Object.freeze(['createRuntime']),
  'workers/match-worker.ts': Object.freeze([
    'createWorkerTurnPipelineModule', 'MatchRoomDurableObject', 'default.fetch'
  ]),
  'src/engine/selfplay-runner.ts': Object.freeze(['runSingleGame']),
  'browser-vite/module-bridge.ts': Object.freeze([
    'requireBundledModule', 'registerModuleAccessors', 'installBootModuleMetadata',
    'installModuleBridge', 'resetModuleBridgeForTests'
  ]),
  'entry-browser.js': Object.freeze([
    'requireBootModule', 'assignBootModuleGlobals', 'assignBootModuleDefaultGlobals', 'applyBootModuleEntry'
  ]),
  'workers/match-worker-runtime-preload.ts': Object.freeze(['installRuntimeModule'])
});

export function buildMutationEntryManifest(cardLogic: Record<string, unknown>): readonly MutationEntryRecord[] {
  const actualFacadeFunctions = Reflect.ownKeys(cardLogic)
    .filter((key): key is string => typeof key === 'string' && typeof cardLogic[key] === 'function')
    .sort();
  const ledgerFacadeFunctions = EXPLICIT_CARD_RUNTIME_ENTRY_LEDGER
    .filter((entry) => entry.source === 'game/logic/cards.ts')
    .map((entry) => entry.exportName)
    .sort();
  if (new Set(ledgerFacadeFunctions).size !== ledgerFacadeFunctions.length) {
    throw new Error('explicit card runtime ledger contains duplicate facade symbols');
  }
  if (JSON.stringify(actualFacadeFunctions) !== JSON.stringify(ledgerFacadeFunctions)) {
    const missing = actualFacadeFunctions.filter((name) => !ledgerFacadeFunctions.includes(name));
    const stale = ledgerFacadeFunctions.filter((name) => !actualFacadeFunctions.includes(name));
    throw new Error(`explicit card runtime facade ledger drift missing=${missing.join(',')} stale=${stale.join(',')}`);
  }
  const directExpected = Object.entries(DIRECT_RUNTIME_FUNCTION_EXPORTS)
    .flatMap(([source, names]) => names.map((exportName) => `${source}#${exportName}`))
    .sort();
  const directLedger = EXPLICIT_CARD_RUNTIME_ENTRY_LEDGER
    .filter((entry) => entry.source !== 'game/logic/cards.ts')
    .map((entry) => `${entry.source}#${entry.exportName}`)
    .sort();
  if (new Set(directLedger).size !== directLedger.length || JSON.stringify(directExpected) !== JSON.stringify(directLedger)) {
    throw new Error('explicit card runtime direct-entry ledger does not exactly match the reviewed direct export inventory');
  }
  return Object.freeze(EXPLICIT_CARD_RUNTIME_ENTRY_LEDGER.map(characterizeExplicitEntry));
}

function collectNamedDeclarations(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.add(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) names.add(node.name.text);
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) names.add(node.name.text);
    if (ts.isShorthandPropertyAssignment(node)) names.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return !!ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((modifier) => modifier.kind === kind);
}

function collectObjectMemberNames(node: ts.Node, names: Set<string>): void {
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isShorthandPropertyAssignment(property)) names.add(property.name.text);
      if ((ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
        && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
        names.add(property.name.text);
      }
    }
  }
  ts.forEachChild(node, (child) => collectObjectMemberNames(child, names));
}

function collectExportedOrInstalledNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const exportAssignmentIdentifiers = new Set<string>();
  const visit = (node: ts.Node): void => {
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isVariableStatement(node))
      && hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.add(node.name.text);
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
        }
      }
      if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) names.add('default');
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) names.add(element.name.text);
    }
    if (ts.isExportAssignment(node)) {
      if (!node.isExportEquals) names.add('default');
      if (ts.isObjectLiteralExpression(node.expression)) collectObjectMemberNames(node.expression, names);
      if (ts.isIdentifier(node.expression)) exportAssignmentIdentifiers.add(node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (exportAssignmentIdentifiers.size > 0) {
    const traceInitializer = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
        && exportAssignmentIdentifiers.has(node.name.text) && node.initializer) {
        collectObjectMemberNames(node.initializer, names);
      }
      ts.forEachChild(node, traceInitializer);
    };
    traceInitializer(sourceFile);
  }
  return names;
}

interface ProductionCallGraph {
  edges: ReadonlyMap<string, ReadonlySet<string>>;
  callCounts: ReadonlyMap<string, number>;
}

function collectProductionCallGraph(sourceFile: ts.SourceFile, declarations: ReadonlySet<string>): ProductionCallGraph {
  const mutableEdges = new Map<string, Set<string>>();
  const callCounts = new Map<string, number>();
  const addEdge = (from: string, to: string): void => {
    const targets = mutableEdges.get(from) || new Set<string>();
    targets.add(to);
    mutableEdges.set(from, targets);
    callCounts.set(to, (callCounts.get(to) || 0) + 1);
  };
  const declarationOwner = (node: ts.Node): string => {
    let current: ts.Node | undefined = node.parent;
    while (current && current !== sourceFile) {
      if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
      if (ts.isMethodDeclaration(current) && current.name
        && (ts.isIdentifier(current.name) || ts.isStringLiteral(current.name))) return current.name.text;
      if ((ts.isFunctionExpression(current) || ts.isArrowFunction(current))
        && current.parent && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
        return current.parent.name.text;
      }
      current = current.parent;
    }
    return '<module>';
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expression = node.expression;
      const calledName = ts.isIdentifier(expression)
        ? expression.text
        : ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : null;
      if (calledName && declarations.has(calledName)) addEdge(declarationOwner(node), calledName);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return {
    edges: new Map([...mutableEdges].map(([owner, targets]) => [owner, new Set(targets)])),
    callCounts
  };
}

function findCallPath(
  graph: ReadonlyMap<string, ReadonlySet<string>>,
  roots: readonly string[],
  target: string
): readonly string[] | null {
  const queue = roots.map((root) => [root]);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];
    if (current === target) return path;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of graph.get(current) || []) queue.push([...path, next]);
  }
  return null;
}

export interface DirectRuntimeEntryProof {
  entryId: string;
  exposure: 'exported-or-installed' | 'production-call-chain';
  referenceCount: number;
  callableKind: 'function' | 'class' | 'default-method';
  reachabilityPath: readonly string[];
  preflightMode: 'self' | 'outer';
  preflightOwner: string;
}

export function inspectDirectEntryProofs(repoRoot: string): readonly DirectRuntimeEntryProof[] {
  const verified: DirectRuntimeEntryProof[] = [];
  for (const [source, names] of Object.entries(DIRECT_RUNTIME_FUNCTION_EXPORTS)) {
    const sourceText = fs.readFileSync(path.join(repoRoot, source), 'utf8');
    const sourceFile = ts.createSourceFile(source, sourceText, ts.ScriptTarget.Latest, true,
      source.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const declarations = collectNamedDeclarations(sourceFile);
    const exportedOrInstalled = collectExportedOrInstalledNames(sourceFile);
    const callGraph = collectProductionCallGraph(sourceFile, declarations);
    const exportedRoots = [...exportedOrInstalled].filter((name) => declarations.has(name));
    for (const name of names) {
      const isDefaultFetch = name === 'default.fetch';
      const declarationName = isDefaultFetch ? 'matchWorkerEntrypoint' : name;
      if (!isDefaultFetch && !declarations.has(name)) {
        throw new Error(`direct runtime entry declaration missing: ${source}#${name}`);
      }
      const directlyExposed = isDefaultFetch || exportedOrInstalled.has(name);
      const reachabilityPath = directlyExposed
        ? [name]
        : findCallPath(callGraph.edges, ['<module>', ...exportedRoots], declarationName);
      if (!reachabilityPath) {
        throw new Error(`direct runtime entry is neither exported/installed nor production-reachable: ${source}#${name}`);
      }
      const ledger = EXPLICIT_CARD_RUNTIME_ENTRY_LEDGER.find((entry) => (
        entry.source === source && entry.exportName === name
      ));
      if (!ledger) throw new Error(`direct runtime entry has no ledger record: ${source}#${name}`);
      const declarationNodeKind = isDefaultFetch
        ? 'default-method'
        : sourceText.match(new RegExp(`(?:export\\s+)?class\\s+${name}\\b`))
          ? 'class'
          : 'function';
      verified.push(Object.freeze({
        entryId: `${source}#${name}`,
        exposure: directlyExposed ? 'exported-or-installed' : 'production-call-chain',
        referenceCount: callGraph.callCounts.get(declarationName) || 0,
        callableKind: declarationNodeKind,
        reachabilityPath: Object.freeze([...reachabilityPath]),
        preflightMode: ledger.targetPreflight,
        preflightOwner: ledger.targetPreflight === 'self'
          ? `${source}#${name} validates its immutable runtime service bundle before the first observable effect`
          : `${source}#${name} is reachable only through its reviewed outer composer/authority preflight`
      }));
    }
  }
  return Object.freeze(verified.sort((left, right) => left.entryId.localeCompare(right.entryId)));
}

export function verifyDirectEntryDeclarations(repoRoot: string): readonly string[] {
  return Object.freeze(inspectDirectEntryProofs(repoRoot).map((proof) => proof.entryId));
}

export const FACADE_IDENTITY_BASELINE = Object.freeze({
  ownKeyCount: 291,
  functionCount: 265,
  symbolCount: 0,
  prototype: 'Object.prototype',
  descriptor: Object.freeze({ enumerable: true, configurable: true, writable: true }),
  functionAliasGroupCount: 0,
  repeatedLoadIdentity: 'same-commonjs-export',
  classicRegistrationCount: 1,
  classicGlobalInstallCount: 1,
  laneAliases: Object.freeze({
    source: Object.freeze(['require(game/logic/cards)', 'ModuleExportUtils.unwrapModuleExport(require)']),
    dist: Object.freeze(['require(dist/game/logic/cards)', 'built legacy-compatible CommonJS export']),
    vite: Object.freeze(['globalThis.CardLogic', 'globalThis.require(game/logic/cards)', 'repeated module-bridge lookup']),
    classic: Object.freeze(['globalThis.CardLogic', 'globalThis.require(game/logic/cards)', 'repeated classic registry lookup']),
    worker: Object.freeze(['dynamic import game/logic/cards', 'repeated module-cache import', 'Worker command CardLogic'])
  }),
  evaluationTrace: Object.freeze({
    source: Object.freeze(['first require evaluates once', 'second require returns same object', 'resetModules reconstructs object/functions']),
    vite: Object.freeze(['registry registration once', 'global install once', 'repeated bridge lookup returns same object', 'page reload reconstructs']),
    classic: Object.freeze(['registry registration once', 'global install after module resolver', 'UI bootstrap after facade', 'page reload reconstructs']),
    worker: Object.freeze(['preload installs dependencies once per isolate', 'CardLogic dynamic import is cached', 'new isolate reconstructs'])
  }),
  moduleStateInventoryPolicy: Object.freeze({
    closure: 'every source node reachable from the reviewed card-runtime graph',
    declarations: 'module-lifetime let/var plus mutated const Map/Set/WeakMap/WeakSet/Array/Object containers',
    reset: 'source-visible reset/clear/set/refresh owner when present; otherwise module/isolate/page reconstruction',
    proof: 'AST declaration, mutation, owner, reset, reconstruction, family, and stable inventory digest'
  })
});

export type CardRuntimeModuleStateFamily =
  | 'runtime-service-or-cache'
  | 'mutable-container-or-registry'
  | 'lifecycle-flag-counter-or-promise'
  | 'module-mutable-binding';

export interface CardRuntimeModuleStateOwner {
  id: string;
  file: string;
  declarationName: string;
  declarationKind: 'let' | 'var' | 'mutated-const-container';
  family: CardRuntimeModuleStateFamily;
  owner: string;
  resetOwner: string;
  reconstructionPolicy: string;
  mutationEvidence: readonly string[];
}

function isTopLevelModuleFactory(
  functionNode: ts.FunctionExpression | ts.ArrowFunction,
  sourceFile: ts.SourceFile
): boolean {
  let current: ts.Node = functionNode;
  while (current.parent && ts.isParenthesizedExpression(current.parent)) current = current.parent;
  const invocation = current.parent;
  if (!invocation || !ts.isCallExpression(invocation)
    || (invocation.expression !== current && !invocation.arguments.includes(current as ts.Expression))) return false;
  current = invocation;
  while (current.parent && current.parent !== sourceFile) {
    current = current.parent;
    if (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)
      || ts.isArrowFunction(current) || ts.isMethodDeclaration(current)
      || ts.isGetAccessorDeclaration(current) || ts.isSetAccessorDeclaration(current)
      || ts.isConstructorDeclaration(current) || ts.isClassLike(current)) return false;
  }
  return current.parent === sourceFile;
}

function isModuleLifetimeDeclaration(node: ts.VariableDeclaration, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current && current !== sourceFile) {
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      return isTopLevelModuleFactory(current, sourceFile);
    }
    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)
      || ts.isGetAccessorDeclaration(current) || ts.isSetAccessorDeclaration(current)
      || ts.isConstructorDeclaration(current)) return false;
    if (ts.isClassLike(current)) return false;
    current = current.parent;
  }
  return current === sourceFile;
}

function mutableContainerKind(initializer: ts.Expression | undefined): string | null {
  if (!initializer) return null;
  const expression = ts.isParenthesizedExpression(initializer) ? initializer.expression : initializer;
  if (ts.isArrayLiteralExpression(expression)) return 'Array';
  if (ts.isObjectLiteralExpression(expression)) return 'Object';
  if (ts.isNewExpression(expression) && ts.isIdentifier(expression.expression)
    && /^(?:Map|Set|WeakMap|WeakSet)$/.test(expression.expression.text)) {
    return expression.expression.text;
  }
  return null;
}

function collectStateMutationEvidence(sourceFile: ts.SourceFile, declarationName: string): readonly string[] {
  const evidence = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const left = node.left;
      if ((ts.isIdentifier(left) && left.text === declarationName)
        || ((ts.isPropertyAccessExpression(left) || ts.isElementAccessExpression(left))
          && ts.isIdentifier(left.expression) && left.expression.text === declarationName)) {
        evidence.add(`${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}:assignment`);
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === declarationName
      && /^(?:set|add|delete|clear|push|pop|shift|unshift|splice|sort|reverse)$/.test(node.expression.name.text)) {
      evidence.add(`${sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1}:${node.expression.name.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze([...evidence].sort());
}

function findStateResetOwner(sourceFile: ts.SourceFile, declarationName: string): string | null {
  let owner: string | null = null;
  const visit = (node: ts.Node): void => {
    const isFunctionWithBody = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)
      || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)
      || ts.isConstructorDeclaration(node);
    if (owner || !isFunctionWithBody || !node.body) {
      if (!owner) ts.forEachChild(node, visit);
      return;
    }
    const functionName = (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)))
      ? node.name.text
      : node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
        ? node.parent.name.text
        : null;
    if (!functionName || !/^(?:reset|clear|set|refresh|install|dispose|destroy|invalidate)/i.test(functionName)) {
      ts.forEachChild(node, visit);
      return;
    }
    let touchesState = false;
    const inspect = (child: ts.Node): void => {
      if (ts.isIdentifier(child) && child.text === declarationName) touchesState = true;
      if (!touchesState) ts.forEachChild(child, inspect);
    };
    inspect(node.body);
    if (touchesState) owner = functionName;
    if (!owner) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return owner;
}

function classifyStateFamily(name: string, containerKind: string | null): CardRuntimeModuleStateFamily {
  if (containerKind || /(?:registry|queue|events|byPlayer|identit|scopes|keys)$/i.test(name)) {
    return 'mutable-container-or-registry';
  }
  if (/(?:cache|module|runtime|service|context|adapter|resolver|logic)$/i.test(name)) {
    return 'runtime-service-or-cache';
  }
  if (/(?:next|seq|count|warn|ready|initialized|installed|generation|promise|pending)$/i.test(name)) {
    return 'lifecycle-flag-counter-or-promise';
  }
  return 'module-mutable-binding';
}

export function inventoryReviewedModuleStateOwners(repoRoot: string): readonly CardRuntimeModuleStateOwner[] {
  const records: CardRuntimeModuleStateOwner[] = [];
  const graph = inventoryCardRuntimeGraph(repoRoot);
  for (const graphNode of graph.nodes) {
    const relativeFile = graphNode.file;
    if (!/\.[cm]?[jt]sx?$/.test(relativeFile)) continue;
    const absoluteFile = path.join(repoRoot, relativeFile);
    if (!fs.existsSync(absoluteFile)) continue;
    const sourceText = fs.readFileSync(absoluteFile, 'utf8');
    const sourceFile = ts.createSourceFile(
      relativeFile,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      /\.[cm]?tsx?$/.test(relativeFile) ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
        && isModuleLifetimeDeclaration(node, sourceFile)) {
        const list = node.parent;
        if (ts.isVariableDeclarationList(list)) {
          const isLet = (list.flags & ts.NodeFlags.Let) !== 0;
          const isConst = (list.flags & ts.NodeFlags.Const) !== 0;
          const containerKind = mutableContainerKind(node.initializer);
          const mutationEvidence = collectStateMutationEvidence(sourceFile, node.name.text);
          const declarationKind = isLet
            ? 'let'
            : !isConst
              ? 'var'
              : containerKind && mutationEvidence.length > 0
                ? 'mutated-const-container'
                : null;
          if (declarationKind) {
            const resetFunction = findStateResetOwner(sourceFile, node.name.text);
            records.push(Object.freeze({
              id: `${relativeFile}#${node.name.text}`,
              file: relativeFile,
              declarationName: node.name.text,
              declarationKind,
              family: classifyStateFamily(node.name.text, containerKind),
              owner: `${relativeFile} module evaluation and its exported/runtime entrypoints`,
              resetOwner: resetFunction
                ? `${relativeFile}#${resetFunction}`
                : `${relativeFile} module/isolate/page reconstruction`,
              reconstructionPolicy: resetFunction
                ? `invoke ${resetFunction} for same-isolate lifecycle reset; module/isolate/page reload reconstructs the declaration`
                : 'no public same-isolate reset is promised; module/isolate/page reload reconstructs the declaration',
              mutationEvidence
            }));
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  const unique = new Map(records.map((record) => [record.id, record]));
  return Object.freeze([...unique.values()].sort((left, right) => left.id.localeCompare(right.id)));
}

export const IMPORTANT_CARD_CONSTANTS = Object.freeze({
  INITIAL_HAND_SIZE: 0,
  TIME_BOMB_TURNS: 3,
  ULTIMATE_DRAGON_TURNS: 8,
  ULTIMATE_DESTROY_GOD_TURNS: 6,
  ULTIMATE_HYPERACTIVE_TURNS: 12,
  STONE_SALVATION_GOD_TURNS: 12,
  POISON_CELL_TURNS: 10,
  POISON_STONE_TURNS: 5,
  SCORCHED_CELL_TURNS: 10,
  SCORCHED_STONE_TURNS: 3,
  HEALING_CELL_TURNS: 8,
  HEALING_CELL_DURATION_BONUS: 3
});

export const CARD_RUNTIME_FAILURE_MAPPING = Object.freeze({
  current: Object.freeze({
    activation: 'Worker preload registers the global key before loading; a loader exception propagates and aborts evaluation, while a present usable global skips the loader',
    directCanonical: 'applyTurnSafe converts ordinary throws to the existing rejectedReason schema',
    uiPreview: 'getUsableCardIds throw -> canUseCard -> true',
    cpuQuery: 'analyzeCardUsability throw -> getUsableCardIds -> hasUsableCard -> canUseCard -> empty',
    cpuTurn: 'generic handler clears pending, releases processing, and schedules retry',
    autoPass: 'hasUsableCard absence is observed as no usable card; an untagged thrown exception propagates before pass completion',
    emptyContext: 'safe context helper/getCardContext failure -> empty protection context'
  }),
  target: Object.freeze({
    activation: 'canonical branded-structural runtime_unavailable before first mutation',
    directCanonical: 'existing wire-compatible rejection with zero mutation/version/event/PRNG change',
    uiPreview: 'tag reaches UI integrity latch; no alternate query, true result, or publish',
    cpuQuery: 'tag reaches CPU integrity owner; no alternate query/candidate/action/PRNG draw',
    cpuTurn: 'release processing, invalidate scheduler/timers, preserve pending, no retry',
    autoPass: 'reject before pass/turn/version/journal mutation',
    emptyContext: 'tag propagates; no fabricated empty protection context'
  })
});

export const CARD_RUNTIME_RECOVERY_MATRIX = Object.freeze([
  Object.freeze({ lane: 'headless/selfplay', gameState: 'same-instance/raw-equal', cardState: 'same-instance/raw-equal', pending: 'preserved', turn: 'unchanged', stateVersion: 'n/a', prngState: 'unchanged', prngCalls: 0, events: 'unchanged', uiBusy: 'n/a', inputLock: 'n/a', cpuProcessing: 'n/a', schedulerGeneration: 'n/a', timerCount: 0, retry: 0, alternateAction: 0, publish: 0, surface: 'typed rejection' }),
  Object.freeze({ lane: 'local/worker command', gameState: 'same-instance/raw-equal', cardState: 'same-instance/raw-equal', pending: 'preserved', turn: 'unchanged', stateVersion: 'unchanged', prngState: 'unchanged', prngCalls: 0, events: 'unchanged', uiBusy: 'n/a', inputLock: 'n/a', cpuProcessing: 'n/a', schedulerGeneration: 'n/a', timerCount: 0, retry: 0, alternateAction: 0, publish: 0, surface: 'wire-compatible rejection' }),
  Object.freeze({ lane: 'Vite/classic boot', gameState: 'not-created', cardState: 'not-created', pending: 'not-created', turn: 'not-created', stateVersion: 'not-created', prngState: 'not-created', prngCalls: 0, events: 'not-created', uiBusy: 'settled', inputLock: 'latched-disabled', cpuProcessing: 'not-started', schedulerGeneration: 'invalidated', timerCount: 0, retry: 0, alternateAction: 0, publish: 0, surface: 'gameplay disabled before activation' }),
  Object.freeze({ lane: 'UI preview/action', gameState: 'same-instance/raw-equal', cardState: 'same-instance/raw-equal', pending: 'canonical pending preserved', turn: 'unchanged', stateVersion: 'unchanged', prngState: 'unchanged', prngCalls: 0, events: 'unchanged', uiBusy: 'settled by integrity owner', inputLock: 'latched-disabled', cpuProcessing: 'n/a', schedulerGeneration: 'n/a', timerCount: 0, retry: 0, alternateAction: 0, publish: 0, surface: 'reload-required latch' }),
  Object.freeze({ lane: 'CPU turn/scheduler', gameState: 'same-instance/raw-equal', cardState: 'same-instance/raw-equal', pending: 'preserved', turn: 'unchanged', stateVersion: 'unchanged', prngState: 'unchanged', prngCalls: 0, events: 'unchanged', uiBusy: 'n/a', inputLock: 'n/a', cpuProcessing: 'released', schedulerGeneration: 'invalidated', timerCount: 0, retry: 0, alternateAction: 0, publish: 0, surface: 'terminal integrity notification' }),
  Object.freeze({ lane: 'AUTO/timeout/direct pass', gameState: 'same-instance/raw-equal', cardState: 'same-instance/raw-equal', pending: 'preserved', turn: 'unchanged', stateVersion: 'unchanged', prngState: 'unchanged', prngCalls: 0, events: 'unchanged', uiBusy: 'n/a', inputLock: 'n/a', cpuProcessing: 'n/a', schedulerGeneration: 'n/a', timerCount: 0, retry: 0, alternateAction: 0, publish: 0, surface: 'rejected before pass' })
]);

export const CARD_RUNTIME_RECOVERY_EVIDENCE = Object.freeze({
  current: Object.freeze([
    Object.freeze({ lane: 'headless/selfplay', entry: 'src/engine/selfplay-runner.ts#applyDecisionWithRetry', test: 'test/game.card-runtime-current-failure-characterization.test.ts', observation: 'non-retryable rejection throws terminally without committing state' }),
    Object.freeze({ lane: 'local authority', entry: 'scripts/local-match-runtime.ts#createRuntime.applyCommand', test: 'test/game.card-runtime-current-failure-characterization.test.ts', observation: 'valid command reaches the injected runtime execution failure with snapshot, version, operation history, journal, and SSE state unchanged' }),
    Object.freeze({ lane: 'Worker authority', entry: 'workers/match-worker.ts#MatchRoomDurableObject.handlePublish', test: 'scripts/worker-bundle-smoke.ts', observation: 'bundled valid AUTO command reaches injected CardLogic failure with room, storage, operation/presentation journals, save count, and broadcast count unchanged' }),
    Object.freeze({ lane: 'UI preview/action', entry: 'cards/card-interaction.ts#_isSelectedCardUsableNow/_handleServerAuthoredCardUse', test: 'test/game.card-runtime-current-failure-characterization.test.ts', observation: 'fallback may look usable; publish owner acquires then settles busy lock on rejection' }),
    Object.freeze({ lane: 'CPU turn/scheduler', entry: 'game/cpu-turn-handler.ts#handleCpuTurnError', test: 'test/game.card-runtime-current-failure-characterization.test.ts', observation: 'generic error clears pending and schedules one timer in current generation; reset invalidates generation and timer' }),
    Object.freeze({ lane: 'AUTO/direct pass', entry: 'game/turn/turn_pipeline_phases.ts#applyPassActionStage', test: 'test/game.card-runtime-current-failure-characterization.test.ts', observation: 'missing API looks false; thrown query aborts before pass completion' })
  ]),
  targetActivation: Object.freeze({
    owner: 'lane-specific integrity adapters and command normalization',
    status: 'active after static composition cutover',
    requiredTestOwners: Object.freeze([
      'test/game.card-runtime-query-failure.test.ts',
      'test/game.turn-runtime-pass-failure.test.ts',
      'test/cpu.turn-handler.runtime-unavailable.test.ts',
      'test/ui.card-runtime-integrity-failure.test.ts'
    ])
  })
});

export const PARTIAL_CANCELLATION_MANAGER_DECISION = Object.freeze({
  complete: 'supported',
  absent: 'supported through the canonical complete manager fallback when the override is absent',
  classifierOnly: 'supported direct/public compatibility path; preserve refund, usage reset, discard restore, and pending clear semantics',
  compatibilityOptions: Object.freeze(['refundCost:false', 'resetUsage:false', 'noConsume:true'])
});

export function inventoryCardRuntimeGraph(repoRoot: string): CardRuntimeGraphManifest {
  return buildCardRuntimeGraphManifest(repoRoot, CARD_RUNTIME_GRAPH_ROOTS);
}

export const CARD_RUNTIME_GRAPH_NEGATIVE_FIXTURES = Object.freeze({
  aliasRequire: Object.freeze({ source: 'const _require = require; _require(modulePath);', expected: 'alias-require' }),
  literalRequire: Object.freeze({ source: 'const api = require("./logic/cards");', expected: 'literal-require' }),
  dynamicImport: Object.freeze({ source: 'async function load(id: string) { return import(id); }', expected: 'dynamic-import' }),
  computedGlobal: Object.freeze({ source: 'const value = globalThis[moduleKey] || self[otherKey];', expected: 'computed-global' }),
  castComputedGlobal: Object.freeze({ source: 'const value = (self as any)[moduleKey];', expected: 'computed-global' }),
  aliasedComputedGlobal: Object.freeze({ source: 'const runtimeRoot = globalThis; const value = runtimeRoot[moduleKey];', expected: 'computed-global' }),
  scopeArrayComputedGlobal: Object.freeze({ source: 'const scopes = [globalThis, self]; for (const scope of scopes) { void scope[moduleKey]; }', expected: 'computed-global' }),
  helperScopeArrayComputedGlobal: Object.freeze({ source: 'function getScopes() { const scopes: any[] = []; scopes.push(globalThis); return scopes; } const scopes = getScopes(); for (const scope of scopes) { void scope[moduleKey]; }', expected: 'computed-global' }),
  umdRootGlobalReference: Object.freeze({ source: '(function (root: any) { return root.CardLogic; }(typeof self !== "undefined" ? self : this));', expected: 'global-reference' }),
  bareGlobalReference: Object.freeze({ source: 'const scopes: unknown[] = []; scopes.push(globalThis);', expected: 'global-reference' }),
  wholeFacadeCache: Object.freeze({ source: 'let cachedCardLogic = null; cachedCardLogic = require("./logic/cards");', expected: 'whole-facade-cache' }),
  duplicateFallback: Object.freeze({ source: 'const api = require("./logic/cards") || globalThis.CardLogic;', expected: 'duplicate-fallback' })
});

export function verifyCardRuntimeGraphNegativeFixtures(): readonly string[] {
  const verified: string[] = [];
  for (const [name, fixture] of Object.entries(CARD_RUNTIME_GRAPH_NEGATIVE_FIXTURES)) {
    const forms = analyzeCardRuntimeSourceFixture(fixture.source);
    if (!forms.includes(fixture.expected as any)) {
      throw new Error(`card runtime graph negative fixture was not detected: ${name} -> ${fixture.expected}`);
    }
    verified.push(name);
  }
  return Object.freeze(verified.sort());
}

const CHARACTERIZATION_RUNTIME_UNAVAILABLE = new WeakSet<object>();
const CHARACTERIZATION_RUNTIME_UNAVAILABLE_BRAND = Symbol.for(
  'card-reversi.card-runtime-unavailable.characterization.v1'
);
const CHARACTERIZATION_RUNTIME_UNAVAILABLE_BRAND_VALUE = 'card-runtime-unavailable:characterization:v1';

export const CHARACTERIZATION_RUNTIME_UNAVAILABLE_CODE = 'runtime_unavailable';

export function createCharacterizationRuntimeUnavailableError(
  capability: string,
  cohort = 'canonical-card-runtime'
): Error {
  const error = new Error(`required card runtime capability is unavailable: ${capability}`);
  Object.defineProperties(error, {
    name: { value: 'CardRuntimeUnavailableError', configurable: true },
    code: { value: CHARACTERIZATION_RUNTIME_UNAVAILABLE_CODE, enumerable: true },
    capability: { value: capability, enumerable: true },
    cohort: { value: cohort, enumerable: true },
    [CHARACTERIZATION_RUNTIME_UNAVAILABLE_BRAND]: {
      value: CHARACTERIZATION_RUNTIME_UNAVAILABLE_BRAND_VALUE,
      enumerable: false,
      configurable: false,
      writable: false
    }
  });
  CHARACTERIZATION_RUNTIME_UNAVAILABLE.add(error);
  return error;
}

export function isCharacterizationRuntimeUnavailableError(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (CHARACTERIZATION_RUNTIME_UNAVAILABLE.has(value as object)) return true;
  const candidate = value as Record<PropertyKey, unknown>;
  const brand = Object.getOwnPropertyDescriptor(candidate, CHARACTERIZATION_RUNTIME_UNAVAILABLE_BRAND);
  return Object.prototype.toString.call(candidate) === '[object Error]'
    && candidate.name === 'CardRuntimeUnavailableError'
    && candidate.code === CHARACTERIZATION_RUNTIME_UNAVAILABLE_CODE
    && typeof candidate.capability === 'string'
    && candidate.capability.length > 0
    && typeof candidate.cohort === 'string'
    && candidate.cohort.length > 0
    && !!brand
    && brand.value === CHARACTERIZATION_RUNTIME_UNAVAILABLE_BRAND_VALUE
    && brand.enumerable === false
    && brand.configurable === false
    && brand.writable === false;
}

export function compileNamedFunctionFromSource(
  repoRoot: string,
  relativeFile: string,
  functionName: string,
  bindings: Readonly<Record<string, unknown>>
): (...args: any[]) => any {
  const sourceText = fs.readFileSync(path.join(repoRoot, relativeFile), 'utf8');
  const sourceFile = ts.createSourceFile(relativeFile, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let declaration: ts.FunctionDeclaration | null = null;
  const visit = (node: ts.Node): void => {
    if (!declaration && ts.isFunctionDeclaration(node) && node.name?.text === functionName) declaration = node;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!declaration) throw new Error(`function declaration not found: ${relativeFile}#${functionName}`);
  const foundDeclaration = declaration as ts.FunctionDeclaration;
  const transpiled = ts.transpileModule(foundDeclaration.getText(sourceFile), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None }
  }).outputText;
  const bindingNames = Object.keys(bindings);
  const factory = new Function(...bindingNames, `'use strict';\n${transpiled}\nreturn ${functionName};`);
  return factory(...bindingNames.map((name) => bindings[name]));
}
