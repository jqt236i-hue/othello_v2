import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

type DependencyGraph = Map<string, string[]>;

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNTIME_SOURCE_ROOTS = [
  'cards',
  'constants',
  'game',
  'shared',
  'ui',
  'utils',
  'workers'
];
const EXCLUDED_DIR_NAMES = new Set([
  '.git',
  '.wrangler',
  'dist',
  'node_modules',
  'worker-public'
]);
const MODULE_LOADER_CALLEES = new Set(['require', '_require']);
const UNUSED_DECLARATION_DIAGNOSTIC_CODES = new Set([6133, 6192, 6196]);
const RUNTIME_NEUTRAL_UNUSED_DECLARATION_KINDS = new Set([
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration
]);
const CLEAN_RUNTIME_UNUSED_DIAGNOSTIC_FILES = new Set([
  'game/cpu-decision-move-selection.ts',
  'game/cpu-turn-handler.ts',
  'game/logic/cards/meteor_god.ts',
  'scripts/board-source-trajectory-browser-check.ts',
  'scripts/build-module-registry.ts',
  'ui/board-visual/model-builder.ts',
  'ui/handlers/match-mode/network-buttons.ts',
  'ui/pixi/board-scene.ts',
  'ui/pixi/effects/common.ts',
  'ui/pixi/effects/source-trajectory-render-plan.ts',
  'ui/presentation/committed-world-state.ts'
]);

const EXPECTED_CYCLIC_COMPONENTS: string[][] = [];
let unusedDeclarationDiagnosticsCache: readonly ts.Diagnostic[] | null = null;

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function toRepoRelative(filePath: string): string {
  return toPosixPath(path.relative(REPO_ROOT, filePath));
}

function walkSourceFiles(dirPath: string, output: string[] = []): string[] {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry.name)) {
        walkSourceFiles(path.join(dirPath, entry.name), output);
      }
      continue;
    }

    if (entry.isFile() && /\.(ts|js)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      output.push(path.join(dirPath, entry.name));
    }
  }

  return output;
}

function listRuntimeSourceFiles(): string[] {
  return RUNTIME_SOURCE_ROOTS.flatMap((sourceRoot) => {
    const absoluteRoot = path.join(REPO_ROOT, sourceRoot);
    return fs.existsSync(absoluteRoot) ? walkSourceFiles(absoluteRoot) : [];
  })
    .map(toRepoRelative)
    .sort();
}

function resolveLocalModule(fromFile: string, specifier: string, sourceFileSet: Set<string>): string | null {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const absoluteBase = path.resolve(REPO_ROOT, path.dirname(fromFile), specifier);
  const hasExtension = path.extname(absoluteBase) !== '';
  const candidates = hasExtension
    ? [absoluteBase]
    : [
        absoluteBase,
        `${absoluteBase}.ts`,
        `${absoluteBase}.js`,
        path.join(absoluteBase, 'index.ts'),
        path.join(absoluteBase, 'index.js')
      ];

  for (const candidate of candidates) {
    const relativeCandidate = toRepoRelative(candidate);
    if (sourceFileSet.has(relativeCandidate)) {
      return relativeCandidate;
    }
  }

  return null;
}

function getCallExpressionName(expression: ts.Expression): string | null {
  return ts.isIdentifier(expression) ? expression.text : null;
}

