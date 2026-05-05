/**
 * Deep inspect: show the actual body content around error location
 */
const fs = require('fs');
const r = fs.readFileSync('public/module-registry.js', 'utf8');

// Check a specific module: card-system (first fail)
const key = 'card-system';
const marker = `_r("${key}",`;
const idx = r.indexOf(marker);
if (idx < 0) { console.log('Key not found'); process.exit(1); }
const start = r.indexOf('`', idx);
const end = r.indexOf('`));', start);
const body = r.substring(start + 1, end);

console.log('=== card-system body (first 3000 chars) ===');
console.log(body.substring(0, 3000));
console.log('\n=== Testing with new Function ===');
try {
    new Function('module', 'exports', 'require', '__dirname', '__filename', body);
    console.log('PASS');
} catch (e) {
    console.log('FAIL:', e.message);
    // Try to find the problematic position
    const posMatch = e.message.match(/position\s+(\d+)/);
    if (posMatch) {
        const pos = parseInt(posMatch[1]);
        console.log('Position:', pos);
        console.log('Context:', body.substring(Math.max(0, pos-50), pos+50));
    }
}