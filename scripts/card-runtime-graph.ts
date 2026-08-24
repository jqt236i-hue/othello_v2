import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export type CardRuntimeGraphDisposition =
  | 'canonical-required'
  | 'outer-adapter-allowlisted'
  | 'generated-or-compatibility-entry'
  | 'out-of-scope-consumer';

export type CardRuntimeGraphEdgeKind =
  | 'static-import'
  | 'type-only-import'
  | 'static-require'
  | 'compatibility-resolution'
  | 'di-port'
  | 'whole-facade-cache'
  | 'dynamic-import'
  | 'unresolved-dynamic-import';

export type CardRuntimeLookupForm =
  | 'alias-require'
  | 'literal-require'
  | 'dynamic-import'
  | 'computed-global'
  | 'global-reference'
  | 'whole-facade-cache'
  | 'duplicate-fallback';

export interface CardRuntimeGraphEdge {
  from: string;
  to: string | null;
  specifier: string | null;
  line: number;
  kind: CardRuntimeGraphEdgeKind;
  resolved: boolean;
  disposition: 'traversed-source' | 'external-package' | 'runtime-discovery' | 'generated-target' | 'unresolved-relative';
}

export interface CardRuntimeLookup {
  file: string;
  line: number;
  form: CardRuntimeLookupForm;
  expression: string;
  disposition: CardRuntimeGraphDisposition;
  owner: string;
  reason: string;
  removalCohort: string;
  testOwner: string;
  proofId: string;
}

export interface CardRuntimeGraphNode {
  file: string;
  disposition: CardRuntimeGraphDisposition;
  reachedFrom: readonly string[];
  boundary: boolean;
}

export interface CardRuntimeGraphManifest {
  roots: readonly string[];
  nodes: readonly CardRuntimeGraphNode[];
  edges: readonly CardRuntimeGraphEdge[];
  lookups: readonly CardRuntimeLookup[];
  unresolvedEdges: readonly CardRuntimeGraphEdge[];
}

export const DEFAULT_CARD_RUNTIME_GRAPH_ROOTS = Object.freeze([
  'game/logic/cards.ts',
  'game/logic/presentation.ts',
  'game/cards/effect-resolver.ts',
  'game/turn/turn_pipeline.ts',
  'game/turn/turn_pipeline_factory.ts',
  'game/turn/turn_pipeline_phases.ts',
  'game/turn/pending-coordinator.ts',
  'game/turn/pending-selection-contract.ts',
  'utils/match-command-runtime.ts',
  'utils/match-auto-command.ts',
  'scripts/local-match-runtime.ts',
  'cards/card-interaction.ts',
  'game/cpu-network-command-planner.ts',
  'game/cpu-decision.ts',
  'game/cpu-turn-handler.ts',
  'browser-vite/module-bridge.ts',
  'entry-browser.js',
  'workers/match-worker-runtime-preload.ts',
  'workers/match-worker.ts',
  'src/engine/selfplay-runner.ts'
]);

const SCRIPT_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'];
const COMPATIBILITY_LOADERS = new Set([
  'safeRequire',
  'requireOptionalModule',
  'requireOptionalCardLogicModule',
  'loadRuntimeModule',
  'loadCardLogicModule',
  'resolveRuntimeModule',
  'resolveCachedModule',
  'resolveRequiredCardModule',
  'resolveOptionalCardModule',
  'resolveCardLogicModuleOrGlobal',
  'resolveCardLogicGlobalOrModule',
  'readRuntimeModule',
  'requireCpuTurnHandlerModuleOrNull',
  '_resolveCardInteractionModule'
]);
const REQUIRE_ALIASES = new Set(['_require', '__non_webpack_require__', '__require']);
const ROOT_AGGREGATE_NAMES = new Set(['CardLogic', 'cachedCardLogic']);

function normalize(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function expressionText(sourceFile: ts.SourceFile, node: ts.Node): string {
  return node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 240);
}

