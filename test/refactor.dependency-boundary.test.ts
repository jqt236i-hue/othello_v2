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

const EXPECTED_CYCLIC_COMPONENTS = [
  [
    'cards/card-renderer.ts',
    'ui/animation-utils.ts',
    'ui/bootstrap.js',
    'ui/bootstrap.ts',
    'ui/hand-skin/controller.js',
    'ui/hand-skin/controller.ts',
    'ui/handlers/hand-skin.ts'
  ]
];

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

describe('refactor dependency boundaries', () => {
  test('runtime source import cycles stay explicit and shrinkable', () => {
    expect(findCyclicComponents(buildRuntimeDependencyGraph())).toEqual(EXPECTED_CYCLIC_COMPONENTS);
  });
});
