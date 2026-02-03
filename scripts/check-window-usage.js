#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function shouldCheck(filePath) {
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

function walk(dir) {
    const results = [];
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
const violations = [];
for (const f of files) {
    const rel = path.relative(root, f).replace(/\\/g, '/');
    if (!shouldCheck(rel)) continue;
    let content = '';
    try { content = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const re = /\bwindow\./g;
    let m;
    while ((m = re.exec(content)) !== null) {
        // report each occurrence with line number
        const pos = m.index;
        const before = content.slice(0, pos);
        const line = before.split('\n').length;
        violations.push({ file: rel, line });
    }
}

if (violations.length > 0) {
    console.error('\n[STATIC-CHECK] Forbidden `window.` usage found in non-UI files:');
    violations.forEach(v => console.error(` - ${v.file}:${v.line}`));
    console.error('\nPlease register UI globals via `ui/bootstrap.registerUIGlobals` or migrate to UIBootstrap.');
    process.exit(2);
}

console.log('[STATIC-CHECK] No forbidden window usage found.');
process.exit(0);
