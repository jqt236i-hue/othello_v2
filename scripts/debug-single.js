const fs = require('fs');
const rl = fs.readFileSync('public/module-registry.js', 'utf8');

// Find a specific module entry
const key = 'card-system';
const idx = rl.indexOf('_r("' + key + '"');
const endIdx = rl.indexOf('`));', idx);
const entry = rl.substring(idx, endIdx + 4);

// Extract the function body (between backticks)
const backtickStart = entry.indexOf('`');
const backtickEnd = entry.lastIndexOf('`');
const body = entry.substring(backtickStart + 1, backtickEnd);

// Show first 200 chars
console.log('First 200 chars of body:');
console.log(body.substring(0, 200));
console.log('---');

// Check for problematic patterns
const lines = body.split('\n');
for (let i = 0; i < Math.min(30, lines.length); i++) {
    if (lines[i].includes('const exports') || lines[i].includes('const _require') || lines[i].includes('const require') || lines[i].includes('let require')) {
        console.log('L' + (i+1) + ': ' + lines[i].substring(0, 100));
    }
}