import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

declare const __non_webpack_require__: NodeRequire | undefined;

const root = path.resolve(__dirname, '..', '..');

type Violation = { file: string; line: number; label: string };
type PatternViolation = { pattern: RegExp; label: string };

const specialEffectsBannedIdentifiers = new Set([
    'animateFadeOutAt',
    'animateDestroyAt',
    'animateHyperactiveMove',
    'animateHyperactiveMoveChain',
    'setDiscColorAt',
    'removeBombOverlayAt',
    'removeRegenOverlayAt',
    'emitBoardUpdate',
    'emitGameStateChange',
    'emitCardStateChange',
    'waitMs',
    'requestFrame'
]);

function shouldCheck(filePath: string): boolean {
    const allowedTargets = [
        'game/',
        'shared/',
        'constants/',
        'src/',
        'utils/owner-helpers.ts',
        'card-system.js',
        'shared-constants.js',
        'sound-engine.js',
        'is-env-capable.js'
    ];
    return allowedTargets.some((target) => filePath.indexOf(target) === 0);
}

function shouldEnforceGlobalThis(filePath: string): boolean {
    return filePath.indexOf('game/') === 0
        || filePath === 'utils/owner-helpers.ts';
}

function shouldEnforceGameNetworkClientRootAccess(filePath: string): boolean {
    return filePath.indexOf('game/') === 0;
}

function shouldEnforceDomlessConstants(filePath: string): boolean {
    return filePath.indexOf('constants/') === 0;
}

function shouldEnforcePureOwnerHelpers(filePath: string): boolean {
    return filePath === 'utils/owner-helpers.ts';
}

function shouldEnforceSpecialEffectsBridge(filePath: string): boolean {
    return filePath.indexOf('game/special-effects/') === 0
        && filePath !== 'game/special-effects/presentation-bridge.ts';
}

function isGeneratedOrMirror(filePath: string): boolean {
    return filePath.indexOf('dist/') === 0
        || filePath.indexOf('worker-public/') === 0
        || filePath.indexOf('public/') === 0
        || filePath.endsWith('.d.ts')
        || filePath.indexOf('.generated.') >= 0
        || (filePath.endsWith('.runtime.js') && !shouldInspectRuntimeProjection(filePath));
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

function shouldInspectRuntimeProjection(filePath: string): boolean {
    return filePath === 'game/network-turn-handoff.runtime.js';
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

function collectElementAccessBase(node: ts.Node): ts.Expression | null {
    if (ts.isElementAccessExpression(node) || ts.isElementAccessChain(node)) {
        return node.expression;
    }
    return null;
}

function unwrapExpressionBase(expression: ts.Expression): ts.Expression {
    let current = expression;
    while (true) {
        if (ts.isParenthesizedExpression(current)) {
            current = current.expression;
            continue;
        }
        if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current) || ts.isNonNullExpression(current)) {
            current = current.expression;
            continue;
        }
        return current;
    }
}

function readStaticElementAccessKey(node: ts.Node): string | null {
    if (!(ts.isElementAccessExpression(node) || ts.isElementAccessChain(node))) return null;
    const arg = node.argumentExpression;
    if (!arg) return null;
    if (ts.isStringLiteralLike(arg)) return arg.text;
    return null;
}

function isAllowedSpecialEffectsBridgeIdentifier(node: ts.Identifier): boolean {
    const parent = node.parent;
    if (!(ts.isPropertyAccessExpression(parent) || ts.isPropertyAccessChain(parent))) return false;
    if (parent.name !== node) return false;
    const base = unwrapExpressionBase(parent.expression);
    return ts.isIdentifier(base) && base.text === 'SpecialEffectsPresentationBridge';
}

