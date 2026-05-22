import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

declare const __non_webpack_require__: NodeRequire | undefined;

const root = path.resolve(__dirname, '..', '..');

type Violation = { file: string; line: number; label: string };

function shouldCheck(filePath: string): boolean {
    const allowedTargets = [
        'game/',
        'shared/',
        'src/',
        'card-system.js',
        'shared-constants.js',
        'sound-engine.js',
        'is-env-capable.js'
    ];
    return allowedTargets.some((target) => filePath.indexOf(target) === 0);
}

function shouldEnforceGlobalThis(filePath: string): boolean {
    return filePath.indexOf('game/') === 0;
}

function isGeneratedOrMirror(filePath: string): boolean {
    return filePath.indexOf('dist/') === 0
        || filePath.indexOf('worker-public/') === 0
        || filePath.indexOf('public/') === 0
        || filePath.endsWith('.d.ts')
        || filePath.indexOf('.generated.') >= 0
        || filePath.endsWith('.runtime.js');
}

function isSourceOfTruthFile(filePath: string): boolean {
    if (isGeneratedOrMirror(filePath)) return false;
    if (!(filePath.endsWith('.ts') || filePath.endsWith('.js'))) return false;
    if (!shouldCheck(filePath)) return false;
    if (!filePath.endsWith('.js')) return true;
    const absolutePath = path.join(root, filePath);
    const tsVariant = absolutePath.replace(/\.js$/, '.ts');
    return !fs.existsSync(tsVariant);
}

function walk(dir: string): string[] {
    const results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results.push(...walk(filePath));
        } else {
            results.push(filePath);
        }
    });
    return results;
}

function toLine(sourceFile: ts.SourceFile, node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function collectPropertyAccessBase(node: ts.Node): ts.Expression | null {
    if (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node)) {
        return node.expression;
    }
    return null;
}

const files = walk(root)
    .map((absolutePath) => path.relative(root, absolutePath).replace(/\\/g, '/'))
    .filter((relativePath) => isSourceOfTruthFile(relativePath));
const violations: Violation[] = [];
const globalThisRefs: Violation[] = [];
for (const f of files) {
    const absolutePath = path.join(root, f);
    let content = '';
    try { content = fs.readFileSync(absolutePath, 'utf8'); } catch (e) { continue; }
    const scriptKind = f.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    const sourceFile = ts.createSourceFile(f, content, ts.ScriptTarget.Latest, true, scriptKind);

    const visit = (node: ts.Node): void => {
        const propertyBase = collectPropertyAccessBase(node);
        if (propertyBase && ts.isIdentifier(propertyBase)) {
            if (propertyBase.text === 'window') {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'window.' });
            } else if (propertyBase.text === 'document') {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'document.' });
            } else if (propertyBase.text === 'globalThis' && shouldEnforceGlobalThis(f)) {
                globalThisRefs.push({ file: f, line: toLine(sourceFile, node), label: 'globalThis.' });
            }
        }
        if (ts.isCallExpression(node)
            && ts.isIdentifier(node.expression)
            && node.expression.text === 'require'
            && node.arguments.length > 0
            && ts.isStringLiteralLike(node.arguments[0])
            && node.arguments[0].text === '../ui/bootstrap') {
            violations.push({
                file: f,
                line: toLine(sourceFile, node),
                label: "require('../ui/bootstrap')"
            });
        }
        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
}

if (globalThisRefs.length > 0) {
    console.error('\n[globalThis-check] Forbidden globalThis property access found in source-of-truth game files:');
    globalThisRefs.forEach(v => console.error(` - ${v.file}:${v.line} (${v.label})`));
} else {
    console.log('[globalThis-check] No globalThis property access found in source-of-truth game files.');
}

if (violations.length > 0) {
    console.error('\n[STATIC-CHECK] Forbidden usage found in non-UI files:');
    violations.forEach(v => console.error(` - ${v.file}:${v.line} (${v.label})`));
    console.error('\nPlease register UI globals via `ui/bootstrap.registerUIGlobals` or migrate to UIBootstrap.');
    process.exit(2);
}
if (globalThisRefs.length > 0) {
    console.error('\nRemove runtime-root coupling from game/ before merging.');
    process.exit(2);
}

console.log('[STATIC-CHECK] No forbidden window usage found.');
process.exit(0);
