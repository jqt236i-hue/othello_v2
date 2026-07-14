import * as fs from 'fs';
import { builtinModules } from 'module';
import * as path from 'path';
import * as ts from 'typescript';

interface BrowserViteModuleRecord {
  moduleKey: string;
  aliases: string[];
  sourcePath: string;
  content: string;
}

interface TransformLegacyBrowserModuleOptions {
  record: BrowserViteModuleRecord;
  records: BrowserViteModuleRecord[];
  includedModuleKeys: ReadonlySet<string>;
  stagedPathByModuleKey: ReadonlyMap<string, string>;
}

const BRIDGE_BUILTINS = new Set(
  builtinModules.concat(builtinModules.map((name) => `node:${name}`))
);
const CUSTOM_REQUIRE_NAMES = new Set(['_require', '__require', '__non_webpack_require__']);
const INTENTIONAL_MISSING_MODULE_PROBES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // turn-manager deliberately falls back to the existing event emitters when this old adapter is absent.
  'game/turn-manager': Object.freeze(['./turn/notifier']),
  // Browser ONNX receives ORT through configure(); these guarded probes are for Node/headless use only.
  'game/ai/othello-onnx-runtime': Object.freeze(['onnxruntime-web']),
  'game/ai/policy-onnx-runtime': Object.freeze(['onnxruntime-web'])
});

