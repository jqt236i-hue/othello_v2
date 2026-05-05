/**
 * Check a specific failing module from the registry.
 */
const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');

const keys = ['ui/handlers/debug', 'ui/status-display', 'ui/story/story-controller'];

for (const key of keys) {
    const re = new RegExp('_r\\("' + key.replace(/\//g, '\\/') + '",\\s*("(?:[^"\\\\]|\\\\.)*")\\s*\\);');
    const m = rl.match(re);
    if (!m) { console.log('\n' + key + ': NOT FOUND'); continue; }
    const jsonStr = m[1];
    let body;
    try { body = JSON.parse(jsonStr); } catch (e) { console.log('\n' + key + ': JSON error: ' + e.message); continue; }
    
    const lines = body.split('\n');
    console.log('\n=== ' + key + ' (' + body.length + ' bytes, ' + lines.length + ' lines) ===');
    console.log(lines.slice(0, 15).join('\n'));
    
    // Search for _require declarations
    const requireDecls = [];
    for (let i = 0; i < lines.length; i++) {
        if (/\b_require\b/.test(lines[i])) {
            requireDecls.push({ line: i + 1, text: lines[i] });
        }
    }
    console.log('\n_require references (' + requireDecls.length + '):');
    requireDecls.forEach(d => console.log('  line ' + d.line + ': ' + d.text));
}