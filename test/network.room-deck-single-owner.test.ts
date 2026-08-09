import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..');

function readSource(relativePath: string) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const text = fs.readFileSync(absolutePath, 'utf8');
  return {
    relativePath,
    text,
    sourceFile: ts.createSourceFile(
      absolutePath,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
  };
}

type ParsedSource = ReturnType<typeof readSource>;

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
      'cloneRoomDeckCardIdsByPlayer',
      'cloneRoomDeckSpecByPlayer',
      'createAllCardsRoomDeckMetadata',
      'isAllCardsDeckRoom',
      'buildInitialDeckSnapshotOptions',
      'buildRoomDeckSelectionPatch',
      'projectPublicRoomDeck'
    ];
    const exportedFunctions: string[] = [];
    const imports: string[] = [];
    core.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const isExported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
        if (isExported) exportedFunctions.push(node.name.text);
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
    });
    expect(exportedFunctions).toEqual(expectedExports);
    expect(imports).toEqual(['./deepClone.js']);
    expect(core.text).not.toMatch(/from ['"](?:\.\.\/)?(?:workers|scripts|ui)\//);
    expect(core.text).not.toMatch(/\b(?:window|document|globalThis|process|setTimeout|setInterval)\b/);
  });

  test.each([
    [worker, 'createAllCardsRoomDeckMetadataFromRuntimeCardIds', 'createCanonicalAllCardsRoomDeckMetadata'],
    [worker, 'isAllCardsDeckRoom', 'classifyAllCardsDeckRoom'],
    [worker, 'buildInitialDeckSnapshotOptions', 'buildCanonicalInitialDeckSnapshotOptions'],
    [worker, 'assignRoomDeckSelection', 'buildRoomDeckSelectionPatch'],
    [worker, 'toPublicRoomDeck', 'projectPublicRoomDeck'],
    [local, 'createAllCardsRoomDeckMetadataFromRuntimeCardIds', 'createCanonicalAllCardsRoomDeckMetadata'],
    [local, 'isAllCardsDeckRoom', 'classifyAllCardsDeckRoom'],
    [local, 'buildInitialDeckSnapshotOptions', 'buildCanonicalInitialDeckSnapshotOptions'],
    [local, 'assignRoomDeckSelection', 'buildRoomDeckSelectionPatch'],
    [local, 'toPublicRoomDeck', 'projectPublicRoomDeck']
  ] as const)('%s %s delegates to %s', (source, wrapperName, canonicalCall) => {
    const wrapper = findFunction(source, wrapperName);
    expect(collectCallNames(source, wrapper)).toContain(canonicalCall);
  });

  test('removed canonical bodies do not reappear in either runtime adapter', () => {
    const bannedLegacyDeclarations = [
      'normalizeDeckSizeValue',
      'getRoomInitialDeckSpecByPlayer',
      'hasRoomDeckMetadataEntries',
      'createAllCardsRoomDeckMetadata'
    ];
    const workerDeclarations = declaredFunctionNames(worker);
    const localDeclarations = declaredFunctionNames(local);
    bannedLegacyDeclarations.forEach((name) => {
      expect(workerDeclarations).not.toContain(name);
      expect(localDeclarations).not.toContain(name);
    });
  });

  test('selection wrappers apply one synchronous complete patch after pure calculation', () => {
    [worker, local].forEach((source) => {
      const assign = findFunction(source, 'assignRoomDeckSelection');
      const body = assign.body?.getText(source.sourceFile) || '';
      expect(countAwaitExpressions(assign)).toBe(0);
      expect(body).toContain('room.initialDeckSpec = patch.initialDeckSpec;');
      expect(body).toContain('room.initialDeckSpecByPlayer = patch.initialDeckSpecByPlayer;');
      expect(body).toContain('room.roomDeck = patch.roomDeck;');
    });
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