function normalizeModuleKey(value: string): string {
  let normalized = String(value || '').trim().replace(/\\/g, '/');
  normalized = normalized.replace(/^\.\//, '');
  if (normalized.startsWith('dist/')) normalized = normalized.slice(5);
  normalized = path.posix.normalize(normalized).replace(/^\.\//, '');
  normalized = normalized.replace(/\.js$/, '');
  return normalized;
}

function buildRecordLookup(records: BrowserViteModuleRecord[]): Map<string, BrowserViteModuleRecord> {
  const lookup = new Map<string, BrowserViteModuleRecord>();
  for (const record of records) {
    for (const key of [record.moduleKey].concat(record.aliases || [])) {
      const normalized = normalizeModuleKey(key);
      if (normalized && !lookup.has(normalized)) lookup.set(normalized, record);
    }
  }
  return lookup;
}

function resolveRecord(
  lookup: ReadonlyMap<string, BrowserViteModuleRecord>,
  fromModuleKey: string,
  requestId: string
): BrowserViteModuleRecord | null {
  const raw = String(requestId || '').trim().replace(/\\/g, '/');
  if (!raw) return null;
  const distIndex = raw.indexOf('dist/');
  const candidate = distIndex >= 0
    ? raw.slice(distIndex + 5)
    : (raw.startsWith('.')
      ? path.posix.join(path.posix.dirname(fromModuleKey), raw)
      : raw);
  return lookup.get(normalizeModuleKey(candidate)) || null;
}

function findLocalDependency(sourcePath: string, requestId: string): string | null {
  if (!String(requestId || '').startsWith('.')) return null;
  const base = path.resolve(path.dirname(sourcePath), requestId);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function bridgeCall(factory: ts.NodeFactory, argument: ts.Expression, moduleDir: string): ts.CallExpression {
  return factory.createCallExpression(
    factory.createPropertyAccessExpression(factory.createIdentifier('window'), 'require'),
    undefined,
    [argument, factory.createStringLiteral(moduleDir)]
  );
}

function staticRequire(factory: ts.NodeFactory, absolutePath: string): ts.CallExpression {
  return factory.createCallExpression(
    factory.createIdentifier('require'),
    undefined,
    [factory.createStringLiteral(path.resolve(absolutePath).replace(/\\/g, '/'))]
  );
}

function bridgeRequireValue(factory: ts.NodeFactory, moduleDir: string): ts.ArrowFunction {
  const id = factory.createIdentifier('id');
  return factory.createArrowFunction(
    undefined,
    undefined,
    [factory.createParameterDeclaration(undefined, undefined, id)],
    undefined,
    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    bridgeCall(factory, id, moduleDir)
  );
}

function isRequireBindingOrPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  return false;
}

function transformLegacyBrowserModule(options: TransformLegacyBrowserModuleOptions): string {
  const record = options.record;
  const recordLookup = buildRecordLookup(options.records);
  const canonicalKey = normalizeModuleKey(record.moduleKey);
  const moduleDir = path.posix.dirname(canonicalKey) === '.' ? '' : path.posix.dirname(canonicalKey);
  const sourceFile = ts.createSourceFile(
    record.sourcePath,
    String(record.content || '').replace(/^#![^\n]*\n/, '').replace(/\n?\/\/# sourceMappingURL=.*$/m, ''),
    ts.ScriptTarget.ES2020,
    true,
    ts.ScriptKind.JS
  );

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const factory = context.factory;
    const visit: ts.Visitor = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && CUSTOM_REQUIRE_NAMES.has(node.name.text)) {
        const id = factory.createIdentifier('id');
        return factory.updateVariableDeclaration(
          node,
          node.name,
          node.exclamationToken,
          node.type,
          factory.createArrowFunction(
            undefined,
            undefined,
            [factory.createParameterDeclaration(undefined, undefined, id)],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            bridgeCall(factory, id, moduleDir)
          )
        );
      }

      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const calleeName = node.expression.text;
        const isCustomRequire = CUSTOM_REQUIRE_NAMES.has(calleeName);
        const isPlainRequire = calleeName === 'require';
        if ((isCustomRequire || isPlainRequire) && node.arguments.length > 0) {
          const argument = node.arguments[0];
          if (!ts.isStringLiteralLike(argument)) {
            return bridgeCall(factory, ts.visitNode(argument, visit) as ts.Expression, moduleDir);
          }

          const requestId = argument.text;
          const targetRecord = resolveRecord(recordLookup, canonicalKey, requestId);
          if (targetRecord) {
            const targetKey = normalizeModuleKey(targetRecord.moduleKey);
            if (options.includedModuleKeys.has(targetKey)) {
              const targetPath = options.stagedPathByModuleKey.get(targetKey);
              if (!targetPath) throw new Error(`[vite-module-transform] missing staged path: ${canonicalKey} -> ${targetKey}`);
              return staticRequire(factory, targetPath);
            }
            return bridgeCall(factory, factory.createStringLiteral(requestId), moduleDir);
          }

          if (BRIDGE_BUILTINS.has(requestId)) {
            return bridgeCall(factory, factory.createStringLiteral(requestId), moduleDir);
          }

          const localDependency = findLocalDependency(record.sourcePath, requestId);
          if (localDependency) {
            if (path.extname(localDependency).toLowerCase() !== '.json') {
              throw new Error(
                `[vite-module-transform] local JavaScript dependency is outside browser records: ${canonicalKey} -> ${requestId}`
              );
            }
            return staticRequire(factory, localDependency);
          }

          if (requestId.startsWith('.') || isCustomRequire) {
            if ((INTENTIONAL_MISSING_MODULE_PROBES[canonicalKey] || []).includes(requestId)) {
              return bridgeCall(factory, factory.createStringLiteral(requestId), moduleDir);
            }
            throw new Error(`[vite-module-transform] unresolved browser module id: ${canonicalKey} -> ${requestId}`);
          }
        }
      }


      // Some legacy modules pass `require` as a callback so they can resolve a
      // module chosen later. Rolldown's generated CommonJS require only knows
      // statically analysed calls; preserve this deliberate dynamic boundary
      // through the accessor bridge instead.
      if (
        ts.isIdentifier(node)
        && node.text === 'require'
        && !(ts.isCallExpression(node.parent) && node.parent.expression === node)
        && !isRequireBindingOrPropertyName(node)
      ) {
        return bridgeRequireValue(factory, moduleDir);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (root) => ts.visitNode(root, visit) as ts.SourceFile;
  };

  const transformed = ts.transform(sourceFile, [transformer]);
  try {
    return ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
      .printFile(transformed.transformed[0] as ts.SourceFile);
  } finally {
    transformed.dispose();
  }
}

export = {
  normalizeModuleKey,
  transformLegacyBrowserModule
};