function collectDependencies(filePath: string, sourceFileSet: Set<string>): string[] {
  const absolutePath = path.join(REPO_ROOT, filePath);
  const sourceText = fs.readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
  );
  const dependencies = new Set<string>();

  function addDependency(specifier: string): void {
    const resolved = resolveLocalModule(filePath, specifier, sourceFileSet);
    if (resolved !== null) {
      dependencies.add(resolved);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause || !node.importClause.isTypeOnly) {
        const specifier = node.moduleSpecifier;
        if (ts.isStringLiteral(specifier)) {
          addDependency(specifier.text);
        }
      }
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        addDependency(node.moduleSpecifier.text);
      }
    } else if (ts.isCallExpression(node)) {
      const calleeName = getCallExpressionName(node.expression);
      const firstArgument = node.arguments[0];
      if (
        calleeName !== null
        && MODULE_LOADER_CALLEES.has(calleeName)
        && node.arguments.length === 1
        && firstArgument
        && ts.isStringLiteralLike(firstArgument)
      ) {
        addDependency(firstArgument.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return Array.from(dependencies).sort();
}

function buildRuntimeDependencyGraph(): DependencyGraph {
  const files = listRuntimeSourceFiles();
  const sourceFileSet = new Set(files);
  return new Map(files.map((filePath) => [
    filePath,
    collectDependencies(filePath, sourceFileSet)
  ]));
}

function findCyclicComponents(graph: DependencyGraph): string[][] {
  let nextIndex = 0;
  const indexByNode = new Map<string, number>();
  const lowlinkByNode = new Map<string, number>();
  const stack: string[] = [];
  const nodesOnStack = new Set<string>();
  const components: string[][] = [];

  function strongConnect(node: string): void {
    indexByNode.set(node, nextIndex);
    lowlinkByNode.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    nodesOnStack.add(node);

    for (const dependency of graph.get(node) || []) {
      if (!indexByNode.has(dependency)) {
        strongConnect(dependency);
        lowlinkByNode.set(
          node,
          Math.min(lowlinkByNode.get(node) || 0, lowlinkByNode.get(dependency) || 0)
        );
      } else if (nodesOnStack.has(dependency)) {
        lowlinkByNode.set(
          node,
          Math.min(lowlinkByNode.get(node) || 0, indexByNode.get(dependency) || 0)
        );
      }
    }

    if (lowlinkByNode.get(node) !== indexByNode.get(node)) {
      return;
    }

    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (current === undefined) {
        break;
      }
      nodesOnStack.delete(current);
      component.push(current);
    } while (current !== node);

    const hasSelfCycle = (graph.get(node) || []).includes(node);
    if (component.length > 1 || hasSelfCycle) {
      components.push(component.sort());
    }
  }

  for (const node of Array.from(graph.keys()).sort()) {
    if (!indexByNode.has(node)) {
      strongConnect(node);
    }
  }

  return components.sort((left, right) => left.join('\n').localeCompare(right.join('\n')));
}

function formatCompilerDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  if (!diagnostic.file || diagnostic.start === undefined) {
    return `TS${diagnostic.code}: ${message}`;
  }

  const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${toRepoRelative(diagnostic.file.fileName)}:${position.line + 1}:${position.character + 1} TS${diagnostic.code}: ${message}`;
}

function createTsOnlyProgramWithUnusedChecks(): ts.Program {
  const configPath = path.join(REPO_ROOT, 'tsconfig.ts-only.json');
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(formatCompilerDiagnostic(configFile.error));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    REPO_ROOT,
    {
      noEmit: true,
      noUnusedLocals: true
    },
    configPath
  );
  if (parsedConfig.errors.length > 0) {
    throw new Error(parsedConfig.errors.map(formatCompilerDiagnostic).join('\n'));
  }

  return ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
}

function collectUnusedDeclarationDiagnostics(): readonly ts.Diagnostic[] {
  if (unusedDeclarationDiagnosticsCache === null) {
    unusedDeclarationDiagnosticsCache = ts.getPreEmitDiagnostics(createTsOnlyProgramWithUnusedChecks())
      .filter((diagnostic) => (
        UNUSED_DECLARATION_DIAGNOSTIC_CODES.has(diagnostic.code)
        && diagnostic.file !== undefined
        && diagnostic.start !== undefined
      ));
  }
  return unusedDeclarationDiagnosticsCache;
}

function collectRuntimeNeutralUnusedDiagnostics(): string[] {
  return collectUnusedDeclarationDiagnostics()
    .filter((diagnostic) => {
      let current: ts.Node | undefined = ts.getTokenAtPosition(
        diagnostic.file as ts.SourceFile,
        diagnostic.start as number
      );
      while (current) {
        if (RUNTIME_NEUTRAL_UNUSED_DECLARATION_KINDS.has(current.kind)) {
          return true;
        }
        current = current.parent;
      }
      return false;
    })
    .map(formatCompilerDiagnostic)
    .sort();
}

function collectUnusedDiagnosticsForCleanRuntimeFiles(): string[] {
  return collectUnusedDeclarationDiagnostics()
    .filter((diagnostic) => (
      diagnostic.file !== undefined
      && CLEAN_RUNTIME_UNUSED_DIAGNOSTIC_FILES.has(toRepoRelative(diagnostic.file.fileName))
    ))
    .map(formatCompilerDiagnostic)
    .sort();
}

function parseTypeScriptSource(relativePath: string): ts.SourceFile {
  return ts.createSourceFile(
    relativePath,
    fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

function countMatchingNodes(sourceFile: ts.SourceFile, predicate: (node: ts.Node) => boolean): number {
  let count = 0;
  function visit(node: ts.Node): void {
    if (predicate(node)) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return count;
}

function isWithinTryBlock(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isTryStatement(current)) {
      return node.pos >= current.tryBlock.pos && node.end <= current.tryBlock.end;
    }
    current = current.parent;
  }
  return false;
}

describe('refactor dependency boundaries', () => {
  test('runtime source import cycles stay explicit and shrinkable', () => {
    expect(findCyclicComponents(buildRuntimeDependencyGraph())).toEqual(EXPECTED_CYCLIC_COMPONENTS);
  });

  test('runtime-neutral unused imports and type declarations stay absent', () => {
    expect(collectRuntimeNeutralUnusedDiagnostics()).toEqual([]);
  }, 30000);

  test('cleaned runtime files stay free of unused declarations', () => {
    expect(collectUnusedDiagnosticsForCleanRuntimeFiles()).toEqual([]);
  }, 30000);

  test('cleanup retains required controller and compatibility-module evaluations', () => {
    const trajectorySource = parseTypeScriptSource('scripts/board-source-trajectory-browser-check.ts');
    const controllerGetterCalls = countMatchingNodes(trajectorySource, (node) => (
      ts.isExpressionStatement(node)
      && ts.isCallExpression(node.expression)
      && ts.isPropertyAccessExpression(node.expression.expression)
      && ts.isIdentifier(node.expression.expression.expression)
      && node.expression.expression.expression.text === 'renderer'
      && node.expression.expression.name.text === 'getBoardVisualController'
      && node.expression.arguments.length === 0
    ));

    const committedWorldStateSource = parseTypeScriptSource('ui/presentation/committed-world-state.ts');
    const sharedConstantsLoads = countMatchingNodes(committedWorldStateSource, (node) => (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === '_require'
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === '../../shared-constants'
      && ts.isExpressionStatement(node.parent)
      && isWithinTryBlock(node)
    ));

    expect(controllerGetterCalls).toBe(1);
    expect(sharedConstantsLoads).toBe(1);
  });
});
