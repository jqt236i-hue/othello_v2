import * as fs from 'fs';
import * as path from 'path';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const root = path.resolve(__dirname, '..');

function shouldCheck(filePath: string): boolean {
    // Only check server-side / logic code where window usage is forbidden.
    // Allow UI and scripts to use window intentionally.
    const allowedTargets = [
        'game/', 'cpu/', 'logic/', 'src/', 'card-system.js', 'sound-engine.js', 'is-env-capable.js'
    ];
    for (const t of allowedTargets) {
        if (filePath.indexOf(t) === 0) return true;
    }
    return false;
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

const files = walk(root).filter(f => f.endsWith('.js'));
const violations: { file: string; line: number; label: string }[] = [];
const globalThisRefs: { file: string; line: number; label: string }[] = [];
for (const f of files) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (!shouldCheck(rel)) continue;
    let content = '';
    try { content = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const res = [
        { re: /\bwindow\./g, label: 'window.' },
        { re: /\bdocument\./g, label: 'document.' },
        { re: /require\(\s*['"]\.\.\/ui\/bootstrap['"]\s*\)/g, label: "require('../ui/bootstrap')" }
    ];
    for (const { re, label } of res) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
            // report each occurrence with line number
            const pos = m.index;
            const before = content.slice(0, pos);
            const line = before.split('\n').length;
            violations.push({ file: rel, line, label });
        }
    }
    // globalThis detection (warnings only — not yet enforced)
    const globalThisPatterns = [
        { re: /\bglobalThis\./g, label: 'globalThis.' },
        { re: /\(globalThis as any\)\./g, label: '(globalThis as any).' }
    ];
    for (const { re, label } of globalThisPatterns) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
            const pos = m.index;
            const before = content.slice(0, pos);
            const line = before.split('\n').length;
            globalThisRefs.push({ file: rel, line, label });
        }
    }
}

// Print globalThis references first (always, even if violations exist)
if (globalThisRefs.length > 0) {
    console.log('\n[globalThis-check] globalThis references found in game/:');
    globalThisRefs.forEach(v => console.log(` - ${v.file}:${v.line} (${v.label})`));
    console.log(`\n[globalThis-check] ${globalThisRefs.length} references found in game/ (these will be reduced over time)`);
} else {
    console.log('[globalThis-check] No globalThis references found in game/.');
}

if (violations.length > 0) {
    console.error('\n[STATIC-CHECK] Forbidden usage found in non-UI files:');
    violations.forEach(v => console.error(` - ${v.file}:${v.line} (${v.label})`));
    console.error('\nPlease register UI globals via `ui/bootstrap.registerUIGlobals` or migrate to UIBootstrap.');
    process.exit(2);
}

console.log('[STATIC-CHECK] No forbidden window usage found.');
process.exit(0);