function collectPatternViolations(filePath: string): PatternViolation[] {
    const violations: PatternViolation[] = [];
    if (shouldEnforceDomlessConstants(filePath)) {
        violations.push({ pattern: /\bHTMLElement\b/g, label: 'HTMLElement' });
    }
    if (shouldEnforcePureOwnerHelpers(filePath)) {
        violations.push({ pattern: /\bwindow\b/g, label: 'window' });
        violations.push({ pattern: /\bdocument\b/g, label: 'document' });
    }
    if (shouldEnforceSpecialEffectsBridge(filePath)) {
        violations.push({ pattern: /\bControllerEvents\b/g, label: 'special-effects ControllerEvents' });
        violations.push({ pattern: /(?:^|[^\w.])(?:_require|require)\('\.\.\/timers'\)/g, label: "special-effects require('../timers')" });
        violations.push({ pattern: /\b__uiImpl_[A-Za-z0-9_]*\b/g, label: 'special-effects __uiImpl' });
    }
    if (filePath.indexOf('game/') === 0 && filePath !== 'game/timer-service.ts') {
        violations.push({ pattern: /(?:^|[^\w.])(?:_require|require)\('\.\/timer-service'\)/g, label: "require('./timer-service')" });
        violations.push({ pattern: /\bcreateTimerService\s*\(\s*['"]browser['"]\s*\)/g, label: "createTimerService('browser')" });
    }
    return violations;
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
    const patternViolations = collectPatternViolations(f);

    const visit = (node: ts.Node): void => {
        const propertyBase = collectPropertyAccessBase(node);
        const unwrappedBase = propertyBase ? unwrapExpressionBase(propertyBase) : null;
        if (unwrappedBase && ts.isIdentifier(unwrappedBase)) {
            if (unwrappedBase.text === 'window') {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'window.' });
            } else if (unwrappedBase.text === 'document') {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'document.' });
            } else if (unwrappedBase.text === 'globalThis' && shouldEnforceGlobalThis(f)) {
                globalThisRefs.push({ file: f, line: toLine(sourceFile, node), label: 'globalThis.' });
            }
            if (
                (unwrappedBase.text === 'window' || unwrappedBase.text === 'globalThis')
                && (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
                && node.name.text === 'NetworkMatchClient'
            ) {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'root NetworkMatchClient' });
            }
            if (
                shouldEnforceGameNetworkClientRootAccess(f)
                && (ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain(node))
                && node.name.text === 'NetworkMatchClient'
            ) {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'root NetworkMatchClient' });
            }
        }
        const elementBase = collectElementAccessBase(node);
        const unwrappedElementBase = elementBase ? unwrapExpressionBase(elementBase) : null;
        if (unwrappedElementBase && ts.isIdentifier(unwrappedElementBase)) {
            const key = readStaticElementAccessKey(node);
            if (
                key === 'NetworkMatchClient'
                && (unwrappedElementBase.text === 'window' || unwrappedElementBase.text === 'globalThis')
            ) {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'root NetworkMatchClient' });
            }
        }
        if (
            shouldEnforceGlobalThis(f)
            && ts.isStringLiteralLike(node)
            && node.text === 'NetworkMatchClient'
        ) {
            violations.push({ file: f, line: toLine(sourceFile, node), label: 'root NetworkMatchClient' });
        }
        if (ts.isIdentifier(node)) {
            if (shouldEnforceDomlessConstants(f) && node.text === 'HTMLElement') {
                violations.push({ file: f, line: toLine(sourceFile, node), label: 'HTMLElement' });
            }
            if (shouldEnforcePureOwnerHelpers(f) && (node.text === 'window' || node.text === 'document')) {
                violations.push({ file: f, line: toLine(sourceFile, node), label: node.text });
            }
            if (shouldEnforceSpecialEffectsBridge(f)) {
                if (node.text === 'ControllerEvents' || /^__uiImpl_[A-Za-z0-9_]*$/.test(node.text)) {
                    violations.push({ file: f, line: toLine(sourceFile, node), label: `special-effects ${node.text}` });
                } else if (specialEffectsBannedIdentifiers.has(node.text) && !isAllowedSpecialEffectsBridgeIdentifier(node)) {
                    violations.push({ file: f, line: toLine(sourceFile, node), label: `special-effects ${node.text}` });
                }
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

    for (const patternViolation of patternViolations) {
        patternViolation.pattern.lastIndex = 0;
        let match: RegExpExecArray | null = null;
        while ((match = patternViolation.pattern.exec(content)) !== null) {
            const line = sourceFile.getLineAndCharacterOfPosition(match.index).line + 1;
            violations.push({ file: f, line, label: patternViolation.label });
        }
    }
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