function literalText(node: ts.Expression | undefined): string | null {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function unwrapExpression(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

const AMBIENT_GLOBAL_NAMES = new Set(['globalThis', 'self', 'window', 'global']);

interface GlobalAliasFacts {
  aliases: ReadonlySet<string>;
  collections: ReadonlySet<string>;
  collectionFactories: ReadonlySet<string>;
}

function expressionMentionsGlobal(
  node: ts.Expression,
  aliases: ReadonlySet<string>
): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (ts.isIdentifier(child) && (AMBIENT_GLOBAL_NAMES.has(child.text) || aliases.has(child.text))) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

function isGlobalAliasArgument(
  node: ts.Expression,
  aliases: ReadonlySet<string>
): boolean {
  const unwrapped = unwrapExpression(node);
  if (ts.isIdentifier(unwrapped)) {
    return AMBIENT_GLOBAL_NAMES.has(unwrapped.text) || aliases.has(unwrapped.text);
  }
  if (ts.isConditionalExpression(unwrapped)) {
    return isGlobalAliasArgument(unwrapped.whenTrue, aliases)
      || isGlobalAliasArgument(unwrapped.whenFalse, aliases);
  }
  if (ts.isBinaryExpression(unwrapped)
    && (unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken
      || unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) {
    return isGlobalAliasArgument(unwrapped.left, aliases)
      || isGlobalAliasArgument(unwrapped.right, aliases);
  }
  return false;
}

function collectGlobalAliasFacts(sourceFile: ts.SourceFile): GlobalAliasFacts {
  const aliases = new Set<string>();
  const collections = new Set<string>();
  const collectionFactories = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    const add = (set: Set<string>, value: string): void => {
      if (!set.has(value)) {
        set.add(value);
        changed = true;
      }
    };
    const isGlobalAliasExpression = (expression: ts.Expression): boolean => {
      const unwrapped = unwrapExpression(expression);
      return ts.isIdentifier(unwrapped)
        && (AMBIENT_GLOBAL_NAMES.has(unwrapped.text) || aliases.has(unwrapped.text));
    };
    const isGlobalCollectionExpression = (expression: ts.Expression): boolean => {
      const unwrapped = unwrapExpression(expression);
      if (ts.isIdentifier(unwrapped) && collections.has(unwrapped.text)) return true;
      if (ts.isArrayLiteralExpression(unwrapped)) {
        return unwrapped.elements.some((element) => expressionMentionsGlobal(element as ts.Expression, aliases));
      }
      return ts.isCallExpression(unwrapped)
        && ts.isIdentifier(unwrapExpression(unwrapped.expression))
        && collectionFactories.has((unwrapExpression(unwrapped.expression) as ts.Identifier).text);
    };

    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        if (isGlobalAliasExpression(node.initializer)) add(aliases, node.name.text);
        if (isGlobalCollectionExpression(node.initializer)) add(collections, node.name.text);
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isIdentifier(node.left)) {
        if (isGlobalAliasExpression(node.right)) add(aliases, node.left.text);
        if (isGlobalCollectionExpression(node.right)) add(collections, node.left.text);
      }
      if (ts.isForOfStatement(node) && isGlobalCollectionExpression(node.expression)) {
        const declaration = node.initializer;
        if (ts.isVariableDeclarationList(declaration)) {
          for (const item of declaration.declarations) {
            if (ts.isIdentifier(item.name)) add(aliases, item.name.text);
          }
        } else if (ts.isIdentifier(declaration)) {
          add(aliases, declaration.text);
        }
      }
      if (ts.isCallExpression(node)) {
        const invoked = unwrapExpression(node.expression);
        if (ts.isFunctionExpression(invoked) || ts.isArrowFunction(invoked)) {
          invoked.parameters.forEach((parameter, index) => {
            const argument = node.arguments[index];
            if (argument && ts.isIdentifier(parameter.name)
              && isGlobalAliasArgument(argument, aliases)) {
              add(aliases, parameter.name.text);
            }
          });
        }
      }
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        const localArrays = new Set<string>();
        let returnsGlobalCollection = false;
        const inspectFunction = (child: ts.Node): void => {
          if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name) && child.initializer
            && ts.isArrayLiteralExpression(unwrapExpression(child.initializer))) {
            localArrays.add(child.name.text);
          }
          if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(unwrapExpression(child.expression))) {
            const access = unwrapExpression(child.expression) as ts.PropertyAccessExpression;
            const target = unwrapExpression(access.expression);
            if (access.name.text === 'push' && ts.isIdentifier(target) && localArrays.has(target.text)
              && child.arguments.some((argument) => expressionMentionsGlobal(argument, aliases))) {
              collections.add(target.text);
            }
          }
          if (ts.isReturnStatement(child) && child.expression) {
            const returned = unwrapExpression(child.expression);
            if (ts.isIdentifier(returned)
              && (collections.has(returned.text) || localArrays.has(returned.text))) {
              returnsGlobalCollection = true;
            }
          }
          ts.forEachChild(child, inspectFunction);
        };
        inspectFunction(node.body);
        if (returnsGlobalCollection && expressionMentionsGlobal(node.body as unknown as ts.Expression, aliases)) {
          add(collectionFactories, node.name.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return { aliases, collections, collectionFactories };
}

function callName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function resolveRelativeModule(repoRoot: string, fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(repoRoot, path.dirname(fromFile), specifier);
  const sourcePrefersTypeScript = /\.[cm]?tsx?$/.test(fromFile);
  const explicitJavaScriptTypeScriptCandidates = sourcePrefersTypeScript && /\.[cm]?js$/.test(base)
    ? ['.ts', '.tsx', '.mts', '.cts'].map((extension) => base.replace(/\.[cm]?js$/, extension))
    : [];
  const candidates = [
    ...explicitJavaScriptTypeScriptCandidates,
    base,
    ...SCRIPT_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SCRIPT_EXTENSIONS.map((extension) => path.join(base, `index${extension}`))
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    return normalize(path.relative(repoRoot, candidate));
  }
  return null;
}

function dispositionFor(file: string): CardRuntimeGraphDisposition {
  const normalized = normalize(file);
  if (/^(dist|public|worker-public|vite-dist)\//.test(normalized) || normalized === 'entry-browser.js') {
    return 'generated-or-compatibility-entry';
  }
  if (normalized === 'shared/special-stone-registry.ts'
    || normalized === 'game/logic/cards-internal/spawn-and-flip.ts') {
    return 'generated-or-compatibility-entry';
  }
  if (/^cards\/(?:card-interaction|card-renderer)/.test(normalized)
    || /^game\/(?:card-effects|network-turn-handoff)/.test(normalized)
    || /^game\/turn\/(?:pipeline_ui_adapter(?:\.[cm]?[jt]s)?|pipeline-ui\/)/.test(normalized)) {
    return 'outer-adapter-allowlisted';
  }
  if (/^game\/(?:cpu-decision|cpu-turn-handler|ai\/)/.test(normalized)
    || /^src\/engine\//.test(normalized)
    || /^training\//.test(normalized)) {
    return 'out-of-scope-consumer';
  }
  if (/^(browser-vite|ui|workers|scripts)\//.test(normalized)) return 'outer-adapter-allowlisted';
  if (/^(game|cards|shared|constants)\//.test(normalized)) return 'canonical-required';
  if (/^utils\/(match-command-runtime|match-auto-command|match-authority|owner-helpers|match-command)/.test(normalized)) {
    return 'canonical-required';
  }
  return 'out-of-scope-consumer';
}

function isConsumerTraversalBoundary(file: string): boolean {
  return dispositionFor(file) !== 'canonical-required';
}

function isDuplicateRuntimeFallback(node: ts.BinaryExpression, sourceFile: ts.SourceFile): boolean {
  if (node.operatorToken.kind !== ts.SyntaxKind.BarBarToken) return false;
  const text = expressionText(sourceFile, node);
  const hasRuntimeResolver = /\brequire\s*\(|\b(?:globalThis|self|window|global)\b/.test(text);
  const hasModuleCandidate = /\bCardLogic\b|\b[A-Z][A-Za-z0-9]*(?:Module|Registry|Helpers|Utils|Contract)\b/.test(text);
  return hasRuntimeResolver && hasModuleCandidate;
}

function isBoundary(disposition: CardRuntimeGraphDisposition): boolean {
  return disposition !== 'canonical-required';
}

function lookupOwnership(file: string, disposition: CardRuntimeGraphDisposition, form: CardRuntimeLookupForm) {
  const cohort = disposition === 'canonical-required'
    ? 'canonical-service-static-composition'
    : disposition === 'outer-adapter-allowlisted'
      ? 'outer-adapter-cutover'
      : disposition === 'generated-or-compatibility-entry'
        ? 'delivery-entry-cutover'
        : 'consumer-cutover';
  return {
    owner: `${disposition}:${file}`,
    reason: `${form} is a reviewed runtime-discovery/aggregate access that must remain visible until its owning cutover`,
    removalCohort: cohort,
    testOwner: disposition === 'generated-or-compatibility-entry'
      ? 'test/game.cards-api-identity.test.ts'
      : 'test/game.card-runtime-characterization.test.ts',
    proofId: `ambient-lookup:${form}`
  };
}

function inspectSource(repoRoot: string, relativeFile: string): {
  edges: CardRuntimeGraphEdge[];
  lookups: CardRuntimeLookup[];
} {
  const absoluteFile = path.join(repoRoot, relativeFile);
  const sourceText = fs.readFileSync(absoluteFile, 'utf8');
  const sourceFile = ts.createSourceFile(
    relativeFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    /\.[cm]?tsx?$/.test(relativeFile) ? ts.ScriptKind.TS : ts.ScriptKind.JS
  );
  const disposition = dispositionFor(relativeFile);
  const globalAliases = collectGlobalAliasFacts(sourceFile).aliases;
  const edges: CardRuntimeGraphEdge[] = [];
  const lookups: CardRuntimeLookup[] = [];
  const seenLookups = new Set<string>();

  const addLookup = (node: ts.Node, form: CardRuntimeLookupForm): void => {
    const line = lineOf(sourceFile, node);
    const expression = expressionText(sourceFile, node);
    const key = `${line}:${form}:${expression}`;
    if (seenLookups.has(key)) return;
    seenLookups.add(key);
    lookups.push({
      file: relativeFile,
      line,
      form,
      expression,
      disposition,
      ...lookupOwnership(relativeFile, disposition, form)
    });
  };

  const addEdge = (
    node: ts.Node,
    specifier: string | null,
    kind: CardRuntimeGraphEdgeKind
  ): void => {
    const target = specifier ? resolveRelativeModule(repoRoot, relativeFile, specifier) : null;
    const external = !!(specifier && !specifier.startsWith('.'));
    const generatedTarget = !!(specifier && specifier.startsWith('.') && /(?:^|\/)dist\//.test(specifier));
    const disposition: CardRuntimeGraphEdge['disposition'] = target
      ? 'traversed-source'
      : external
        ? 'external-package'
        : !specifier
          ? 'runtime-discovery'
          : generatedTarget
            ? 'generated-target'
            : 'unresolved-relative';
    edges.push({
      from: relativeFile,
      to: target,
      specifier,
      line: lineOf(sourceFile, node),
      kind,
      resolved: target !== null || external || generatedTarget,
      disposition
    });
  };

  const addRelationEdge = (node: ts.Node, kind: 'di-port' | 'whole-facade-cache'): void => {
    edges.push({
      from: relativeFile,
      to: null,
      specifier: null,
      line: lineOf(sourceFile, node),
      kind,
      resolved: true,
      disposition: 'runtime-discovery'
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : null;
      if (specifier) {
        const typeOnly = ts.isImportDeclaration(node)
          ? !!node.importClause?.isTypeOnly
          : !!node.isTypeOnly;
        addEdge(node, specifier, typeOnly ? 'type-only-import' : 'static-import');
      }
    }
    if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteral(node.moduleReference.expression)) {
      addEdge(
        node,
        node.moduleReference.expression.text,
        node.isTypeOnly ? 'type-only-import' : 'static-import'
      );
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = literalText(node.arguments[0]);
        addEdge(node, specifier, specifier ? 'dynamic-import' : 'unresolved-dynamic-import');
        addLookup(node, 'dynamic-import');
      } else {
        const name = callName(node.expression);
        const firstLiteral = literalText(node.arguments[0]);
        if (name === 'require') {
          addEdge(node, firstLiteral, firstLiteral ? 'static-require' : 'unresolved-dynamic-import');
          addLookup(node, firstLiteral ? 'literal-require' : 'alias-require');
        } else if (name && (REQUIRE_ALIASES.has(name) || COMPATIBILITY_LOADERS.has(name))) {
          addEdge(node, firstLiteral, firstLiteral ? 'compatibility-resolution' : 'unresolved-dynamic-import');
          addLookup(node, 'alias-require');
        }
      }
    }

    if (ts.isElementAccessExpression(node)) {
      const target = unwrapExpression(node.expression);
      if (ts.isIdentifier(target) && (AMBIENT_GLOBAL_NAMES.has(target.text) || globalAliases.has(target.text))) {
        addLookup(node, 'computed-global');
      }
    } else if (ts.isPropertyAccessExpression(node)) {
      const target = unwrapExpression(node.expression);
      if (ts.isIdentifier(target) && (AMBIENT_GLOBAL_NAMES.has(target.text) || globalAliases.has(target.text))) {
        addLookup(node, 'global-reference');
      }
    }

    if (ts.isIdentifier(node) && (AMBIENT_GLOBAL_NAMES.has(node.text) || globalAliases.has(node.text))) {
      const parent = node.parent;
      const isAccessTarget = (ts.isElementAccessExpression(parent) || ts.isPropertyAccessExpression(parent))
        && unwrapExpression(parent.expression) === node;
      const isAliasDeclaration = ts.isVariableDeclaration(parent) && parent.name === node;
      const isParameterDeclaration = ts.isParameter(parent) && parent.name === node;
      if (!isAccessTarget && !isAliasDeclaration && !isParameterDeclaration) {
        addLookup(node, 'global-reference');
      }
    }

    if (ts.isIdentifier(node) && ROOT_AGGREGATE_NAMES.has(node.text)) {
      if (node.text === 'cachedCardLogic') addLookup(node, 'whole-facade-cache');
    }

    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      && /^(CardLogic|cardLogic)$/.test(node.name.text)) {
      addRelationEdge(node, 'di-port');
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'cachedCardLogic') {
      addRelationEdge(node, 'whole-facade-cache');
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left) && node.left.text === 'cachedCardLogic') {
      addRelationEdge(node, 'whole-facade-cache');
    }

    if (ts.isBinaryExpression(node) && isDuplicateRuntimeFallback(node, sourceFile)) {
      addLookup(node, 'duplicate-fallback');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { edges, lookups };
}

export function analyzeCardRuntimeSourceFixture(sourceText: string): readonly CardRuntimeLookupForm[] {
  const sourceFile = ts.createSourceFile('fixture.ts', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const globalAliases = collectGlobalAliasFacts(sourceFile).aliases;
  const forms = new Set<CardRuntimeLookupForm>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) forms.add('dynamic-import');
      const name = callName(node.expression);
      if (name && (REQUIRE_ALIASES.has(name) || COMPATIBILITY_LOADERS.has(name))) forms.add('alias-require');
      if (name === 'require') {
        forms.add(literalText(node.arguments[0]) ? 'literal-require' : 'alias-require');
      }
    }
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(unwrapExpression(node.expression))
      && (AMBIENT_GLOBAL_NAMES.has((unwrapExpression(node.expression) as ts.Identifier).text)
        || globalAliases.has((unwrapExpression(node.expression) as ts.Identifier).text))) {
      forms.add('computed-global');
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(unwrapExpression(node.expression))
      && (AMBIENT_GLOBAL_NAMES.has((unwrapExpression(node.expression) as ts.Identifier).text)
        || globalAliases.has((unwrapExpression(node.expression) as ts.Identifier).text))) {
      forms.add('global-reference');
    }
    if (ts.isIdentifier(node) && (AMBIENT_GLOBAL_NAMES.has(node.text) || globalAliases.has(node.text))) {
      forms.add('global-reference');
    }
    if (ts.isIdentifier(node) && node.text === 'cachedCardLogic') forms.add('whole-facade-cache');
    if (ts.isBinaryExpression(node) && isDuplicateRuntimeFallback(node, sourceFile)) {
      forms.add('duplicate-fallback');
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return Object.freeze([...forms].sort());
}

export function fixtureImportsCompatibilityEntry(
  repoRoot: string,
  relativeFile: string,
  sourceText: string
): boolean {
  if (dispositionFor(relativeFile) !== 'canonical-required') return false;
  const sourceFile = ts.createSourceFile(
    relativeFile,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let found = false;
  const inspectSpecifier = (specifier: string | null): void => {
    if (!specifier || found) return;
    const target = resolveRelativeModule(repoRoot, relativeFile, specifier);
    found = !!target && dispositionFor(target) === 'generated-or-compatibility-entry';
  };
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      inspectSpecifier(node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : null);
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression
      && ts.isStringLiteral(node.moduleReference.expression)) {
      inspectSpecifier(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node) && callName(node.expression) === 'require') {
      inspectSpecifier(literalText(node.arguments[0]));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

export function buildCardRuntimeGraphManifest(repoRoot: string, roots: readonly string[]): CardRuntimeGraphManifest {
  const normalizedRoots = roots.map(normalize);
  const queue = [...normalizedRoots];
  const visited = new Set<string>();
  const reachedFrom = new Map<string, Set<string>>();
  const allEdges: CardRuntimeGraphEdge[] = [];
  const allLookups: CardRuntimeLookup[] = [];

  for (const root of normalizedRoots) reachedFrom.set(root, new Set([root]));

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const absoluteFile = path.join(repoRoot, file);
    if (!fs.existsSync(absoluteFile)) throw new Error(`card runtime graph root/node is missing: ${file}`);
    const { edges, lookups } = inspectSource(repoRoot, file);
    allEdges.push(...edges);
    allLookups.push(...lookups);

    // UI/CPU/selfplay are graph consumers. Their public-facade edge is evidence,
    // but their algorithms and unrelated dependencies are not part of the
    // canonical service closure being migrated.
    if (isConsumerTraversalBoundary(file)) continue;

    for (const edge of edges) {
      if (!edge.to) continue;
      const rootsForSource = reachedFrom.get(file) || new Set<string>();
      const rootsForTarget = reachedFrom.get(edge.to) || new Set<string>();
      rootsForSource.forEach((root) => rootsForTarget.add(root));
      reachedFrom.set(edge.to, rootsForTarget);
      if (!visited.has(edge.to)) queue.push(edge.to);
    }
  }

  const nodes = [...visited].sort().map((file): CardRuntimeGraphNode => {
    const disposition = dispositionFor(file);
    return Object.freeze({
      file,
      disposition,
      reachedFrom: Object.freeze([...(reachedFrom.get(file) || [])].sort()),
      boundary: isBoundary(disposition)
    });
  });
  const edgeSort = (left: CardRuntimeGraphEdge, right: CardRuntimeGraphEdge): number => (
    left.from.localeCompare(right.from)
    || left.line - right.line
    || left.kind.localeCompare(right.kind)
    || String(left.specifier).localeCompare(String(right.specifier))
  );
  allEdges.sort(edgeSort);
  allLookups.sort((left, right) => (
    left.file.localeCompare(right.file)
    || left.line - right.line
    || left.form.localeCompare(right.form)
  ));
  return Object.freeze({
    roots: Object.freeze(normalizedRoots),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(allEdges),
    lookups: Object.freeze(allLookups),
    unresolvedEdges: Object.freeze(allEdges.filter((edge) => !edge.resolved))
  });
}
