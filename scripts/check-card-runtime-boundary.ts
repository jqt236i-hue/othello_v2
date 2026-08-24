import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {
  analyzeCardRuntimeSourceFixture,
  buildCardRuntimeGraphManifest,
  DEFAULT_CARD_RUNTIME_GRAPH_ROOTS,
  fixtureImportsCompatibilityEntry,
  type CardRuntimeGraphManifest
} from './card-runtime-graph';

const ERROR_PRODUCER_FILES = new Set([
  'game/logic/card-runtime-errors.ts',
  'game/logic/card-runtime-contracts.ts',
  'game/turn/turn-runtime-services.ts'
]);
const ROOT_AGGREGATE_FILES = new Set([
  'game/logic/card-runtime-contracts.ts',
  'game/logic/card-runtime-composer.ts',
  'game/logic/cards-runtime-factory.ts'
]);
const REVIEWED_CATCH_BOUNDARY_PRODUCERS = new Map<string, ReadonlySet<string>>([
  ['game/logic/card-runtime-contracts.ts', new Set([
    'readRuntimeServiceDescriptor',
    'readRuntimeServiceFrozenState',
    'assertExactServiceKeys',
    'assertRequiredModuleExports'
  ])]
]);

export interface CardRuntimeBoundaryReport {
  readonly canonicalNodeCount: number;
  readonly canonicalRuntimeDiscoveryEdges: number;
  readonly canonicalStaticRequireEdges: number;
  readonly canonicalUnresolvedRelativeEdges: number;
  readonly canonicalLegacyLookups: number;
  readonly canonicalCompatibilityEntryEdges: number;
  readonly canonicalWholeFacadeCaches: number;
  readonly negativeFixtures: readonly string[];
}

function parseSource(relativeFile: string, source: string): ts.SourceFile {
  return ts.createSourceFile(
    relativeFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.[cm]?tsx?$/.test(relativeFile) ? ts.ScriptKind.TS : ts.ScriptKind.JS
  );
}

function nodeInsideCatch(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isCatchClause(current)) return true;
    current = current.parent;
  }
  return false;
}

function enclosingFunctionName(node: ts.Node): string | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    current = current.parent;
  }
  return null;
}

function isReviewedCatchBoundaryProducer(relativeFile: string, node: ts.Node): boolean {
  const allowedFunctions = REVIEWED_CATCH_BOUNDARY_PRODUCERS.get(relativeFile);
  if (!allowedFunctions) return false;
  const functionName = enclosingFunctionName(node);
  return functionName !== null && allowedFunctions.has(functionName);
}

