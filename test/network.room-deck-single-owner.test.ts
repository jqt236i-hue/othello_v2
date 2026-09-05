import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..');

function parseSource(relativePath: string, text: string) {
  return {
    relativePath,
    text,
    sourceFile: ts.createSourceFile(
      relativePath,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
  };
}

function readSource(relativePath: string) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  return parseSource(relativePath, fs.readFileSync(absolutePath, 'utf8'));
}

type ParsedSource = ReturnType<typeof readSource>;
type FunctionLikeNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

const APPROVED_ADAPTER_OWNERSHIP_DECLARATIONS = new Set([
  'cloneInitialDeckSpecByPlayer',
  'createAllCardsRoomDeckMetadataFromRuntimeCardIds'
]);

function findFunction(source: ParsedSource, name: string): ts.FunctionDeclaration {
  let found: ts.FunctionDeclaration | null = null;
  source.sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
  });
  if (!found) throw new Error(`${source.relativePath} does not declare ${name}`);
  return found;
}

function collectCallNames(source: ParsedSource, declaration: ts.FunctionDeclaration): string[] {
  const calls: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) calls.push(node.expression.text);
      if (ts.isPropertyAccessExpression(node.expression)) calls.push(node.expression.name.text);
    }
    ts.forEachChild(node, visit);
  };
  if (declaration.body) visit(declaration.body);
  return calls;
}

function isNestedFunctionLike(node: ts.Node): node is FunctionLikeNode {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);
}

function collectCanonicalCalls(
  declaration: ts.FunctionDeclaration,
  canonicalCall: string
): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (node !== declaration && isNestedFunctionLike(node)) return;
    if (ts.isCallExpression(node)) {
      const name = ts.isIdentifier(node.expression)
        ? node.expression.text
        : (ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : null);
      if (name === canonicalCall) calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  if (declaration.body) visit(declaration.body);
  return calls;
}

function findResultBinding(
  declaration: ts.FunctionDeclaration,
  call: ts.CallExpression
): string | null {
  let current: ts.Node | undefined = call.parent;
  while (current && current !== declaration) {
    if (isNestedFunctionLike(current)) return null;
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    current = current.parent;
  }
  return null;
}