function inspectErrorContract(relativeFile: string, source: string): readonly string[] {
  const failures: string[] = [];
  const sourceFile = parseSource(relativeFile, source);
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'createCardRuntimeUnavailableError'
      && relativeFile !== 'game/logic/card-runtime-errors.ts') {
      failures.push(`${relativeFile}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1} duplicates the runtime-unavailable constructor`);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'createCardRuntimeUnavailableError') {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      if (!ERROR_PRODUCER_FILES.has(relativeFile)) {
        failures.push(`${relativeFile}:${line} creates runtime_unavailable outside the reviewed producer set`);
      }
      if (nodeInsideCatch(node) && !isReviewedCatchBoundaryProducer(relativeFile, node)) {
        failures.push(`${relativeFile}:${line} retags an exception from a catch clause`);
      }
    }
    if (ts.isCatchClause(node)) {
      const text = node.block.getText(sourceFile);
      if (/\.message\b[^\n]*(?:runtime[_ -]?unavailable|capabilit)/i.test(text)
        || /\.code\b[^\n]*runtime_unavailable/i.test(text)) {
        failures.push(`${relativeFile}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1} classifies runtime availability by message/code matching`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (relativeFile !== 'game/logic/card-runtime-errors.ts'
    && source.includes('card-runtime-unavailable:v1')) {
    failures.push(`${relativeFile} duplicates the canonical runtime-unavailable brand value`);
  }
  return failures;
}

function verifyNegativeFixtures(repoRoot: string): readonly string[] {
  const fixtures = Object.freeze({
    aliasRequire: ['const _require = require; _require(moduleName);', 'alias-require'],
    literalRequire: ['const api = require("./cards");', 'literal-require'],
    dynamicImport: ['async function load(name: string) { return import(name); }', 'dynamic-import'],
    computedGlobal: ['const value = globalThis[moduleName];', 'computed-global'],
    wholeFacadeCache: ['let cachedCardLogic = null; cachedCardLogic = require("./cards");', 'whole-facade-cache'],
    duplicateFallback: ['const api = require("./cards") || globalThis.CardLogic;', 'duplicate-fallback']
  } satisfies Readonly<Record<string, readonly [string, string]>>);
  const verified: string[] = [];
  for (const [name, [source, expected]] of Object.entries(fixtures)) {
    if (!analyzeCardRuntimeSourceFixture(source).includes(expected as any)) {
      throw new Error(`boundary checker negative fixture was not detected: ${name} -> ${expected}`);
    }
    verified.push(name);
  }
  const retagSource = 'try { run(); } catch (error) { throw createCardRuntimeUnavailableError(error.message); }';
  const retagFailures = inspectErrorContract('game/example.ts', retagSource);
  if (!retagFailures.some((failure) => failure.includes('retags an exception'))) {
    throw new Error('boundary checker negative fixture was not detected: catchRetag');
  }
  verified.push('catchRetag');
  const compatibilityEntrySource = "import Registry = require('../../shared/special-stone-registry');";
  if (!fixtureImportsCompatibilityEntry(
    repoRoot,
    'game/logic/__boundary-fixture__.ts',
    compatibilityEntrySource
  )) {
    throw new Error('boundary checker negative fixture was not detected: canonicalCompatibilityEntryImport');
  }
  verified.push('canonicalCompatibilityEntryImport');
  return Object.freeze(verified.sort());
}

function read(repoRoot: string, relativeFile: string): string {
  return fs.readFileSync(path.join(repoRoot, relativeFile), 'utf8');
}

function assertFactoryDag(repoRoot: string): readonly string[] {
  const failures: string[] = [];
  const factory = read(repoRoot, 'game/logic/cards-runtime-factory.ts');
  const composer = read(repoRoot, 'game/logic/card-runtime-composer.ts');
  const facade = read(repoRoot, 'game/logic/cards.ts');
  if (/from ['"]\.\/card-runtime-composer['"]|require\(['"]\.\/cards['"]\)/.test(factory)) {
    failures.push('cards-runtime-factory.ts must not import the composer or stable facade');
  }
  if (/from ['"]\.\/cards-runtime-factory['"]|require\(['"]\.\/cards(?:-runtime-factory)?['"]\)/.test(composer)) {
    failures.push('card-runtime-composer.ts must not import the factory or stable facade');
  }
  if (!facade.includes("from './card-runtime-composer'")
    || !facade.includes("require('./cards-runtime-factory')")) {
    failures.push('cards.ts must remain the only default composer/factory assembly point');
  }
  if (/CardRuntimeServices\.[A-Za-z]+\.[A-Za-z]+\s+as\s+any/.test(factory)) {
    failures.push('cards-runtime-factory.ts must consume typed capability ports without as-any service aliases');
  }
  return failures;
}

export function runCardRuntimeBoundaryCheck(repoRoot = path.resolve(__dirname, '..', '..')): CardRuntimeBoundaryReport {
  const graph: CardRuntimeGraphManifest = buildCardRuntimeGraphManifest(repoRoot, DEFAULT_CARD_RUNTIME_GRAPH_ROOTS);
  const disposition = new Map(graph.nodes.map((node) => [node.file, node.disposition]));
  const canonicalNodes = graph.nodes.filter((node) => node.disposition === 'canonical-required');
  const runtimeDiscovery = graph.edges.filter((edge) => (
    disposition.get(edge.from) === 'canonical-required'
    && edge.disposition === 'runtime-discovery'
    && edge.kind !== 'di-port'
  ));
  const unresolvedRelative = graph.edges.filter((edge) => (
    disposition.get(edge.from) === 'canonical-required'
    && edge.disposition === 'unresolved-relative'
  ));
  const staticRequires = graph.edges.filter((edge) => (
    disposition.get(edge.from) === 'canonical-required'
    && edge.kind === 'static-require'
  ));
  const legacyLookups = graph.lookups.filter((lookup) => (
    lookup.disposition === 'canonical-required'
  ));
  const compatibilityEntryEdges = graph.edges.filter((edge) => (
    disposition.get(edge.from) === 'canonical-required'
    && !!edge.to
    && disposition.get(edge.to) === 'generated-or-compatibility-entry'
  ));
  const wholeFacadeCaches = graph.lookups.filter((lookup) => (
    lookup.disposition === 'canonical-required' && lookup.form === 'whole-facade-cache'
  ));
  const failures: string[] = [];
  for (const edge of runtimeDiscovery) {
    failures.push(`${edge.from}:${edge.line} performs canonical runtime discovery (${edge.kind})`);
  }
  for (const edge of unresolvedRelative) {
    failures.push(`${edge.from}:${edge.line} has unresolved canonical dependency ${edge.specifier || '<dynamic>'}`);
  }
  for (const edge of staticRequires) {
    failures.push(`${edge.from}:${edge.line} uses CommonJS require in the canonical graph (${edge.specifier || '<dynamic>'})`);
  }
  for (const lookup of legacyLookups) {
    failures.push(`${lookup.file}:${lookup.line} performs forbidden canonical lookup (${lookup.form})`);
  }
  for (const edge of compatibilityEntryEdges) {
    failures.push(`${edge.from}:${edge.line} imports compatibility entry ${edge.to}`);
  }
  for (const lookup of wholeFacadeCaches) {
    failures.push(`${lookup.file}:${lookup.line} caches the whole CardLogic facade in the canonical graph`);
  }
  failures.push(...assertFactoryDag(repoRoot));

  for (const node of canonicalNodes) {
    if (!/\.[cm]?[jt]sx?$/.test(node.file)) continue;
    const source = read(repoRoot, node.file);
    failures.push(...inspectErrorContract(node.file, source));
    if (!ROOT_AGGREGATE_FILES.has(node.file)
      && /\bCardRuntimeServices\b/.test(source)) {
      failures.push(`${node.file} accepts or imports the root CardRuntimeServices aggregate outside its owners`);
    }
  }

  const negativeFixtures = verifyNegativeFixtures(repoRoot);
  if (failures.length > 0) {
    throw new Error(`card runtime boundary violations:\n- ${failures.join('\n- ')}`);
  }
  return Object.freeze({
    canonicalNodeCount: canonicalNodes.length,
    canonicalRuntimeDiscoveryEdges: runtimeDiscovery.length,
    canonicalStaticRequireEdges: staticRequires.length,
    canonicalUnresolvedRelativeEdges: unresolvedRelative.length,
    canonicalLegacyLookups: legacyLookups.length,
    canonicalCompatibilityEntryEdges: compatibilityEntryEdges.length,
    canonicalWholeFacadeCaches: wholeFacadeCaches.length,
    negativeFixtures
  });
}

if (require.main === module) {
  const report = runCardRuntimeBoundaryCheck();
  console.log(
    `[card-runtime-boundary] PASS canonicalNodes=${report.canonicalNodeCount}`
    + ` runtimeDiscovery=${report.canonicalRuntimeDiscoveryEdges}`
    + ` staticRequire=${report.canonicalStaticRequireEdges}`
    + ` unresolved=${report.canonicalUnresolvedRelativeEdges}`
    + ` legacyLookups=${report.canonicalLegacyLookups}`
    + ` compatibilityEntries=${report.canonicalCompatibilityEntryEdges}`
    + ` wholeFacadeCaches=${report.canonicalWholeFacadeCaches}`
    + ` negativeFixtures=${report.negativeFixtures.length}`
  );
}