function resultReachesReturn(
  declaration: ts.FunctionDeclaration,
  call: ts.CallExpression,
  binding: string | null
): boolean {
  let reached = false;
  const visit = (node: ts.Node) => {
    if (reached || (node !== declaration && isNestedFunctionLike(node))) return;
    if (ts.isReturnStatement(node) && node.expression) {
      const expression = unwrapExpression(node.expression);
      const directlyReturnsCall = expression === call;
      const directlyReturnsBinding = binding !== null
        && ts.isIdentifier(expression)
        && expression.text === binding;
      const returnsBindingCopy = binding !== null
        && ts.isObjectLiteralExpression(expression)
        && expression.properties.length > 0
        && expression.properties.every((property) => (
          ts.isSpreadAssignment(property)
          && ts.isIdentifier(property.expression)
          && property.expression.text === binding
        ));
      if (directlyReturnsCall || directlyReturnsBinding || returnsBindingCopy) {
        reached = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  if (declaration.body) visit(declaration.body);
  return reached;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
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

function propertyPath(expression: ts.Expression): string[] | null {
  const current = unwrapExpression(expression);
  if (ts.isIdentifier(current)) return [current.text];
  if (ts.isPropertyAccessExpression(current)) {
    const base = propertyPath(current.expression);
    return base ? [...base, current.name.text] : null;
  }
  if (
    ts.isElementAccessExpression(current)
    && current.argumentExpression
    && ts.isStringLiteralLike(current.argumentExpression)
  ) {
    const base = propertyPath(current.expression);
    return base ? [...base, current.argumentExpression.text] : null;
  }
  return null;
}

function selectionPatchReachesRoomMutation(
  declaration: ts.FunctionDeclaration,
  binding: string | null
): boolean {
  if (!binding || !declaration.body) return false;
  const roomParameter = declaration.parameters[0]?.name;
  if (!roomParameter || !ts.isIdentifier(roomParameter)) return false;
  const requiredProperties = new Set(['initialDeckSpec', 'initialDeckSpecByPlayer', 'roomDeck']);
  const appliedProperties = new Set<string>();
  const visit = (node: ts.Node) => {
    if (node !== declaration && isNestedFunctionLike(node)) return;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = propertyPath(node.left);
      const right = propertyPath(node.right);
      if (
        left?.length === 2
        && right?.length === 2
        && left[0] === roomParameter.text
        && right[0] === binding
        && left[1] === right[1]
        && requiredProperties.has(left[1])
      ) {
        appliedProperties.add(left[1]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(declaration.body);
  return [...requiredProperties].every((property) => appliedProperties.has(property));
}

function assertCanonicalResultUsage(
  source: ParsedSource,
  wrapperName: string,
  canonicalCall: string,
  expectedUsage: 'return' | 'selection-patch'
): void {
  const wrapper = findFunction(source, wrapperName);
  const calls = collectCanonicalCalls(wrapper, canonicalCall);
  if (calls.length !== 1) {
    throw new Error(`${source.relativePath}:${wrapperName} must call ${canonicalCall} exactly once`);
  }
  const binding = findResultBinding(wrapper, calls[0]);
  const isUsed = expectedUsage === 'return'
    ? resultReachesReturn(wrapper, calls[0], binding)
    : selectionPatchReachesRoomMutation(wrapper, binding);
  if (!isUsed) {
    throw new Error(
      `${source.relativePath}:${wrapperName} calls ${canonicalCall} but its result does not reach ${expectedUsage}`
    );
  }
}

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return !!(
    !clause.name
    && clause.namedBindings
    && ts.isNamedImports(clause.namedBindings)
    && clause.namedBindings.elements.length > 0
    && clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function collectRuntimeModuleSpecifiers(source: ParsedSource): string[] {
  const specifiers = new Set<string>();
  const addLiteral = (expression: ts.Expression | undefined) => {
    if (expression && ts.isStringLiteralLike(expression)) specifiers.add(expression.text);
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && !isTypeOnlyImport(node)) {
      addLiteral(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node)
      && !node.isTypeOnly
      && ts.isExternalModuleReference(node.moduleReference)
    ) {
      addLiteral(node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'require'
      && node.arguments.length === 1
    ) {
      addLiteral(node.arguments[0]);
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length >= 1
    ) {
      addLiteral(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source.sourceFile);
  return [...specifiers].sort();
}

function isForbiddenCoreRuntimeSpecifier(specifier: string): boolean {
  const segments = specifier.replace(/\\/g, '/').split('/').filter((segment) => segment && segment !== '.' && segment !== '..');
  return segments.some((segment) => segment === 'workers' || segment === 'scripts' || segment === 'ui');
}

function collectTopLevelFunctionLikes(source: ParsedSource): Array<{ name: string; node: FunctionLikeNode }> {
  const declarations: Array<{ name: string; node: FunctionLikeNode }> = [];
  source.sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      declarations.push({ name: node.name.text, node });
      return;
    }
    if (!ts.isVariableStatement(node)) return;
    node.declarationList.declarations.forEach((declaration) => {
      if (
        ts.isIdentifier(declaration.name)
        && declaration.initializer
        && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
      ) {
        declarations.push({ name: declaration.name.text, node: declaration.initializer });
      }
    });
  });
  return declarations;
}

function isLegacyCanonicalOwnershipName(name: string): boolean {
  const normalized = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return (
    (normalized.includes('normaliz') && normalized.includes('decksize'))
    || normalized.includes('initialdeckspecbyplayer')
    || (normalized.includes('roomdeckmetadata') && (normalized.includes('entries') || normalized.includes('has')))
    || normalized.includes('allcardsroomdeckmetadata')
  );
}

function callPath(expression: ts.LeftHandSideExpression): string | null {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const base = callPath(expression.expression);
    return base ? `${base}.${expression.name.text}` : null;
  }
  return null;
}

function collectCallPaths(node: ts.Node): Set<string> {
  const paths = new Set<string>();
  const visit = (candidate: ts.Node) => {
    if (ts.isCallExpression(candidate)) {
      const path = callPath(candidate.expression);
      if (path) paths.add(path);
    }
    ts.forEachChild(candidate, visit);
  };
  visit(node);
  return paths;
}

function duplicatesDeckSizeNormalization(node: FunctionLikeNode): boolean {
  const returnedExpressions: ts.Expression[] = [];
  if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
    returnedExpressions.push(node.body);
  } else if (node.body && ts.isBlock(node.body)) {
    node.body.statements.forEach((statement) => {
      if (ts.isReturnStatement(statement) && statement.expression) returnedExpressions.push(statement.expression);
    });
  }
  return returnedExpressions.some((expression) => {
    const current = unwrapExpression(expression);
    if (!ts.isConditionalExpression(current) || current.whenFalse.kind !== ts.SyntaxKind.NullKeyword) {
      return false;
    }
    const conditionCalls = collectCallPaths(current.condition);
    const resultCalls = collectCallPaths(current.whenTrue);
    return conditionCalls.has('Number.isFinite')
      && resultCalls.has('Math.max')
      && resultCalls.has('Math.trunc');
  });
}

function collectUnexpectedLegacyOwnershipDeclarations(source: ParsedSource): string[] {
  return collectTopLevelFunctionLikes(source)
    .filter(({ name, node }) => (
      !APPROVED_ADAPTER_OWNERSHIP_DECLARATIONS.has(name)
      && (isLegacyCanonicalOwnershipName(name) || duplicatesDeckSizeNormalization(node))
    ))
    .map(({ name }) => name);
}

function countAwaitExpressions(declaration: ts.FunctionDeclaration): number {
  let count = 0;
  const visit = (node: ts.Node) => {
    if (ts.isAwaitExpression(node)) count += 1;
    ts.forEachChild(node, visit);
  };
  if (declaration.body) visit(declaration.body);
  return count;
}

function declaredFunctionNames(source: ParsedSource): string[] {
  const names: string[] = [];
  source.sourceFile.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name) names.push(node.name.text);
  });
  return names;
}

describe('room-deck normalized transform ownership', () => {
  const core = readSource('utils/match-room-deck.ts');
  const worker = readSource('workers/match-worker.ts');
  const local = readSource('scripts/local-match-server.ts');

  test('the pure core exports the complete normalized transform surface with no runtime dependency', () => {
    const expectedExports = [
      'normalizeRoomDeckSize',
      'sanitizePublicRoomDeck',
      'cloneRoomDeckCardIdsByPlayer',
      'cloneRoomDeckSpecByPlayer',
      'createAllCardsRoomDeckMetadata',
      'isAllCardsDeckRoom',
      'buildInitialDeckSnapshotOptions',
      'buildRoomDeckSelectionPatch',
      'projectPublicRoomDeck'
    ];
    const exportedFunctions: string[] = [];
    core.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const isExported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
        if (isExported) exportedFunctions.push(node.name.text);
      }
    });
    const runtimeImports = collectRuntimeModuleSpecifiers(core);
    expect(exportedFunctions).toEqual(expectedExports);
    expect(runtimeImports).toEqual(['./deepClone.js']);
    expect(runtimeImports.filter(isForbiddenCoreRuntimeSpecifier)).toEqual([]);
    expect(core.text).not.toMatch(/\b(?:window|document|globalThis|process|setTimeout|setInterval)\b/);
  });

  test.each([
    [worker.relativePath, 'createAllCardsRoomDeckMetadataFromRuntimeCardIds', 'createCanonicalAllCardsRoomDeckMetadata', 'return', worker],
    [worker.relativePath, 'isAllCardsDeckRoom', 'classifyAllCardsDeckRoom', 'return', worker],
    [worker.relativePath, 'buildInitialDeckSnapshotOptions', 'buildCanonicalInitialDeckSnapshotOptions', 'return', worker],
    [worker.relativePath, 'assignRoomDeckSelection', 'buildRoomDeckSelectionPatch', 'selection-patch', worker],
    [worker.relativePath, 'toPublicRoomDeck', 'projectPublicRoomDeck', 'return', worker],
    [local.relativePath, 'createAllCardsRoomDeckMetadataFromRuntimeCardIds', 'createCanonicalAllCardsRoomDeckMetadata', 'return', local],
    [local.relativePath, 'isAllCardsDeckRoom', 'classifyAllCardsDeckRoom', 'return', local],
    [local.relativePath, 'buildInitialDeckSnapshotOptions', 'buildCanonicalInitialDeckSnapshotOptions', 'return', local],
    [local.relativePath, 'assignRoomDeckSelection', 'buildRoomDeckSelectionPatch', 'selection-patch', local],
    [local.relativePath, 'toPublicRoomDeck', 'projectPublicRoomDeck', 'return', local]
  ] as const)('%s %s consumes the result of %s', (_sourcePath, wrapperName, canonicalCall, expectedUsage, source) => {
    expect(() => assertCanonicalResultUsage(source, wrapperName, canonicalCall, expectedUsage)).not.toThrow();
  });

  test('removed canonical ownership does not reappear as renamed function or arrow declarations', () => {
    expect(collectUnexpectedLegacyOwnershipDeclarations(worker)).toEqual([]);
    expect(collectUnexpectedLegacyOwnershipDeclarations(local)).toEqual([]);
  });

  test('selection wrappers apply one synchronous complete patch after pure calculation', () => {
    [worker, local].forEach((source) => {
      const assign = findFunction(source, 'assignRoomDeckSelection');
      expect(countAwaitExpressions(assign)).toBe(0);
      expect(() => assertCanonicalResultUsage(
        source,
        'assignRoomDeckSelection',
        'buildRoomDeckSelectionPatch',
        'selection-patch'
      )).not.toThrow();
    });
  });

  test('synthetic regressions reject ignored canonical results and renamed arrow ownership', () => {
    const ignoredCanonicalResult = parseSource('synthetic-ignored-result.ts', `
      function toPublicRoomDeck(metadata: any) {
        projectPublicRoomDeck(metadata, {});
        return { mode: 'shared', deckCode: '', deckSize: null, source: 'room' };
      }
    `);
    expect(() => assertCanonicalResultUsage(
      ignoredCanonicalResult,
      'toPublicRoomDeck',
      'projectPublicRoomDeck',
      'return'
    )).toThrow(/result does not reach return/);

    const renamedArrowDuplicate = parseSource('synthetic-renamed-owner.ts', `
      const coerceOptionalCount = (value: unknown) => Number.isFinite(Number(value))
        ? Math.max(0, Math.trunc(Number(value)))
        : null;
    `);
    expect(collectUnexpectedLegacyOwnershipDeclarations(renamedArrowDuplicate))
      .toEqual(['coerceOptionalCount']);
  });

  test('synthetic runtime dependency scan covers every supported import form', () => {
    const runtimeImports = parseSource('synthetic-runtime-imports.ts', `
      import staticDependency from '../workers/static-dependency';
      import equalDependency = require('../ui/equal-dependency');
      const requiredDependency = require('../scripts/required-dependency');
      const dynamicDependency = import('../workers/dynamic-dependency');
      import type { TypeOnlyDependency } from '../workers/type-only-dependency';
      void staticDependency;
      void equalDependency;
      void requiredDependency;
      void dynamicDependency;
    `);
    expect(collectRuntimeModuleSpecifiers(runtimeImports)).toEqual([
      '../scripts/required-dependency',
      '../ui/equal-dependency',
      '../workers/dynamic-dependency',
      '../workers/static-dependency'
    ]);
    expect(collectRuntimeModuleSpecifiers(runtimeImports).filter(isForbiddenCoreRuntimeSpecifier))
      .toHaveLength(4);
  });

  test('the local malformed projection exception rejects supported and empty modes by construction', () => {
    expect(declaredFunctionNames(worker)).not.toContain('projectLegacyUnknownModeRoomDeck');
    const fallback = findFunction(local, 'projectLegacyUnknownModeRoomDeck');
    const fallbackBody = fallback.body?.getText(local.sourceFile) || '';
    expect(fallbackBody).toContain('!rawMode');
    expect(fallbackBody).toContain("rawMode === 'shared'");
    expect(fallbackBody).toContain("rawMode === 'perPlayer'");
    expect(collectCallNames(local, fallback)).not.toContain('projectPublicRoomDeck');

    const publicProjection = findFunction(local, 'toPublicRoomDeck');
    const projectionBody = publicProjection.body?.getText(local.sourceFile) || '';
    expect(projectionBody).toContain("rawMode !== 'shared'");
    expect(projectionBody).toContain("rawMode !== 'perPlayer'");
    expect(collectCallNames(local, publicProjection)).toEqual(expect.arrayContaining([
      'projectLegacyUnknownModeRoomDeck',
      'projectPublicRoomDeck'
    ]));
  });

  test('public projection core cannot read private deck specifications or card-id sources', () => {
    const projection = findFunction(core, 'projectPublicRoomDeck');
    const body = projection.body?.getText(core.sourceFile) || '';
    expect(body).not.toContain('initialDeckSpec');
    expect(body).not.toContain('initialDeckCardIds');
    expect(projection.parameters.map((parameter) => parameter.name.getText(core.sourceFile))).toEqual([
      'metadata',
      'snapshotSizes'
    ]);
  });
});
